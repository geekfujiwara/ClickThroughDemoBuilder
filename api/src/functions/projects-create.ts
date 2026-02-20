/**
 * POST /api/projects
 * プロジェクト作成 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';
import type { DemoProject } from '../shared/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_CLICK_POINTS = 50;

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  try {
    const body = (await req.json()) as DemoProject;
    if (!body.id || !UUID_RE.test(body.id)) {
      return { status: 400, jsonBody: { error: 'id は有効な UUID 形式で必須です' } };
    }
    // 入力バリデーション
    if (body.title && body.title.length > MAX_TITLE_LENGTH) {
      return { status: 400, jsonBody: { error: `タイトルは${MAX_TITLE_LENGTH}文字以内です` } };
    }
    if (body.description && body.description.length > MAX_DESCRIPTION_LENGTH) {
      return { status: 400, jsonBody: { error: `説明は${MAX_DESCRIPTION_LENGTH}文字以内です` } };
    }
    if (Array.isArray(body.clickPoints) && body.clickPoints.length > MAX_CLICK_POINTS) {
      return { status: 400, jsonBody: { error: `クリックポイントは最大${MAX_CLICK_POINTS}個です` } };
    }
    // creatorId をサーバー側で強制設定
    body.creatorId = auth.payload.creatorId;
    await projectService.createProject(body);
    return { status: 201, jsonBody: body };
  } catch {
    return { status: 500, jsonBody: { error: 'プロジェクトの作成に失敗しました' } };
  }
}

app.http('projects-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'projects',
  handler,
});
