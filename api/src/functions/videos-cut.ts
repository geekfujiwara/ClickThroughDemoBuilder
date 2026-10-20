import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import {
  createCutJob, CutConflictError, isStorageConflict, publicCutJob, readCutJob, readProjectVersion,
} from '../services/videoCutService.js';
import { normalizeVideoEdits, type VideoCutStatus } from '../shared/videoCuts.js';

export async function handler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;
  const id = req.params.id;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return { status: 400, jsonBody: { error: 'Invalid project ID.' } };
  }
  try {
    const version = await readProjectVersion(id);
    if (!version) return { status: 404, jsonBody: { error: 'Project not found.' } };
    if (version.project.creatorId && version.project.creatorId !== auth.payload.creatorId) {
      return { status: 403, jsonBody: { error: 'Only the project owner can edit this video.' } };
    }
    if (req.method === 'GET') {
      const jobId = version.project.videoCutJobId;
      const status: VideoCutStatus = { job: jobId ? publicCutJob(await readCutJob(jobId)) : null };
      return { jsonBody: status };
    }
    let body: { cuts?: unknown; videoId?: unknown; updatedAt?: unknown; muteRanges?: unknown; muteAll?: unknown };
    try {
      body = await req.json() as typeof body;
      if (!body || typeof body !== 'object') throw new Error('Invalid request');
      normalizeVideoEdits(body.cuts, body.muteRanges, body.muteAll, version.project.video.duration);
    } catch (error) {
      return { status: 400, jsonBody: { error: error instanceof Error ? error.message : 'Invalid cut ranges.' } };
    }
    if (body.videoId !== version.project.video.videoId || body.updatedAt !== version.project.updatedAt) {
      return { status: 409, jsonBody: { error: 'The project changed. Reload it before cutting.' } };
    }
    const job = await createCutJob(version.project, version.etag, body.cuts, body.muteRanges, body.muteAll);
    return { status: 202, jsonBody: publicCutJob(job) };
  } catch (error) {
    if (error instanceof CutConflictError || isStorageConflict(error)) {
      return { status: 409, jsonBody: { error: error instanceof Error ? error.message : 'Project conflict.' } };
    }
    context.error('[videos-cut]', error);
    return { status: 500, jsonBody: { error: 'Could not start or retrieve video conversion.' } };
  }
}

app.http('videos-cut', {
  methods: ['GET', 'POST'], authLevel: 'anonymous', route: 'projects/{id}/video-cuts', handler,
});
