import { randomUUID } from 'node:crypto';
import type { BlobLeaseClient } from '@azure/storage-blob';
import type { DemoProject } from '../shared/types.js';
import { isCutJobActive, normalizeCuts, type VideoCutJob } from '../shared/videoCuts.js';
import { ensureContainer } from './blobService.js';

export interface StoredCutJob extends VideoCutJob {
  project: DemoProject;
  projectEtag: string;
  sourceEtag: string;
  attempts: number;
}

export class CutConflictError extends Error {}

export function isStorageConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    && (error.statusCode === 409 || error.statusCode === 412);
}

export async function readProjectVersion(id: string): Promise<{ project: DemoProject; etag: string } | null> {
  const blob = (await ensureContainer('projects')).getBlockBlobClient(`${id}.json`);
  try {
    // Bind the body to the revision whose ETag will be used for publication.
    const properties = await blob.getProperties();
    const body = await blob.downloadToBuffer(0, undefined, { conditions: { ifMatch: properties.etag } });
    if (!properties.etag) throw new Error('Missing project ETag');
    return { project: JSON.parse(body.toString()) as DemoProject, etag: properties.etag };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 404) return null;
    throw error;
  }
}

export async function writeProjectVersion(project: DemoProject, etag: string): Promise<string> {
  const body = JSON.stringify(project);
  const response = await (await ensureContainer('projects')).getBlockBlobClient(`${project.id}.json`)
    .upload(body, Buffer.byteLength(body), {
      conditions: { ifMatch: etag },
      blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
    });
  if (!response.etag) throw new Error('Missing project ETag after write');
  return response.etag;
}

export async function jobBlob(id: string) {
  return (await ensureContainer('masters')).getBlockBlobClient(`video-cuts/${id}.json`);
}

export async function readCutJob(id: string): Promise<StoredCutJob> {
  const body = await (await jobBlob(id)).downloadToBuffer();
  return JSON.parse(body.toString()) as StoredCutJob;
}

export async function writeCutJob(job: StoredCutJob, lease?: BlobLeaseClient): Promise<void> {
  job.updatedAt = new Date().toISOString();
  const body = JSON.stringify(job);
  await (await jobBlob(job.id)).upload(body, Buffer.byteLength(body), {
    conditions: lease ? { leaseId: lease.leaseId } : { ifNoneMatch: '*' },
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

export function publicCutJob(job: StoredCutJob): VideoCutJob {
  return {
    id: job.id, projectId: job.projectId, status: job.status, cuts: job.cuts,
    createdAt: job.createdAt, updatedAt: job.updatedAt, error: job.error,
  };
}

export async function assertNoActiveCut(project: DemoProject): Promise<void> {
  if (project.videoCutJobId && isCutJobActive(await readCutJob(project.videoCutJobId))) {
    throw new CutConflictError('Video conversion is in progress. Wait for it to finish.');
  }
}

export async function createCutJob(project: DemoProject, etag: string, input: unknown): Promise<StoredCutJob> {
  await assertNoActiveCut(project);
  const cuts = normalizeCuts(input, project.video.duration);
  const id = randomUUID();
  const source = (await ensureContainer('videos')).getBlockBlobClient(
    `${project.video.videoId}/video.${project.video.mimeType === 'video/webm' ? 'webm' : 'mp4'}`,
  );
  const sourceProperties = await source.getProperties();
  if (!sourceProperties.etag) throw new Error('Missing source video ETag');
  const now = new Date().toISOString();
  const updatedProject = { ...project, videoCutJobId: id, updatedAt: now };
  const job: StoredCutJob = {
    id, projectId: project.id, status: 'preparing', cuts, createdAt: now, updatedAt: now,
    project: updatedProject, projectEtag: etag, sourceEtag: sourceProperties.etag, attempts: 0,
  };
  await writeCutJob(job);
  try {
    job.projectEtag = await writeProjectVersion(updatedProject, etag);
  } catch (error) {
    // The worker marks an uncommitted preparing job as failed; no video is modified.
    if (isStorageConflict(error)) throw new CutConflictError('The project changed. Reload it before cutting.');
    throw error;
  }
  // Preparing is durable: the timer recovers even if the request ends here.
  return job;
}
