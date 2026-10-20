import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
import ffmpeg from 'ffmpeg-static';
import functions from '@azure/functions';
import {
  normalizeCuts, normalizeVideoEdits, remainingRanges, remapCutTime, remapClickPoints,
} from '../dist/shared/videoCuts.js';
import { convertVideo, probeVideo, runMediaProcess } from '../dist/services/videoConversionService.js';
import {
  restoreTimeline, splitTimeline, timelineEdits, timelineDuration, timelineToSource, sourceToTimeline, deleteTimelineClip,
} from '../dist/shared/videoTimeline.js';

const require = createRequire(import.meta.url);
const { HttpRequest, HttpResponse, InvocationContext } = functions;
const exec = promisify(execFile);
let directory;
let emulator;
let blobs;
let jobs;
let worker;
let handler;
let token;
let fixture;
let extractWaveform;
let requestWaveform;
let processWaveform;
const errors = [];
const context = new InvocationContext({ functionName: 'video-cut-test' });
context.error = (...args) => errors.push(args);

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'clickthrough-cut-test-'));
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const key = randomBytes(32).toString('base64');
  process.env.STORAGE_CONNECTION_STRING = `DefaultEndpointsProtocol=http;AccountName=cuttest;AccountKey=${key};BlobEndpoint=http://127.0.0.1:${port}/cuttest;`;
  delete process.env.STORAGE_ACCOUNT_NAME;
  delete process.env.WEBSITE_SITE_NAME;
  delete process.env.AZURE_FUNCTIONS_ENVIRONMENT;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  emulator = spawn(process.execPath, [
    require.resolve('azurite/dist/src/blob/main.js'), '--blobHost', '127.0.0.1',
    '--blobPort', String(port), '--location', directory, '--silent', '--skipApiVersionCheck', '--disableTelemetry',
  ], {
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, AZURITE_ACCOUNTS: `cuttest:${key}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Azurite startup timed out: ${output}`)), 60000);
    emulator.once('error', (error) => { clearTimeout(timeout); reject(error); });
    emulator.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Azurite exited: ${code}: ${output}`)); });
    emulator.stderr.on('data', (data) => { output += data.toString(); });
    emulator.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('successfully listens')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  blobs = await import('../dist/services/blobService.js');
  ({ extractWaveform, requestWaveform, processWaveform } = await import('../dist/services/audioWaveformService.js'));
  jobs = await import('../dist/services/videoCutService.js');
  worker = await import('../dist/functions/video-cut-worker.js');
  ({ handler } = await import('../dist/functions/videos-cut.js'));
  const { createToken } = await import('../dist/middleware/auth.js');
  token = createToken('designer', 'owner');
  fixture = join(directory, 'source.mp4');
  console.log((await runMediaProcess(ffmpeg, ['-version'])).split('\n')[0]);
  await runMediaProcess(ffmpeg, [
    '-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=30:d=6',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-vf', "drawbox=c=green:t=fill:enable='gte(t,2)*lt(t,4)',drawbox=c=blue:t=fill:enable='gte(t,4)'",
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', fixture,
  ]);
});

after(async () => {
  if (emulator && emulator.exitCode === null) {
    const exited = new Promise((resolve) => emulator.once('exit', resolve));
    emulator.kill();
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

function point(id, timestamp) {
  return { id, timestamp, order: timestamp + 1, position: { x: 30, y: 40 }, description: id, area: { type: 'circle', radius: 20 } };
}

async function projectFixture() {
  const id = randomUUID();
  const project = {
    id, title: 'Cut test', creatorId: 'owner', demoNumber: 1, description: '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
    video: { videoId: id, fileName: 'source.mp4', mimeType: 'video/mp4', duration: 6, width: 320, height: 180, thumbnailDataUrl: '' },
    settings: { guestAccessEnabled: true },
    clickPoints: [point('before', 0.5), point('start', 1), point('end', 2), point('inside', 3.5), point('after', 4.5)],
  };
  await blobs.putProjectJson(id, JSON.stringify(project));
  await (await blobs.ensureContainer('videos')).getBlockBlobClient(`${id}/video.mp4`).uploadFile(fixture);
  return (await jobs.readProjectVersion(id));
}

function request(project, body, session = token) {
  return new HttpRequest({
    method: 'POST', url: `http://localhost/api/projects/${project.id}/video-cuts`,
    params: { id: project.id }, headers: session ? { cookie: `session=${session}` } : {},
    body: { string: JSON.stringify(body) },
  });
}

test('ranges are validated, sorted and merged; deleting the whole video is rejected', () => {
  assert.deepEqual(normalizeCuts([{ start: 3, end: 4 }, { start: 1, end: 3 }, { start: 2, end: 3.5 }], 6), [{ start: 1, end: 4 }]);
  for (const input of [[], null, [{ start: -1, end: 1 }], [{ start: 1, end: 1 }], [{ start: 0, end: 7 }], [{ start: 0, end: 6 }], [{ start: NaN, end: 1 }], [{ start: '0', end: 1 }], Array(51).fill({ start: 0, end: 1 })]) {
    assert.throws(() => normalizeCuts(input, 6));
  }
});

test('point times use half-open ranges and preserve all other point properties', () => {
  const cuts = normalizeCuts([{ start: 1, end: 2 }, { start: 3, end: 4 }], 6);
  assert.deepEqual(remainingRanges(cuts, 6), [{ start: 0, end: 1 }, { start: 2, end: 3 }, { start: 4, end: 6 }]);
  assert.equal(remapCutTime(1, cuts), null);
  assert.equal(remapCutTime(2, cuts), 1);
  assert.equal(remapCutTime(4.5, cuts), 2.5);
  const original = point('retained', 4.5);
  assert.deepEqual(remapClickPoints([point('deleted', 1.5), original], cuts), [{ ...original, timestamp: 2.5, order: 1 }]);
  assert.equal(original.timestamp, 4.5);
});

test('timeline splitting, ripple deletion and mute restoration preserve source/output mappings', () => {
  const initial = restoreTimeline(6, [], { muteAll: false, muteRanges: [] });
  const first = splitTimeline(initial, 1);
  const split = splitTimeline(first, 2);
  assert.equal(initial.clips.length, 1, 'Splitting must not mutate undo history');
  assert.equal(split.clips.length, 3);
  assert.deepEqual(timelineEdits(split, 6), { cuts: [], muteRanges: [], muteAll: false });
  const removed = deleteTimelineClip(split, split.clips[1].id, 6);
  assert.equal(timelineDuration(removed.clips), 5);
  assert.equal(timelineToSource(removed.clips, 1), 2);
  assert.equal(timelineToSource(removed.clips, 2.5), 3.5);
  assert.equal(timelineToSource(removed.clips, 5), 6);
  assert.equal(sourceToTimeline(removed.clips, 1.5), null);
  assert.equal(sourceToTimeline(removed.clips, 2), 1);
  assert.equal(sourceToTimeline(removed.clips, 4.5), 3.5);
  const muted = { ...removed, clips: removed.clips.map((clip, index) => ({ ...clip, muted: index === 1 })) };
  const edits = timelineEdits(muted, 6);
  assert.deepEqual(edits, { cuts: [{ start: 1, end: 2 }], muteRanges: [{ start: 2, end: 6 }], muteAll: false });
  assert.deepEqual(timelineEdits(restoreTimeline(6, edits.cuts, edits), 6), edits);
  assert.throws(() => deleteTimelineClip(initial, initial.clips[0].id, 6), /0.1/);
  for (const time of [0, 6, 0.001, NaN]) assert.throws(() => splitTimeline(initial, time));
});

test('mute-only edits are accepted, no-ops, malformed audio and excessive ranges are rejected', () => {
  assert.deepEqual(normalizeVideoEdits([], [], true, 6), { cuts: [], muteRanges: [], muteAll: true });
  assert.deepEqual(normalizeVideoEdits([], [{ start: 0, end: 6 }], false, 6).muteRanges, [{ start: 0, end: 6 }]);
  for (const [cuts, muteRanges, muteAll] of [
    [[], [], false], [[], [], 'true'], [[], [{ start: -1, end: 2 }], false],
    [[], Array(51).fill({ start: 1, end: 2 }), false], [[{ start: 0, end: 6 }], [], true],
  ]) assert.throws(() => normalizeVideoEdits(cuts, muteRanges, muteAll, 6));
});

async function decodeAudio(path) {
  const { stdout } = await exec(ffmpeg, [
    '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1',
  ], { encoding: 'buffer' });
  return (start, end) => {
    let sum = 0;
    let count = 0;
    for (let index = Math.ceil(start * 8000); index < Math.min(Math.floor(end * 8000), stdout.length / 4); index++) {
      sum += stdout.readFloatLE(index * 4) ** 2;
      count++;
    }
    assert.ok(count > 0, `Missing audio samples at ${start}-${end}`);
    return Math.sqrt(sum / count);
  };
}

test('actual audio supports whole-video mute, partial mute and source-aligned mute after ripple cuts', async () => {
  for (const [name, cuts, audio, silent, audible, expected] of [
    ['all', [], { muteAll: true, muteRanges: [] }, [0.3, 3.3, 5.3], [], 6],
    ['partial', [], { muteAll: false, muteRanges: [{ start: 1, end: 2 }, { start: 4, end: 5 }] }, [1.3, 4.3], [0.3, 2.3, 5.3], 6],
    ['ripple', [{ start: 2, end: 3 }], { muteAll: false, muteRanges: [{ start: 1, end: 2 }, { start: 4, end: 5 }] }, [1.3, 3.3], [0.3, 2.3, 4.3], 5],
  ]) {
    const output = join(directory, `mute-${name}.mp4`);
    const result = await convertVideo(fixture, output, join(directory, `mute-${name}.jpg`), cuts, 6, undefined, audio);
    assert.equal(result.duration, expected);
    const rms = await decodeAudio(output);
    for (const time of silent) assert.ok(rms(time, time + 0.3) < 0.001, `${name}: expected silence at ${time}`);
    for (const time of audible) assert.ok(rms(time, time + 0.3) > 0.05, `${name}: lost audible content at ${time}`);
  }
  const source = await extractWaveform(fixture, 6);
  assert.equal(source.hasAudio, true);
  assert.equal(source.peaks.length, 240);
  assert.ok(source.peaks.every((peak) => Number.isFinite(peak) && peak >= 0 && peak <= 1));
  assert.ok(source.peaks.filter((peak) => peak > 0.05).length > 220);
  const partial = await extractWaveform(join(directory, 'mute-partial.mp4'), 6);
  assert.ok(partial.peaks.slice(52, 72).every((peak) => peak < 0.001));
  assert.ok(partial.peaks.slice(92, 112).every((peak) => peak > 0.05));
});

test('actual conversion removes multiple ranges, retains audio and shows the expected frames', async () => {
  const output = join(directory, 'converted.mp4');
  const result = await convertVideo(fixture, output, join(directory, 'thumb.jpg'), [{ start: 1, end: 2 }, { start: 3, end: 4 }], 6);
  assert.equal(result.duration, 4);
  assert.match(result.thumbnailDataUrl, /^data:image\/jpeg;base64,/);
  const probe = await probeVideo(output);
  assert.ok(Math.abs(Number(probe.format.duration) - 4) < 0.1);
  assert.ok(probe.streams.some((stream) => stream.codec_type === 'audio'));
  for (const [time, channel] of [[0.5, 0], [1.5, 1], [2.5, 2]]) {
    const { stdout } = await exec(ffmpeg, ['-v', 'error', '-ss', String(time), '-i', output, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { encoding: 'buffer' });
    assert.ok(stdout[channel] > 90 && stdout[channel] > stdout[(channel + 1) % 3] + 70, `Wrong color at ${time}: ${[...stdout]}`);
  }
});

test('silent WebM and fractional head/tail cuts are supported', async () => {
  const input = join(directory, 'silent.webm');
  await runMediaProcess(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=180x320:r=30:d=3', '-c:v', 'libvpx-vp9', input]);
  const output = join(directory, 'silent-cut.mp4');
  const result = await convertVideo(input, output, join(directory, 'silent-thumb.jpg'), [{ start: 0, end: 0.53 }, { start: 2.37, end: 3 }], 3);
  assert.ok(Math.abs(result.duration - 1.84) < 0.0001);
  assert.equal(result.width, 180);
  assert.equal(result.height, 320);
  assert.equal((await probeVideo(output)).streams.length, 1);
  assert.deepEqual(await extractWaveform(input, 3), { hasAudio: false, peaks: [] });
  const muted = join(directory, 'silent-muted.mp4');
  await convertVideo(input, muted, join(directory, 'silent-muted.jpg'), [], 3, undefined, { muteAll: true, muteRanges: [] });
  assert.equal((await probeVideo(muted)).streams.length, 1);
});

test('fifty fractional cuts do not accumulate video-frame drift against the remapped timeline', async () => {
  const cuts = normalizeCuts(Array.from({ length: 50 }, (_, index) => ({
    start: Number((0.02 + index * 0.035).toFixed(3)),
    end: Number((0.03 + index * 0.035).toFixed(3)),
  })), 6);
  const output = join(directory, 'many-cuts.mp4');
  const result = await convertVideo(fixture, output, join(directory, 'many-thumb.jpg'), cuts, 6);
  assert.ok(Math.abs(result.duration - 5.5) < 0.0001);
  for (const [time, channel] of [[1.45, 0], [1.55, 1], [3.45, 1], [3.55, 2]]) {
    const { stdout } = await exec(ffmpeg, ['-v', 'error', '-ss', String(time), '-i', output, '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { encoding: 'buffer' });
    assert.ok(stdout[channel] > 90 && stdout[channel] > stdout[(channel + 1) % 3] + 70, `Timeline drift at ${time}: ${[...stdout]}`);
  }
});

test('API rejects missing authentication, other owners, invalid ranges and stale projects', async () => {
  const { project } = await projectFixture();
  const body = { cuts: [{ start: 1, end: 2 }], videoId: project.video.videoId, updatedAt: project.updatedAt };
  assert.equal((await handler(request(project, body, ''), context)).status, 401);
  const { createToken } = await import('../dist/middleware/auth.js');
  assert.equal((await handler(request(project, body, createToken('viewer', 'owner')), context)).status, 403);
  assert.equal((await handler(request(project, body, createToken('designer', 'other')), context)).status, 403);
  assert.equal((await handler(request(project, { ...body, cuts: [{ start: 0, end: 6 }] }), context)).status, 400);
  assert.equal((await handler(request(project, { ...body, updatedAt: 'stale' }), context)).status, 409);
});

test('status for a project without cuts serializes as a non-empty JSON response', async () => {
  const { project } = await projectFixture();
  const result = await handler(new HttpRequest({
    method: 'GET', url: `http://localhost/api/projects/${project.id}/video-cuts`,
    params: { id: project.id }, headers: { cookie: `session=${token}` },
  }), context);
  const response = new HttpResponse(result);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(await response.text(), '{"job":null}');
});

test('durable jobs publish a new video and remapped points together, and recover idempotently', async () => {
  const { project } = await projectFixture();
  const response = await handler(request(project, { cuts: [{ start: 1, end: 2 }, { start: 3, end: 4 }], videoId: project.video.videoId, updatedAt: project.updatedAt }), context);
  assert.equal(response.status, 202);
  assert.equal(response.jsonBody.project, undefined);
  const job = response.jsonBody;
  const statusResponse = new HttpResponse(await handler(new HttpRequest({
    method: 'GET', url: `http://localhost/api/projects/${project.id}/video-cuts`,
    params: { id: project.id }, headers: { cookie: `session=${token}` },
  }), context));
  assert.deepEqual(await statusResponse.json(), JSON.parse(JSON.stringify({ job })));
  const locked = (await jobs.readProjectVersion(project.id)).project;
  await assert.rejects(() => jobs.assertNoActiveCut(locked), jobs.CutConflictError);
  await worker.processCutJob(job.id, context);
  const stored = await jobs.readCutJob(job.id);
  assert.equal(stored.status, 'completed', JSON.stringify(errors));
  const updated = (await jobs.readProjectVersion(project.id)).project;
  assert.equal(updated.video.videoId, `${project.id}~${job.id}`);
  assert.equal(updated.video.duration, 4);
  assert.deepEqual(updated.clickPoints.map(({ id, timestamp }) => ({ id, timestamp })), [
    { id: 'before', timestamp: 0.5 }, { id: 'end', timestamp: 1 }, { id: 'after', timestamp: 2.5 },
  ]);
  assert.ok(await blobs.videoExists(project.id), 'Original video must be retained');
  const etag = (await jobs.readProjectVersion(project.id)).etag;
  const lease = (await jobs.jobBlob(job.id)).getBlobLeaseClient();
  await lease.acquireLease(60);
  stored.status = 'processing';
  await jobs.writeCutJob(stored, lease);
  await lease.releaseLease();
  await worker.processCutJob(job.id, context);
  assert.equal((await jobs.readProjectVersion(project.id)).etag, etag);
  assert.equal((await jobs.readCutJob(job.id)).status, 'completed');
});

test('a stale project cannot start two jobs, and failed conversion leaves the original unchanged', async () => {
  const version = await projectFixture();
  const job = await jobs.createCutJob(version.project, version.etag, [{ start: 1, end: 2 }]);
  await assert.rejects(() => jobs.createCutJob(version.project, version.etag, [{ start: 2, end: 3 }]), jobs.CutConflictError);
  const source = (await blobs.ensureContainer('videos')).getBlockBlobClient(`${version.project.id}/video.mp4`);
  await source.upload('invalid replacement', 19);
  await worker.processCutJob(job.id, context);
  assert.equal((await jobs.readCutJob(job.id)).status, 'failed');
  const updated = (await jobs.readProjectVersion(version.project.id)).project;
  assert.deepEqual(updated.video, version.project.video);
  assert.deepEqual(updated.clickPoints, version.project.clickPoints);
});

test('project changes during conversion cannot be overwritten', async () => {
  const version = await projectFixture();
  const job = await jobs.createCutJob(version.project, version.etag, [{ start: 1, end: 2 }]);
  const lease = (await jobs.jobBlob(job.id)).getBlobLeaseClient();
  await lease.acquireLease(60);
  const current = await jobs.readProjectVersion(version.project.id);
  const stored = await jobs.readCutJob(job.id);
  stored.status = 'processing';
  stored.projectEtag = current.etag;
  await jobs.writeCutJob(stored, lease);
  await lease.releaseLease();
  await blobs.putProjectJson(version.project.id, JSON.stringify({ ...current.project, title: 'Concurrent edit' }));
  await worker.processCutJob(job.id, context);
  assert.equal((await jobs.readCutJob(job.id)).status, 'failed');
  const updated = (await jobs.readProjectVersion(version.project.id)).project;
  assert.equal(updated.title, 'Concurrent edit');
  assert.equal(updated.video.videoId, version.project.video.videoId);
});

test('mute-only cloud jobs retain point timestamps and metadata exactly', async () => {
  const version = await projectFixture();
  const result = await handler(request(version.project, {
    cuts: [], muteRanges: [{ start: 1, end: 2 }], muteAll: false,
    videoId: version.project.video.videoId, updatedAt: version.project.updatedAt,
  }), context);
  assert.equal(result.status, 202);
  await worker.processCutJob(result.jsonBody.id, context);
  assert.equal((await jobs.readCutJob(result.jsonBody.id)).status, 'completed', JSON.stringify(errors));
  const updated = (await jobs.readProjectVersion(version.project.id)).project;
  assert.equal(updated.video.duration, 6);
  assert.deepEqual(updated.clickPoints, version.project.clickPoints);
});

test('waveform API requires ownership and caches the real waveform by video revision with explicit retry', async () => {
  const { handler: waveformHandler } = await import('../dist/functions/videos-waveform.js');
  const { createToken } = await import('../dist/middleware/auth.js');
  const { project } = await projectFixture();
  const get = (session = token, method = 'GET') => waveformHandler(new HttpRequest({
    method, url: `http://localhost/api/projects/${project.id}/waveform`,
    params: { id: project.id }, headers: session ? { cookie: `session=${session}` } : {},
  }), context);
  assert.equal((await get('')).status, 401);
  assert.equal((await get(createToken('viewer', 'owner'))).status, 403);
  assert.equal((await get(createToken('designer', 'other'))).status, 403);
  const responses = await Promise.all([get(), get()]);
  for (const response of responses) assert.equal(response.jsonBody.status, 'queued');
  const masters = await blobs.ensureContainer('masters');
  const ownJobs = [];
  for await (const item of masters.listBlobsFlat({ prefix: 'waveforms/' })) {
    const blob = masters.getBlockBlobClient(item.name);
    const data = JSON.parse((await blob.downloadToBuffer()).toString());
    if (data.videoId === project.id) ownJobs.push({ name: item.name, blob, data });
  }
  assert.equal(ownJobs.length, 1, 'Concurrent requests should share a cached job');
  await processWaveform(ownJobs[0].name, context);
  const completed = (await get()).jsonBody;
  assert.equal(completed.status, 'completed', JSON.stringify(errors));
  assert.equal(completed.hasAudio, true);
  assert.equal(completed.peaks.length, 240);
  assert.equal(completed.sourceName, undefined, 'Internal storage information must not be public');
  assert.deepEqual(await requestWaveform(project), completed);
  const failed = JSON.stringify({ ...ownJobs[0].data, status: 'failed', attempts: 3 });
  await ownJobs[0].blob.upload(failed, Buffer.byteLength(failed));
  assert.equal((await get()).jsonBody.status, 'failed');
  assert.equal((await get(token, 'POST')).jsonBody.status, 'queued');
  await processWaveform(ownJobs[0].name, context);
  assert.equal((await get()).jsonBody.status, 'completed');
  await (await blobs.ensureContainer('videos')).getBlockBlobClient(`${project.id}/video.mp4`).uploadFile(fixture);
  assert.equal((await get()).jsonBody.status, 'queued', 'A replaced source requires a new waveform');
  await processWaveform(ownJobs[0].name, context);
  assert.equal((await get()).jsonBody.status, 'queued', 'Old completed job cannot complete the new revision');
});
