export interface CutRange {
  start: number;
  end: number;
}

export interface VideoCutJob {
  id: string;
  projectId: string;
  status: 'preparing' | 'queued' | 'processing' | 'completed' | 'failed';
  cuts: CutRange[];
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface VideoCutStatus {
  job: VideoCutJob | null;
}

export function normalizeCuts(input: unknown, duration: number): CutRange[] {
  if (!Number.isFinite(duration) || duration <= 0 || !Array.isArray(input) || !input.length || input.length > 50) {
    throw new Error('Specify 1-50 cut ranges for a video with a valid duration.');
  }
  const ranges = input.map((range: unknown) => {
    if (!range || typeof range !== 'object' || !('start' in range) || !('end' in range)
      || typeof range.start !== 'number' || typeof range.end !== 'number'
      || !Number.isFinite(range.start) || !Number.isFinite(range.end)
      || range.start < 0 || range.end > duration || range.end <= range.start) {
      throw new Error('Each cut must satisfy 0 <= start < end <= video duration.');
    }
    return { start: range.start, end: range.end };
  }).sort((a, b) => a.start - b.start);
  const merged: CutRange[] = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  if (remainingRanges(merged, duration).reduce((sum, range) => sum + range.end - range.start, 0) < 0.1) {
    throw new Error('At least 0.1 seconds of video must remain.');
  }
  return merged;
}

export function remainingRanges(cuts: CutRange[], duration: number): CutRange[] {
  const kept: CutRange[] = [];
  let start = 0;
  for (const cut of cuts) {
    if (start < cut.start) kept.push({ start, end: cut.start });
    start = cut.end;
  }
  if (start < duration) kept.push({ start, end: duration });
  return kept;
}

// Cut intervals are half-open: a point at the start is removed; a point at the end is retained.
export function remapCutTime(time: number, cuts: CutRange[]): number | null {
  let removed = 0;
  for (const cut of cuts) {
    if (time >= cut.start && time < cut.end) return null;
    if (time >= cut.end) removed += cut.end - cut.start;
  }
  return time - removed;
}

export function remapClickPoints<T extends { timestamp: number; order: number }>(points: T[], cuts: CutRange[]): T[] {
  return points.flatMap((point) => {
    const timestamp = remapCutTime(point.timestamp, cuts);
    return timestamp === null ? [] : [{ ...point, timestamp }];
  }).sort((a, b) => a.order - b.order).map((point, index) => ({ ...point, order: index + 1 }));
}

export function isCutJobActive(job: VideoCutJob): boolean {
  return job.status === 'preparing' || job.status === 'queued' || job.status === 'processing';
}
