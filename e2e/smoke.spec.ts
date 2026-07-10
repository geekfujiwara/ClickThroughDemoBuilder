import { test, expect } from '@playwright/test';

/**
 * 公開スモークテスト — 認証不要で常に実行可能。
 * 静的フロントが配信され、ログイン画面が正しく描画されることを検証する。
 */
test.describe('公開スモーク', () => {
  test('ルートアクセスでログイン画面が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Click Through Demo Builder' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Microsoft/i })).toBeVisible();
  });

  test('ページタイトルが正しい', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Click Through Demo Builder/i);
  });
});
