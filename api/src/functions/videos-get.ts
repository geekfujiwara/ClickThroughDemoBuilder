/**
 * GET /api/videos/{projectId}
 * 動画の SAS URL を返す (viewer / designer)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as blobService from '../services/blobService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const projectId = req.params.projectId;
  if (!projectId) return { status: 400, jsonBody: { error: 'projectId は必須です' } };

  try {
    const url = await blobService.getVideoSasUrl(projectId);
    if (!url) return { status: 404, jsonBody: { error: '動画が見つかりません' } };
    return { status: 200, jsonBody: { url } };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('videos-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{projectId}',
  handler,
});
