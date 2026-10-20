import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultProject, type DemoProject } from '../src/types';
import { remapClickPoints, type VideoCutJob } from '../api/src/shared/videoCuts';

const require = createRequire(new URL('../api/package.json', import.meta.url));
let media: Buffer;
test.beforeAll(() => {
  const directory = mkdtempSync(join(tmpdir(), 'timeline-e2e-'));
  try {
    const output = join(directory, 'video.webm');
    execFileSync(require('ffmpeg-static'), [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=30:d=6',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-c:v', 'libvpx',
      '-deadline', 'realtime', '-g', '30', '-c:a', 'libopus', output,
    ]);
    media = readFileSync(output);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

async function setup(page: Page, initialJob?: VideoCutJob, descriptions: Record<string, string> = {}) {
  const videoInfo = {
    videoId: 'cut-test', fileName: 'cut.webm', mimeType: 'video/webm' as const,
    width: 320, height: 180, duration: 6, thumbnailDataUrl: '',
  };
  const point = (id: string, timestamp: number, order: number) => ({
    id, timestamp, order, position: { x: 25, y: 50 }, area: { type: 'circle' as const, radius: 20 },
    description: descriptions[id] ?? id, descriptionOffset: { x: 5, y: -10 },
    descriptionStyle: createDefaultProject({ video: videoInfo }).settings.defaultDescriptionStyle,
    pulseSpeed: 1 as const,
  });
  let project: DemoProject = {
    ...createDefaultProject({ title: 'Video cut test', video: videoInfo, creatorId: 'owner' }),
    id: 'cut-test', createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z',
    clickPoints: [point('before', 0.5, 1), point('removed', 1.5, 2), point('after', 4.5, 3)],
    videoCutJobId: initialJob?.id,
  };
  let job = initialJob ?? null;
  let submitted: unknown;
  let completed = false;
  let statusFailure = false;
  let failConversion = false;
  let waveStatus = 'completed';
  let waveRetries = 0;
  await page.route('**/test-cut-video.webm', (route) => {
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '');
    if (!range) return route.fulfill({ contentType: 'video/webm', body: media });
    const start = Number(range[1]);
    const end = Math.min(media.length - 1, range[2] ? Number(range[2]) : media.length - 1);
    return route.fulfill({
      status: 206, contentType: 'video/webm', body: media.subarray(start, end + 1),
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${media.length}` },
    });
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/src/')) return route.continue();
    if (path === '/api/auth/me') return route.fulfill({ json: { authenticated: true, role: 'designer', creatorId: 'owner' } });
    if (path === '/api/creators/owner') return route.fulfill({ json: { id: 'owner', name: 'Owner', language: 'en', role: 'designer' } });
    if (path === '/api/creators') return route.fulfill({ json: [] });
    if (path === '/api/projects/cut-test') {
      if (request.method() === 'PUT') project = request.postDataJSON() as DemoProject;
      return route.fulfill({ json: project });
    }
    if (path === '/api/projects/cut-test/waveform') {
      if (request.method() === 'POST') { waveRetries++; waveStatus = 'completed'; }
      return route.fulfill({ json: {
        videoId: 'cut-test', status: waveStatus, duration: 6, hasAudio: true,
        peaks: waveStatus === 'completed' ? Array.from({ length: 240 }, (_, i) => (i % 10 + 1) / 30) : [],
      } });
    }
    if (path === '/api/projects/cut-test/video-cuts') {
      if (request.method() === 'POST') {
        submitted = request.postDataJSON();
        job = {
          id: 'cut-job', projectId: project.id, status: 'processing',
          ...request.postDataJSON(), createdAt: project.updatedAt, updatedAt: project.updatedAt,
        };
        project = { ...project, videoCutJobId: job!.id };
        return route.fulfill({ status: 202, json: job });
      }
      if (statusFailure) return route.fulfill({ status: 503, json: { error: 'Status unavailable' } });
      if (job && failConversion) job = { ...job, status: 'failed' };
      if (job && completed && job.status !== 'completed') {
        project = {
          ...project, updatedAt: '2026-10-19T01:00:00Z',
          video: { ...project.video, videoId: 'cut-test~cut-job',
            duration: 6 - job.cuts.reduce((sum, cut) => sum + cut.end - cut.start, 0), mimeType: 'video/mp4' },
          clickPoints: job.cuts.length ? remapClickPoints(project.clickPoints, job.cuts) : project.clickPoints,
        };
        job = { ...job, status: 'completed' };
      }
      return route.fulfill({ json: { job } });
    }
    if (path.startsWith('/api/videos/')) return route.fulfill({ json: { url: '/test-cut-video.webm' } });
    throw new Error(`Unexpected API request: ${request.method()} ${path}`);
  });
  await page.goto('/designer/cut-test?lang=en');
  if (initialJob) await expect(page.getByRole('dialog', { name: 'Edit video timeline', exact: true })).toBeVisible();
  else await expect(page.getByRole('button', { name: 'Edit video timeline', exact: true })).toBeEnabled();
  return {
    get submitted() { return submitted; },
    get project() { return project; },
    get waveRetries() { return waveRetries; },
    complete() { completed = true; },
    failStatus(value: boolean) { statusFailure = value; },
    failJob() { failConversion = true; },
    waveform(status: string) { waveStatus = status; },
  };
}

const timeline = (page: Page) => page.getByRole('group', { name: 'Editing timeline', exact: true });
const clips = (page: Page) => timeline(page).getByRole('button', { name: /^Clip \d+$/ });
const applyButton = (page: Page) => page.getByRole('button', { name: 'Apply edits and convert in cloud', exact: true });
async function open(page: Page) {
  await page.getByRole('button', { name: 'Edit video timeline', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Split (S)', exact: true })).toBeEnabled();
}
async function splitAt(page: Page, time: number) {
  await page.getByLabel('Playhead (seconds)', { exact: true }).fill(String(time));
  await timeline(page).focus();
  await page.keyboard.press('s');
}
async function selectClip(page: Page, number: number) {
  await page.getByRole('button', { name: `Clip ${number}`, exact: true }).focus();
  await page.keyboard.press('Enter');
}
async function deleteRange(page: Page, start: number, end: number) {
  await splitAt(page, start);
  await splitAt(page, end);
  await selectClip(page, 2);
  await page.keyboard.press('Delete');
}

test('first open receives valid JSON and renders the actual waveform', async ({ page }) => {
  await setup(page);
  const response = page.waitForResponse((r) => r.url().endsWith('/video-cuts') && r.request().method() === 'GET');
  await open(page);
  expect(await (await response).json()).toEqual({ job: null });
  await expect(clips(page)).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Audio waveform: Clip 1', exact: true }).locator('path')).toHaveCount(2);
  await expect(applyButton(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Clip 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Clip 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/Unexpected end of JSON/)).toHaveCount(0);
});

test('click point cards show descriptions below markers and follow ripple edits', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const description = `First line\n${'A long explanation without truncation. '.repeat(12)}\nLast line <b>plain text</b>`;
  await setup(page, undefined, { before: description, after: '' });
  await open(page);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const first = timeline(page).locator('[data-click-point-id="before"]');
  await first.hover();
  const card = page.getByRole('tooltip');
  await expect(card).toContainText(description);
  await expect(card.locator('b')).toHaveCount(0);
  const markerBox = (await first.boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  expect(cardBox.y).toBeGreaterThanOrEqual(markerBox.y + markerBox.height);
  await expect(page.getByLabel('Playhead (seconds)', { exact: true })).toHaveValue('0');
  await first.click();
  await expect(page.getByLabel('Playhead (seconds)', { exact: true })).toHaveValue('0.5');
  await expect(clips(page).first()).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);
  await timeline(page).focus();
  await first.focus();
  await expect(card).toContainText(description);
  await deleteRange(page, 1, 2);
  await expect(timeline(page).locator('[data-click-point-id="removed"]')).toHaveCount(0);
  const after = timeline(page).locator('[data-click-point-id="after"]');
  await after.hover();
  await expect(card).toContainText('Click point 3 / 00:03.5');
  await expect(card).toContainText('No description.');
  await page.getByRole('button', { name: 'Maximize video editor', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom timeline in', exact: true }).click();
  await after.scrollIntoViewIfNeeded();
  await after.hover();
  await expect(card).toBeInViewport();
  await expect(card).toContainText('Click point 3 / 00:03.5');
  await page.setViewportSize({ width: 800, height: 600 });
  await after.scrollIntoViewIfNeeded();
  await after.hover();
  await expect(card).toBeInViewport();
  const compactCard = (await card.boundingBox())!;
  expect(compactCard.x).toBeGreaterThanOrEqual(0);
  expect(compactCard.x + compactCard.width).toBeLessThanOrEqual(800);
});

test('editor maximizes and restores without losing edits, selection, playhead or history', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await setup(page);
  await open(page);
  await splitAt(page, 2);
  await page.getByRole('button', { name: 'Mute selected clip', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom timeline in', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit video timeline', exact: true });
  const original = (await dialog.boundingBox())!;
  const preview = page.getByLabel('Edit preview', { exact: true });
  const sourceTime = await preview.evaluate((video: HTMLVideoElement) => video.currentTime);
  await page.getByRole('button', { name: 'Maximize video editor', exact: true }).click();
  const expanded = (await dialog.boundingBox())!;
  expect(expanded.x).toBeCloseTo(0, 0);
  expect(expanded.y).toBeCloseTo(0, 0);
  expect(expanded.width).toBe(1600);
  expect(expanded.height).toBe(1000);
  expect(expanded.width).toBeGreaterThan(original.width);
  await expect(clips(page)).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Clip 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Mute selected clip', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Playhead (seconds)', { exact: true })).toHaveValue('2');
  await expect(preview).toHaveJSProperty('currentTime', sourceTime);
  await expect(dialog.getByText('2x', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore video editor size', exact: true }).click();
  const restored = (await dialog.boundingBox())!;
  expect(restored.width).toBeCloseTo(original.width, 0);
  expect(restored.height).toBeCloseTo(original.height, 0);
  await expect(page.getByLabel('Playhead (seconds)', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Undo edit (Ctrl+Z)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute selected clip', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.setViewportSize({ width: 800, height: 600 });
  await page.getByRole('button', { name: 'Maximize video editor', exact: true }).click();
  const compact = (await dialog.boundingBox())!;
  expect(compact.width).toBe(800);
  expect(compact.height).toBe(600);
  await expect(applyButton(page)).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Restore video editor size', exact: true })).toBeInViewport();
});

test('S and Delete ripple multiple clips, confirm conversion, and remap points', async ({ page }) => {
  const state = await setup(page);
  await open(page);
  await deleteRange(page, 1, 2);
  await splitAt(page, 2);
  await splitAt(page, 3);
  await selectClip(page, 3);
  await page.keyboard.press('Delete');
  await expect(page.getByText('After editing: 4.00 seconds / Points to delete: 1')).toBeVisible();
  await expect(timeline(page).locator('[data-click-point-id]')).toHaveCount(2);
  await applyButton(page).click();
  await expect(page.getByText(/1 click points inside deleted clips/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.submitted).toBeUndefined();
  await applyButton(page).click();
  await applyButton(page).click();
  await expect(page.getByText(/Converting video in the cloud/)).toBeVisible();
  expect(state.submitted).toEqual({
    cuts: [{ start: 1, end: 2 }, { start: 3, end: 4 }], muteRanges: [], muteAll: false,
    videoId: 'cut-test', updatedAt: '2026-10-19T00:00:00Z',
  });
  await expect(page.getByRole('button', { name: 'Split (S)', exact: true })).toBeDisabled();
  state.complete();
  await expect(page.getByText('Video editing completed. The video and click point times have been updated.')).toBeVisible({ timeout: 10000 });
  expect(state.project.clickPoints.map((point) => [point.id, point.timestamp])).toEqual([['before', 0.5], ['after', 2.5]]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('history, safe shortcuts, frame stepping, dragging and zoom work without deleting the whole video', async ({ page }) => {
  await setup(page);
  await open(page);
  await selectClip(page, 1);
  await page.keyboard.press('Delete');
  await expect(page.getByText(/Keep at least 0.1 seconds/)).toBeVisible();
  await page.getByLabel('Playhead (seconds)', { exact: true }).fill('2');
  await page.keyboard.press('s');
  await page.keyboard.press('Delete');
  await expect(clips(page)).toHaveCount(1);
  await splitAt(page, 2);
  await expect(clips(page)).toHaveCount(2);
  await expect(applyButton(page)).toBeDisabled();
  await page.keyboard.press('Control+z');
  await expect(clips(page)).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(clips(page)).toHaveCount(2);
  await timeline(page).focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Playhead (seconds)', { exact: true })).toHaveValue('0.033');
  const box = (await timeline(page).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + 10);
  await page.mouse.up();
  expect(Number(await page.getByLabel('Playhead (seconds)', { exact: true }).inputValue())).toBeCloseTo(4.5, 1);
  await page.getByRole('button', { name: 'Zoom timeline in', exact: true }).click();
  expect((await timeline(page).boundingBox())!.width).toBeCloseTo(box.width * 2, 0);
});

test('clip and entire-video mute update preview and submit mute-only edits without moving points', async ({ page }) => {
  const state = await setup(page);
  await open(page);
  await splitAt(page, 2);
  await page.getByRole('button', { name: 'Mute selected clip', exact: true }).click();
  const preview = page.getByLabel('Edit preview', { exact: true });
  await expect(preview).toHaveJSProperty('muted', true);
  await page.getByLabel('Playhead (seconds)', { exact: true }).fill('1');
  await expect(preview).toHaveJSProperty('muted', false);
  await page.getByRole('button', { name: 'Mute entire video', exact: true }).click();
  await expect(preview).toHaveJSProperty('muted', true);
  await expect(page.getByRole('button', { name: 'Mute selected clip', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Mute entire video', exact: true }).click();
  await expect(preview).toHaveJSProperty('muted', false);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(preview).toHaveJSProperty('muted', true, { timeout: 4000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await applyButton(page).click();
  await applyButton(page).click();
  expect(state.submitted).toMatchObject({ cuts: [], muteAll: false, muteRanges: [{ start: 2, end: 6 }] });
  state.complete();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
  expect(state.project.clickPoints.map((point) => point.timestamp)).toEqual([0.5, 1.5, 4.5]);
});

test('preview skips ripple-deleted footage and plays from edited time to the end', async ({ page }) => {
  await setup(page);
  await open(page);
  await deleteRange(page, 1, 2);
  await page.getByLabel('Playhead (seconds)', { exact: true }).fill('0.9');
  const preview = page.getByLabel('Edit preview', { exact: true });
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(0.9, 1);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => preview.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByLabel('Playhead (seconds)', { exact: true }).fill('4.8');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByLabel('Playhead (seconds)', { exact: true })).toHaveValue('5');
});

test('pending and failed waveforms do not block editing and can be retried', async ({ page }) => {
  const state = await setup(page);
  state.waveform('queued');
  await open(page);
  await expect(page.getByText(/Generating the audio waveform/)).toBeVisible();
  await splitAt(page, 2);
  state.waveform('failed');
  await expect(page.getByText(/Could not generate the audio waveform/)).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Reload waveform', exact: true }).click();
  await expect(page.getByText(/Showing the actual audio waveform/)).toBeVisible();
  expect(state.waveRetries).toBe(1);
  await expect(clips(page)).toHaveCount(2);
});

test('active job restores cuts and mute state; status errors require retry', async ({ page }) => {
  const state = await setup(page, {
    id: 'existing-job', projectId: 'cut-test', status: 'processing', cuts: [{ start: 1, end: 2 }],
    muteAll: true, muteRanges: [], createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z',
  });
  await expect(page.getByText(/Converting video in the cloud/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mute entire video', exact: true })).toHaveAttribute('aria-pressed', 'true');
  state.failStatus(true);
  await expect(page.getByText('Status unavailable')).toBeVisible({ timeout: 10000 });
  await expect(applyButton(page)).toBeDisabled();
  state.failStatus(false);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Status unavailable')).toHaveCount(0);
  state.failJob();
  await expect(page.getByText('Conversion failed. Your original video and click points have not been changed.')).toBeVisible({ timeout: 10000 });
  await expect(applyButton(page)).toBeEnabled();
});
