import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { InvocationContext } from '@azure/functions';
import { ensureContainer } from './blobService.js';
import { isStorageConflict } from './videoCutService.js';
import { prepareMediaTools, probeVideo } from './videoConversionService.js';
import type { DemoProject } from '../shared/types.js';
import type { AudioWaveform } from '../shared/videoCuts.js';

interface WaveformJob extends AudioWaveform {
  sourceName: string;
  sourceEtag: string;
  attempts: number;
}

function publicWaveform(job: WaveformJob): AudioWaveform {
  return {
    status: job.status, videoId: job.videoId, duration: job.duration,
    peaks: job.peaks, hasAudio: job.hasAudio, error: job.error,
  };
}

export async function requestWaveform(project: DemoProject, retry = false): Promise<AudioWaveform> {
  if (!Number.isFinite(project.video.duration) || project.video.duration <= 0) throw new Error('Invalid video duration.');
  const sourceName = `${project.video.videoId}/video.${project.video.mimeType === 'video/webm' ? 'webm' : 'mp4'}`;
  const source = (await ensureContainer('videos')).getBlockBlobClient(sourceName);
  const properties = await source.getProperties();
  if (!properties.etag) throw new Error('Missing video revision.');
  const key = createHash('sha256').update(`${sourceName}:${properties.etag}`).digest('hex');
  const blob = (await ensureContainer('masters')).getBlockBlobClient(`waveforms/${key}.json`);
  const job: WaveformJob = {
    status: 'queued', videoId: project.video.videoId, duration: project.video.duration,
    peaks: [], hasAudio: false, sourceName, sourceEtag: properties.etag, attempts: 0,
  };
  try {
    const previous = await blob.getProperties();
    const text = await blob.downloadToBuffer(0, undefined, { conditions: { ifMatch: previous.etag } });
    const stored = JSON.parse(text.toString()) as WaveformJob;
    if (stored.status !== 'failed' || !retry) return publicWaveform(stored);
    const body = JSON.stringify(job);
    await blob.upload(body, Buffer.byteLength(body), { conditions: { ifMatch: previous.etag } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404) {
      const body = JSON.stringify(job);
      try {
        await blob.upload(body, Buffer.byteLength(body), { conditions: { ifNoneMatch: '*' } });
      } catch (conflict) {
        if (!isStorageConflict(conflict)) throw conflict;
        return publicWaveform(JSON.parse((await blob.downloadToBuffer()).toString()) as WaveformJob);
      }
    } else if (isStorageConflict(error)) {
      return publicWaveform(JSON.parse((await blob.downloadToBuffer()).toString()) as WaveformJob);
    } else throw error;
  }
  return publicWaveform(job);
}

// Decode to a bounded peak envelope rather than retaining the entire uncompressed soundtrack.
export async function extractWaveform(input: string, duration: number, signal?: AbortSignal): Promise<{ peaks: number[]; hasAudio: boolean }> {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid video duration.');
  const { encoder, probe } = await prepareMediaTools(dirname(input));
  const info = await probeVideo(input, signal, probe);
  if (!info.streams.some((stream) => stream.codec_type === 'audio')) return { peaks: [], hasAudio: false };
  const count = Math.min(8192, Math.max(1, Math.ceil(duration * 40)));
  const peaks = Array<number>(count).fill(0);
  const sampleRate = 8000;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(encoder, [
      '-nostdin', '-v', 'error', '-i', input, '-vn', '-af', 'aresample=8000:async=1:first_pts=0',
      '-ac', '1', '-ar', String(sampleRate), '-t', String(duration), '-f', 's16le', 'pipe:1',
    ], { windowsHide: true, signal });
    let samples = 0;
    let pending: Buffer = Buffer.alloc(0);
    let errors = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const data = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      const end = data.length - data.length % 2;
      for (let offset = 0; offset < end; offset += 2) {
        const bucket = Math.min(count - 1, Math.floor(samples++ / sampleRate / duration * count));
        peaks[bucket] = Math.max(peaks[bucket], Math.abs(data.readInt16LE(offset)) / 32768);
      }
      pending = data.subarray(end);
    });
    child.stderr.on('data', (data: Buffer) => { errors = (errors + data.toString()).slice(-4000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Waveform decode failed (${code}): ${errors}`));
    });
  });
  return { hasAudio: true, peaks: peaks.map((value) => Math.round(value * 10000) / 10000) };
}

export async function processWaveform(name: string, context: InvocationContext): Promise<void> {
  const blob = (await ensureContainer('masters')).getBlockBlobClient(name);
  const lease = blob.getBlobLeaseClient();
  try { await lease.acquireLease(60); } catch (error) {
    if (isStorageConflict(error)) return;
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60_000);
  let renewing = false;
  const renew = setInterval(() => {
    if (renewing) return;
    renewing = true;
    void lease.renewLease().catch((error: unknown) => {
      context.error('[waveform:lease]', error);
      controller.abort(error);
    }).finally(() => { renewing = false; });
  }, 20_000);
  let directory: string | undefined;
  let job: WaveformJob | undefined;
  const save = async () => {
    const text = JSON.stringify(job);
    await blob.upload(text, Buffer.byteLength(text), { conditions: { leaseId: lease.leaseId } });
  };
  try {
    job = JSON.parse((await blob.downloadToBuffer()).toString()) as WaveformJob;
    if (job.status !== 'queued' && job.status !== 'processing') return;
    if (job.attempts >= 3) throw new Error('Waveform processing interrupted repeatedly.');
    job.status = 'processing';
    job.attempts++;
    await save();
    directory = await mkdtemp(join(tmpdir(), 'clickthrough-waveform-'));
    const input = join(directory, 'source');
    await (await ensureContainer('videos')).getBlockBlobClient(job.sourceName).downloadToFile(input, 0, undefined, {
      conditions: { ifMatch: job.sourceEtag }, abortSignal: controller.signal,
    });
    const waveform = await extractWaveform(input, job.duration, controller.signal);
    Object.assign(job, waveform, { status: 'completed' });
    await save();
  } catch (error) {
    context.error('[waveform]', error);
    if (job) {
      job.status = 'failed';
      job.error = 'Could not generate the audio waveform. Please retry.';
      await save();
    }
  } finally {
    clearTimeout(timeout);
    clearInterval(renew);
    try { if (directory) await rm(directory, { recursive: true, force: true }); }
    finally { await lease.releaseLease(); }
  }
}

export async function processNextWaveform(context: InvocationContext): Promise<void> {
  const masters = await ensureContainer('masters');
  for await (const item of masters.listBlobsFlat({ prefix: 'waveforms/' })) {
    const job = JSON.parse((await masters.getBlockBlobClient(item.name).downloadToBuffer()).toString()) as WaveformJob;
    if (job.status !== 'queued' && job.status !== 'processing') continue;
    await processWaveform(item.name, context);
    break;
  }
}
