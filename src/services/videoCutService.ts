import { apiGet, apiPost } from './apiClient';
import type { DemoProject } from '@/types';
import type { CutRange, VideoCutJob } from '../../api/src/shared/videoCuts';

export function getVideoCutJob(projectId: string): Promise<VideoCutJob | null> {
  return apiGet(`/projects/${projectId}/video-cuts`);
}

export function startVideoCut(project: DemoProject, cuts: CutRange[]): Promise<VideoCutJob> {
  return apiPost(`/projects/${project.id}/video-cuts`, {
    cuts, videoId: project.video.videoId, updatedAt: project.updatedAt,
  });
}
