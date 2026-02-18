/**
 * DELETE /api/videos/{projectId}
 * 動画削除 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as blobService from '../services/blobService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  const projectId = req.params.projectId;
  if (!projectId) return { status: 400, jsonBody: { error: 'projectId は必須です' } };

  try {
    await blobService.deleteProjectVideo(projectId);
    return { status: 200, jsonBody: { message: '動画を削除しました' } };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('videos-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'videos/{projectId}',
  handler,
});
