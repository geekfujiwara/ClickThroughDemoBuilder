import { normalizeVideoEdits, type CutRange, type VideoAudioEdits } from './videoCuts.js';

export interface TimelineClip extends CutRange {
  id: string;
  muted: boolean;
}

export interface TimelineEdit {
  clips: TimelineClip[];
  muteAll: boolean;
}

export const FRAME_DURATION = 1 / 30;

export function timelineDuration(clips: TimelineClip[]): number {
  return clips.reduce((sum, clip) => sum + clip.end - clip.start, 0);
}

export function timelineToSource(clips: TimelineClip[], time: number): number {
  let elapsed = 0;
  for (const clip of clips) {
    const length = clip.end - clip.start;
    if (time < elapsed + length) return clip.start + Math.max(0, time - elapsed);
    elapsed += length;
  }
  return clips[clips.length - 1]?.end ?? 0;
}

export function sourceToTimeline(clips: TimelineClip[], time: number): number | null {
  let elapsed = 0;
  for (const clip of clips) {
    if (time >= clip.start && time < clip.end) return elapsed + time - clip.start;
    elapsed += clip.end - clip.start;
  }
  return time === clips[clips.length - 1]?.end ? elapsed : null;
}

export function splitTimeline(edit: TimelineEdit, time: number): TimelineEdit {
  if (!Number.isFinite(time)) throw new Error('Invalid playhead position.');
  if (edit.clips.length >= 101) throw new Error('The timeline supports up to 101 clips.');
  let elapsed = 0;
  const clips = edit.clips.flatMap((clip) => {
    const offset = time - elapsed;
    const length = clip.end - clip.start;
    elapsed += length;
    if (offset < FRAME_DURATION - 1e-6 || length - offset < FRAME_DURATION - 1e-6) return [clip];
    const source = clip.start + offset;
    return [
      { ...clip, id: `${clip.id}:L${source.toFixed(6)}`, end: source },
      { ...clip, id: `${clip.id}:R${source.toFixed(6)}`, start: source },
    ];
  });
  if (clips.length === edit.clips.length) throw new Error('Place the playhead inside a clip, at least one frame from its edges.');
  return { ...edit, clips };
}

export function timelineEdits(edit: TimelineEdit, duration: number): { cuts: CutRange[] } & VideoAudioEdits {
  const cuts: CutRange[] = [];
  const muteRanges: CutRange[] = [];
  let cursor = 0;
  for (const clip of edit.clips) {
    if (clip.start > cursor + 1e-6) cuts.push({ start: cursor, end: clip.start });
    if (clip.muted) {
      const last = muteRanges[muteRanges.length - 1];
      if (last && Math.abs(last.end - clip.start) < 1e-6) last.end = clip.end;
      else muteRanges.push({ start: clip.start, end: clip.end });
    }
    cursor = clip.end;
  }
  if (cursor < duration - 1e-6) cuts.push({ start: cursor, end: duration });
  return { cuts, muteRanges, muteAll: edit.muteAll };
}

export function deleteTimelineClip(edit: TimelineEdit, selectedId: string, duration: number): TimelineEdit {
  const clips = edit.clips.filter((clip) => clip.id !== selectedId);
  if (clips.length === edit.clips.length) throw new Error('Select a clip to delete.');
  const next = { ...edit, clips };
  const changes = timelineEdits(next, duration);
  normalizeVideoEdits(changes.cuts, changes.muteRanges, changes.muteAll, duration);
  return next;
}

export function restoreTimeline(duration: number, cuts: CutRange[], audio: VideoAudioEdits): TimelineEdit {
  const boundaries = [...new Set([0, duration, ...cuts.flatMap((cut) => [cut.start, cut.end]),
    ...audio.muteRanges.flatMap((range) => [range.start, range.end])])].sort((a, b) => a - b);
  const clips: TimelineClip[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index]!;
    const end = boundaries[index + 1]!;
    if (cuts.some((cut) => start >= cut.start && end <= cut.end)) continue;
    clips.push({
      id: `clip-${index}`, start, end,
      muted: audio.muteRanges.some((range) => start >= range.start && end <= range.end),
    });
  }
  return { clips, muteAll: audio.muteAll };
}
