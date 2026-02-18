/**
 * GET /api/groups
 * グループマスター一覧取得
 * 登録フォームのグループ選択用に権限不要（認証済はより多く取得可）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { authenticate } from '../middleware/auth.js';
import * as groupService from '../services/groupService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  // 認証㠡5要だが、未認証でも空配列を返すだけなので公開する
  void authenticate(req); // お気に入りログイン状態保持のために呼び出すだけ
  try {
    const groups = await groupService.getAllGroups();
    return { status: 200, jsonBody: groups };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('groups-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'groups',
  handler,
});
