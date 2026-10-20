import { apiGet, apiPost } from './apiClient';
import type { DemoProject } from '@/types';
import type { CutRange, VideoCutJob, VideoCutStatus, VideoAudioEdits, AudioWaveform } from '../../api/src/shared/videoCuts';

export async function getVideoCutJob(projectId: string): Promise<VideoCutJob | null> {
  const status = await apiGet<VideoCutStatus>(`/projects/${projectId}/video-cuts`);
  return status.job;
}

export function startVideoCut(project: DemoProject, cuts: CutRange[], audio: VideoAudioEdits): Promise<VideoCutJob> {
  return apiPost(`/projects/${project.id}/video-cuts`, {
    cuts, ...audio, videoId: project.video.videoId, updatedAt: project.updatedAt,
  });
}

export function getAudioWaveform(projectId: string, retry = false): Promise<AudioWaveform> {
  const path = `/projects/${projectId}/waveform`;
  return retry ? apiPost(path) : apiGet(path);
}
