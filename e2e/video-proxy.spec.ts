import { test, expect } from '@playwright/test';

/**
 * 動画プロキシ (B-1) の API スモーク。
 * ストレージ復旧前でも「エンドポイントが配信済みで認証保護されている」ことを検証できる。
 * (未認証は 401。ストレージ到達性とは独立)
 */
test.describe('動画プロキシ API', () => {
  test('未認証の /api/videos/{id}/stream は 401', async ({ request }) => {
    const res = await request.get('/api/videos/__nonexistent__/stream');
    expect([401, 403]).toContain(res.status());
  });

  test('未認証の /api/videos/{id} (メタ) は 401', async ({ request }) => {
    const res = await request.get('/api/videos/__nonexistent__');
    expect([401, 403]).toContain(res.status());
  });

  test('未認証の /api/videos/upload は 401', async ({ request }) => {
    const res = await request.post('/api/videos/upload?projectId=x&mimeType=video/mp4', {
      data: 'dummy',
      headers: { 'Content-Type': 'video/mp4' },
    });
    expect([401, 403]).toContain(res.status());
  });
});
