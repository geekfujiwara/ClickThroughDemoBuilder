import { app, type InvocationContext } from '@azure/functions';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureContainer } from '../services/blobService.js';
import {
  isStorageConflict, jobBlob, readCutJob, readProjectVersion, writeCutJob, writeProjectVersion,
  type StoredCutJob,
} from '../services/videoCutService.js';
import { convertVideo } from '../services/videoConversionService.js';
import { isCutJobActive, remapClickPoints } from '../shared/videoCuts.js';

export async function processCutJob(id: string, context: InvocationContext): Promise<void> {
  const lease = (await jobBlob(id)).getBlobLeaseClient();
  try {
    await lease.acquireLease(60);
  } catch (error) {
    if (isStorageConflict(error)) return;
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Conversion timed out after 25 minutes.')), 25 * 60_000);
  let renewing = false;
  const renewal = setInterval(() => {
    if (renewing) return;
    renewing = true;
    void lease.renewLease().catch((error: unknown) => {
      context.error('[video-cut:lease]', error);
      controller.abort(error);
    }).finally(() => { renewing = false; });
  }, 20_000);
  let directory: string | undefined;
  let job: StoredCutJob | undefined;
  try {
    job = await readCutJob(id);
    if (!isCutJobActive(job)) return;
    const current = await readProjectVersion(job.projectId);
    const outputId = `${job.projectId}~${job.id}`;
    if (current?.project.video.videoId === outputId) {
      job.status = 'completed';
      await writeCutJob(job, lease);
      return;
    }
    if (!current || current.project.videoCutJobId !== id) throw new Error('The project changed or was deleted.');
    if (job.status === 'preparing') {
      job.projectEtag = current.etag;
      job.project = current.project;
    } else if (current.etag !== job.projectEtag) {
      throw new Error('The project changed during conversion. No changes were applied.');
    }
    if (job.attempts >= 3) throw new Error('Conversion could not finish after three attempts. Please retry.');
    job.attempts++;
    job.status = 'processing';
    await writeCutJob(job, lease);
    directory = await mkdtemp(join(tmpdir(), 'clickthrough-cut-'));
    const input = join(directory, 'input');
    const output = join(directory, 'output.mp4');
    const thumbnail = join(directory, 'thumbnail.jpg');
    const videos = await ensureContainer('videos');
    const source = videos.getBlockBlobClient(
      `${job.project.video.videoId}/video.${job.project.video.mimeType === 'video/webm' ? 'webm' : 'mp4'}`,
    );
    await source.downloadToFile(input, 0, undefined, {
      conditions: { ifMatch: job.sourceEtag }, abortSignal: controller.signal,
    });
    const metadata = await convertVideo(input, output, thumbnail, job.cuts, job.project.video.duration, controller.signal);
    controller.signal.throwIfAborted();
    await videos.getBlockBlobClient(`${outputId}/video.mp4`).uploadFile(output, {
      blobHTTPHeaders: { blobContentType: 'video/mp4' }, abortSignal: controller.signal,
    });
    // A unique video revision is published with the adjusted points in one conditional JSON write.
    await lease.renewLease();
    controller.signal.throwIfAborted();
    await writeProjectVersion({
      ...job.project, updatedAt: new Date().toISOString(),
      video: {
        ...job.project.video, ...metadata, videoId: outputId, mimeType: 'video/mp4',
        fileName: job.project.video.fileName.replace(/\.[^.]+$/, '') + '-cut.mp4',
      },
      clickPoints: remapClickPoints(job.project.clickPoints, job.cuts),
    }, job.projectEtag);
    job.status = 'completed';
    await writeCutJob(job, lease);
  } catch (error) {
    context.error('[video-cut:worker]', error);
    if (job) {
      // A host interruption after publication is recovered as completed on the next tick.
      const current = await readProjectVersion(job.projectId);
      if (current?.project.video.videoId === `${job.projectId}~${job.id}`) {
        job.status = 'completed';
      } else {
        job.status = 'failed';
        job.error = 'Conversion failed. Your original video and click points have not been changed. Please retry.';
      }
      await writeCutJob(job, lease);
    }
  } finally {
    clearTimeout(timeout);
    clearInterval(renewal);
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      await lease.releaseLease();
    }
  }
}

export async function handler(_timer: unknown, context: InvocationContext): Promise<void> {
  const masters = await ensureContainer('masters');
  for await (const item of masters.listBlobsFlat({ prefix: 'video-cuts/' })) {
    const id = item.name.slice('video-cuts/'.length, -'.json'.length);
    const job = await readCutJob(id);
    if (!isCutJobActive(job)) continue;
    // Allow the initiating HTTP request to finish acquiring the project revision.
    if (job.status === 'preparing' && Date.now() - Date.parse(job.createdAt) < 15_000) continue;
    await processCutJob(id, context);
    break;
  }
}

app.timer('video-cut-worker', {
  schedule: '*/15 * * * * *', useMonitor: true, handler,
});
