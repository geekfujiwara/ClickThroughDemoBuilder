import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from '@ffprobe-installer/ffprobe';
import { remainingRanges, type CutRange } from '../shared/videoCuts.js';

export async function runMediaProcess(executable: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, signal });
    let output = '';
    let errors = '';
    child.stdout.on('data', (data: Buffer) => { output = (output + data.toString()).slice(-1024 * 1024); });
    child.stderr.on('data', (data: Buffer) => { errors = (errors + data.toString()).slice(-16000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Media process failed (${code}): ${errors}`));
    });
  });
}

interface ProbeResult {
  format: { duration?: string };
  streams: { codec_type: string; width?: number; height?: number }[];
}

export async function probeVideo(path: string, signal?: AbortSignal): Promise<ProbeResult> {
  return JSON.parse(await runMediaProcess(ffprobe.path, [
    '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path,
  ], signal)) as ProbeResult;
}

export async function convertVideo(input: string, output: string, thumbnail: string, cuts: CutRange[], duration: number, signal?: AbortSignal) {
  if (typeof ffmpegPath !== 'string') throw new Error('FFmpeg binary is not installed.');
  const source = await probeVideo(input, signal);
  const sourceDuration = Number(source.format.duration);
  if (!Number.isFinite(sourceDuration) || Math.abs(sourceDuration - duration) > 0.15) {
    throw new Error('Source video duration differs from the saved project. Replace or reload the source video.');
  }
  const ranges = remainingRanges(cuts, duration);
  const hasAudio = source.streams.some((stream) => stream.codec_type === 'audio');
  const selection = cuts.map((cut) => `gte(t,${cut.start})*lt(t,${cut.end})`).join('+');
  const shift = cuts.map((cut) => `gte(PTS*TB,${cut.end})*${cut.end - cut.start}`).join('+');
  // Remap original frame timestamps directly to avoid accumulating per-segment frame rounding.
  const filters = [
    `[0:v:0]setpts=PTS-STARTPTS,select='not(${selection})',setpts='PTS-(${shift})/TB',setsar=1,pad=ceil(iw/2)*2:ceil(ih/2)*2[v]`,
  ];
  if (hasAudio) {
    filters.push(...ranges.map((range, index) =>
      `[0:a:0]aresample=48000:async=1:first_pts=0,apad,atrim=start=${range.start}:end=${range.end},asetpts=PTS-STARTPTS[a${index}]`));
    filters.push(ranges.map((_, index) => `[a${index}]`).join('') + `concat=n=${ranges.length}:v=0:a=1[a]`);
  }
  const expectedDuration = ranges.reduce((total, range) => total + range.end - range.start, 0);
  await runMediaProcess(ffmpegPath, [
    '-nostdin', '-y', '-v', 'error', '-threads', '2', '-i', input,
    '-filter_complex_threads', '1', '-filter_complex', filters.join(';'),
    '-map', '[v]', ...(hasAudio ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '128k'] : []),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-r', '30', '-t', String(expectedDuration), '-movflags', '+faststart', output,
  ], signal);
  const result = await probeVideo(output, signal);
  const video = result.streams.find((stream) => stream.codec_type === 'video');
  if (!video?.width || !video.height || Math.abs(Number(result.format.duration) - expectedDuration) > 0.1) {
    throw new Error('Converted video failed duration or dimension validation.');
  }
  await runMediaProcess(ffmpegPath, [
    '-nostdin', '-y', '-v', 'error', '-i', output, '-frames:v', '1', '-vf', 'scale=320:-1', thumbnail,
  ], signal);
  return {
    duration: expectedDuration, width: video.width, height: video.height,
    thumbnailDataUrl: `data:image/jpeg;base64,${(await readFile(thumbnail)).toString('base64')}`,
  };
}
