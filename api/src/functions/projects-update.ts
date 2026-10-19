/**
 * PUT /api/projects/{id}
 * プロジェクト更新 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import type { DemoProject } from '../shared/types.js';
import {
  assertNoActiveCut, CutConflictError, isStorageConflict, readProjectVersion, writeProjectVersion,
} from '../services/videoCutService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  const id = req.params.id;
  if (!id) return { status: 400, jsonBody: { error: 'id は必須です' } };

  try {
    // 所有者チェック (IDOR 防止)
    const version = await readProjectVersion(id);
    const existing = version?.project;
    if (!existing || !version) return { status: 404, jsonBody: { error: 'プロジェクトが見つかりません' } };
    if (existing.creatorId && existing.creatorId !== auth.payload.creatorId) {
      return { status: 403, jsonBody: { error: '他のデザイナーのプロジェクトは更新できません' } };
    }

    const body = (await req.json()) as DemoProject;
    if (existing.videoCutJobId !== body.videoCutJobId) {
      return { status: 409, jsonBody: { error: 'The video was edited. Reload the project before saving.' } };
    }
    await assertNoActiveCut(existing);
    body.id = id; // URL の id を優先
    body.creatorId = auth.payload.creatorId; // サーバー側で強制
    body.updatedAt = new Date().toISOString();
    await writeProjectVersion(body, version.etag);
    return { status: 200, jsonBody: body };
  } catch (error) {
    if (error instanceof CutConflictError || isStorageConflict(error)) {
      return { status: 409, jsonBody: { error: 'The project changed or video conversion is in progress. Reload before saving.' } };
    }
    _context.error('[projects-update]', error);
    return { status: 500, jsonBody: { error: 'プロジェクトの更新に失敗しました' } };
  }
}

app.http('projects-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'projects/{id}',
  handler,
});
