import { apiPost } from './apiClient';

export async function logDemoUsage(
  projectId: string,
  event: 'view_start' | 'view_complete',
): Promise<void> {
  await apiPost<{ ok: boolean }>('/usage/demo', { projectId, event });
}
