import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import { readProjectVersion } from '../services/videoCutService.js';
import { processNextWaveform, requestWaveform } from '../services/audioWaveformService.js';

export async function handler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;
  const id = req.params.id;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return { status: 400, jsonBody: { error: 'Invalid project ID.' } };
  try {
    const version = await readProjectVersion(id);
    if (!version) return { status: 404, jsonBody: { error: 'Project not found.' } };
    if (version.project.creatorId && version.project.creatorId !== auth.payload.creatorId) {
      return { status: 403, jsonBody: { error: 'Only the project owner can load this waveform.' } };
    }
    return { jsonBody: await requestWaveform(version.project, req.method === 'POST') };
  } catch (error) {
    context.error('[videos-waveform]', error);
    return { status: 500, jsonBody: { error: 'Could not retrieve the audio waveform.' } };
  }
}

app.http('videos-waveform', {
  methods: ['GET', 'POST'], authLevel: 'anonymous', route: 'projects/{id}/waveform', handler,
});

app.timer('audio-waveform-worker', {
  schedule: '*/15 * * * * *', useMonitor: true,
  handler: (_timer, context) => processNextWaveform(context),
});
