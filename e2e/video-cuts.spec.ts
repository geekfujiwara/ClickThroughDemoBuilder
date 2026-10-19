import { test, expect, type Page } from '@playwright/test';
import { createDefaultProject, type DemoProject } from '../src/types';
import { remapClickPoints, type VideoCutJob } from '../api/src/shared/videoCuts';

async function setup(page: Page, initialJob?: VideoCutJob) {
  const point = (id: string, timestamp: number, order: number) => ({
    id, timestamp, order, position: { x: 25, y: 50 }, area: { type: 'circle' as const, radius: 20 },
    description: id, descriptionOffset: { x: 5, y: -10 },
    descriptionStyle: createDefaultProject({ video: videoInfo }).settings.defaultDescriptionStyle,
    pulseSpeed: 1 as const,
  });
  const videoInfo = {
    videoId: 'cut-test', fileName: 'cut.webm', mimeType: 'video/webm' as const,
    width: 320, height: 180, duration: 6, thumbnailDataUrl: '',
  };
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
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/src/')) return route.continue();
    if (path === '/api/auth/me') {
      return route.fulfill({ json: { authenticated: true, role: 'designer', creatorId: 'owner' } });
    }
    if (path === '/api/creators/owner') return route.fulfill({ json: { id: 'owner', name: 'Owner', language: 'en', role: 'designer' } });
    if (path === '/api/creators') return route.fulfill({ json: [] });
    if (path === '/api/projects/cut-test') {
      if (request.method() === 'PUT') project = request.postDataJSON() as DemoProject;
      return route.fulfill({ json: project });
    }
    if (path === '/api/projects/cut-test/video-cuts') {
      if (request.method() === 'POST') {
        submitted = request.postDataJSON();
        job = {
          id: 'cut-job', projectId: project.id, status: 'processing',
          cuts: request.postDataJSON().cuts, createdAt: project.updatedAt, updatedAt: project.updatedAt,
        };
        project = { ...project, videoCutJobId: job.id };
        return route.fulfill({ status: 202, json: job });
      }
      if (statusFailure) return route.fulfill({ status: 503, json: { error: 'Status unavailable' } });
      if (job && failConversion) job = { ...job, status: 'failed' };
      if (job && completed && job.status !== 'completed') {
        project = {
          ...project, updatedAt: '2026-10-19T01:00:00Z',
          video: { ...project.video, videoId: 'cut-test~cut-job', duration: 4, mimeType: 'video/mp4' },
          clickPoints: remapClickPoints(project.clickPoints, job.cuts),
        };
        job = { ...job, status: 'completed' };
      }
      return route.fulfill({ json: { job } });
    }
    if (path.startsWith('/api/videos/')) {
      return route.fulfill({ json: { url: '/test-cut-video.webm' } });
    }
    throw new Error(`Unexpected API request: ${request.method()} ${path}`);
  });
  await page.goto('/login');
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start();
    canvas.getContext('2d')?.fillRect(0, 0, 320, 180);
    await new Promise((resolve) => setTimeout(resolve, 300));
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.route('**/test-cut-video.webm', (route) => route.fulfill({ contentType: 'video/webm', body: Buffer.from(bytes) }));
  await page.goto('/designer/cut-test?lang=en');
  await expect(page.getByRole('button', { name: 'Edit video cuts', exact: true })).toBeEnabled();
  return {
    get submitted() { return submitted; },
    complete() { completed = true; },
    failStatus(value: boolean) { statusFailure = value; },
    failJob() { failConversion = true; },
  };
}

async function addRange(page: Page, start: string, end: string) {
  await page.getByLabel('Cut start (seconds)').fill(start);
  await page.getByLabel('Cut end (seconds)').fill(end);
  await page.getByRole('button', { name: 'Add cut range', exact: true }).click();
}

test('opening cut editing for a project with no previous job loads valid JSON and enables editing', async ({ page }) => {
  await setup(page);
  const statusResponse = page.waitForResponse((response) =>
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === '/api/projects/cut-test/video-cuts');
  await page.getByRole('button', { name: 'Edit video cuts', exact: true }).click();
  expect(await (await statusResponse).json()).toEqual({ job: null });
  await expect(page.getByRole('button', { name: 'Add cut range', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Unexpected end of JSON/)).toHaveCount(0);
});

test('multiple cuts show affected points, require confirmation and update the project after cloud completion', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Edit video cuts', exact: true }).click();
  await addRange(page, '1', '2');
  await addRange(page, '3', '4');
  await expect(page.getByText('After cutting: 4.00 seconds / Points to delete: 1')).toBeVisible();
  await page.getByRole('button', { name: 'Apply cuts and convert in cloud', exact: true }).click();
  await expect(page.getByText(/1 click points inside cut ranges will be deleted/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.submitted).toBeUndefined();
  await page.getByRole('button', { name: 'Apply cuts and convert in cloud', exact: true }).click();
  await page.getByRole('button', { name: 'Apply cuts and convert in cloud', exact: true }).last().click();
  await expect(page.getByText(/Converting video in the cloud/)).toBeVisible();
  expect(state.submitted).toEqual({
    cuts: [{ start: 1, end: 2 }, { start: 3, end: 4 }],
    videoId: 'cut-test', updatedAt: '2026-10-19T00:00:00Z',
  });
  await expect(page.getByRole('button', { name: 'Add cut range', exact: true })).toBeDisabled();
  state.complete();
  await expect(page.getByText('Cuts completed. The video and click point times have been updated.')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('video')).toHaveAttribute('src', '/test-cut-video.webm');
  await expect(page.getByText('removed', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('invalid cuts cannot be applied, and overlapping ranges merge and can be removed', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Edit video cuts', exact: true }).click();
  await addRange(page, '0', '6');
  await expect(page.getByText('At least 0.1 seconds of video must remain.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply cuts and convert in cloud', exact: true })).toBeDisabled();
  await addRange(page, '1', '2');
  await addRange(page, '1.5', '3');
  await expect(page.getByRole('button', { name: 'Delete: 1.00 - 3.00', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete: 1.00 - 3.00', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply cuts and convert in cloud', exact: true })).toBeDisabled();
});

test('an active durable job is restored after reopening the designer; status errors require a retry', async ({ page }) => {
  const state = await setup(page, {
    id: 'existing-job', projectId: 'cut-test', status: 'processing', cuts: [{ start: 1, end: 2 }],
    createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z',
  });
  await expect(page.getByText(/Converting video in the cloud/)).toBeVisible();
  state.failStatus(true);
  await expect(page.getByText('Status unavailable')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Apply cuts and convert in cloud', exact: true })).toBeDisabled();
  state.failStatus(false);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Status unavailable')).toHaveCount(0);
  state.failJob();
  await expect(page.getByText('Conversion failed. Your original video and click points have not been changed.')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Apply cuts and convert in cloud', exact: true })).toBeEnabled();
});
