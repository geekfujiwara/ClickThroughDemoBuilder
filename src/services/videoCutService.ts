import { apiGet, apiPost } from './apiClient';
import type { DemoProject } from '@/types';
import type { CutRange, VideoCutJob, VideoCutStatus } from '../../api/src/shared/videoCuts';

export async function getVideoCutJob(projectId: string): Promise<VideoCutJob | null> {
  const status = await apiGet<VideoCutStatus>(`/projects/${projectId}/video-cuts`);
  return status.job;
}

export function startVideoCut(project: DemoProject, cuts: CutRange[]): Promise<VideoCutJob> {
  return apiPost(`/projects/${project.id}/video-cuts`, {
    cuts, videoId: project.video.videoId, updatedAt: project.updatedAt,
  });
}
