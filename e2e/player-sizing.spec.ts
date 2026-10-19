import { test, expect, type Page } from '@playwright/test';
import { createDefaultProject, type DemoProject } from '../src/types';

async function openPlayer(page: Page, width = 320, height = 180) {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    json: { authenticated: true, role: 'viewer', creatorId: 'guest' },
  }));
  await page.goto('/login');
  const bytes = await page.evaluate(async ({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    context.fillStyle = '#2780cc';
    context.fillRect(0, 0, width, height);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 300));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  }, { width, height });
  const project: DemoProject = {
    ...createDefaultProject({
      title: 'Sizing test',
      video: {
        videoId: 'sizing-test', fileName: 'test.webm', mimeType: 'video/webm',
        width, height, duration: 1, thumbnailDataUrl: '',
      },
    }),
    id: 'sizing-test',
    createdAt: '2026-10-19T00:00:00Z',
    updatedAt: '2026-10-19T00:00:00Z',
  };
  project.clickPoints.push({
    id: 'sizing-point', timestamp: 0, position: { x: 25, y: 75 },
    area: { type: 'circle', radius: 20 }, description: '',
    descriptionOffset: { x: 5, y: -10 },
    descriptionStyle: project.settings.defaultDescriptionStyle,
    order: 0, pulseSpeed: 1,
  });
  await page.route('**/api/projects/sizing-test', (route) => route.fulfill({ json: project }));
  await page.route('**/api/videos/sizing-test', (route) => route.fulfill({
    json: { url: '/api/videos/sizing-test/stream' },
  }));
  await page.route('**/api/videos/sizing-test/stream', (route) => route.fulfill({
    contentType: 'video/webm', body: Buffer.from(bytes),
  }));
  await page.route('**/api/usage/demo', (route) => route.fulfill({ json: { ok: true } }));
  await page.evaluate(() => localStorage.setItem('conference-mode-hide-shortcuts', 'true'));
  await page.goto('/player/sizing-test?lang=en');
  await expect(page.getByRole('button', { name: 'Start Playback', exact: true })).toBeVisible();
}

async function expectSize(page: Page, width: number, height: number) {
  const video = page.locator('video');
  await expect.poll(async () => (await video.boundingBox())?.width).toBeCloseTo(width, 0);
  await expect.poll(async () => (await video.boundingBox())?.height).toBeCloseTo(height, 0);
  const bounds = await video.boundingBox();
  expect(bounds).not.toBeNull();
  const overlay = await video.locator('..').locator(':scope > div').boundingBox();
  expect(overlay).toEqual(bounds);
}

test.describe('Player video sizing', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('small video fills available area by default and can be toggled with mouse and keyboard', async ({ page }) => {
    await openPlayer(page);
    const toggle = page.getByRole('button', { name: 'Fit video to screen', exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expectSize(page, 1280, 720);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expectSize(page, 320, 180);
    await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expectSize(page, 1280, 720);
    await expect(page.getByRole('button', { name: 'Start Playback', exact: true })).toBeVisible();
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expectSize(page, 320, 180);
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Start Playback', exact: true })).toBeVisible();

    await page.setViewportSize({ width: 800, height: 1000 });
    await expectSize(page, 800, 450);
    await page.reload();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expectSize(page, 800, 450);
  });

  test('portrait video preserves its aspect ratio and fits the available height', async ({ page }) => {
    await openPlayer(page, 180, 320);
    await expectSize(page, 405, 720);
    await page.getByRole('button', { name: 'Fit video to screen', exact: true }).click();
    await expectSize(page, 180, 320);
  });

  test('click points stay aligned and playback stays paused when sizing changes', async ({ page }) => {
    await openPlayer(page);
    await page.getByRole('button', { name: 'Start Playback', exact: true }).click();
    const clickPoint = page.locator('video').locator('..').locator('[style*="clickPointPulse"]');
    await expect(clickPoint).toBeVisible();
    for (const fit of [true, false]) {
      if (!fit) {
        await page.getByRole('button', { name: 'Fit video to screen', exact: true }).press('Space');
      }
      await expectSize(page, fit ? 1280 : 320, fit ? 720 : 180);
      const videoBounds = await page.locator('video').boundingBox();
      const pointBounds = await clickPoint.boundingBox();
      if (!videoBounds || !pointBounds) throw new Error('Missing video or click point bounds');
      expect(pointBounds.x + pointBounds.width / 2).toBeCloseTo(videoBounds.x + videoBounds.width * 0.25, 0);
      expect(pointBounds.y + pointBounds.height / 2).toBeCloseTo(videoBounds.y + videoBounds.height * 0.75, 0);
      expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    }
    const pointBounds = await clickPoint.boundingBox();
    if (!pointBounds) throw new Error('Missing click point bounds');
    await page.mouse.click(pointBounds.x + pointBounds.width / 2, pointBounds.y + pointBounds.height / 2);
    await expect(clickPoint).toBeHidden();
  });

  test('large video remains constrained in both modes', async ({ page }) => {
    await openPlayer(page, 1920, 1080);
    await expectSize(page, 1280, 720);
    await page.getByRole('button', { name: 'Fit video to screen', exact: true }).click();
    await expectSize(page, 1280, 720);
    await page.setViewportSize({ width: 800, height: 1000 });
    await expectSize(page, 800, 450);
  });

  test('conference mode uses the full viewport and retains the selected sizing mode', async ({ page }) => {
    await openPlayer(page);
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.getByRole('button', { name: 'Conference Mode', exact: true }).click();
    await expectSize(page, 800 * 16 / 9, 800);
    await page.keyboard.press('Escape');
    await expectSize(page, 1280, 720);
    await page.getByRole('button', { name: 'Fit video to screen', exact: true }).click();
    await page.getByRole('button', { name: 'Conference Mode', exact: true }).click();
    await expectSize(page, 320, 180);
    await page.keyboard.press('Escape');
    await expectSize(page, 320, 180);
  });
});
