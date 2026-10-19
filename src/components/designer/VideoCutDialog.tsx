import { useEffect, useRef, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface,
  DialogTitle, Input, Label, MessageBar, MessageBarBody, Spinner, Text,
} from '@fluentui/react-components';
import type { DemoProject } from '@/types';
import { useMsg } from '@/hooks/useMsg';
import { apiGet } from '@/services/apiClient';
import { getVideoCutJob, startVideoCut } from '@/services/videoCutService';
import {
  isCutJobActive, normalizeCuts, remapClickPoints, type CutRange, type VideoCutJob,
} from '../../../api/src/shared/videoCuts';
import Timeline from './Timeline';

interface Props {
  project: DemoProject;
  videoUrl: string;
  onClose: () => void;
  onComplete: (project: DemoProject) => void;
}

export default function VideoCutDialog({ project, videoUrl, onClose, onComplete }: Props) {
  const MSG = useMsg();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('0');
  const [currentTime, setCurrentTime] = useState(0);
  const [cuts, setCuts] = useState<CutRange[]>([]);
  const [job, setJob] = useState<VideoCutJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [retry, setRetry] = useState(0);
  const active = job !== null && isCutJobActive(job);
  const busy = loading || starting || active;
  const remainingDuration = project.video.duration - cuts.reduce((total, cut) => total + cut.end - cut.start, 0);
  const removedPoints = project.clickPoints.length - remapClickPoints(project.clickPoints, cuts).length;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const latest = await getVideoCutJob(project.id);
        if (cancelled) return;
        setJob(latest);
        setStatusError(false);
        setError('');
        if (latest && isCutJobActive(latest)) {
          setCuts(latest.cuts);
          timer = setTimeout(() => void check(), 2500);
        } else if (latest?.status === 'completed') {
          const updated = await apiGet<DemoProject>(`/projects/${project.id}`);
          if (cancelled) return;
          if (updated.video.videoId !== project.video.videoId) onComplete(updated);
        } else if (latest?.status === 'failed') {
          setCuts(latest.cuts);
          setError(MSG.cutFailed);
        }
      } catch (err) {
        if (cancelled) return;
        setStatusError(true);
        setError(err instanceof Error ? err.message : MSG.cutStatusError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [project.id, project.video.videoId, retry, onComplete, MSG.cutFailed, MSG.cutStatusError]);

  const addRange = () => {
    try {
      if (!start.trim() || !end.trim()) throw new Error(MSG.cutEmpty);
      const next = normalizeCuts([...cuts, { start: Number(start), end: Number(end) }], project.video.duration);
      setCuts(next);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : MSG.error);
    }
  };

  const apply = async () => {
    setConfirm(false);
    setStarting(true);
    setError('');
    videoRef.current?.pause();
    try {
      setJob(await startVideoCut(project, cuts));
      setRetry((value) => value + 1);
    } catch (err) {
      // A lost POST response may still have queued a durable job; recheck before permitting another request.
      setStatusError(true);
      setError(err instanceof Error ? err.message : MSG.cutStatusError);
    } finally {
      setStarting(false);
    }
  };

  return (
      <Dialog open onOpenChange={(_, data) => {
        if (!data.open && !busy) {
          if (confirm) setConfirm(false);
          else onClose();
        }
      }}>
        <DialogSurface style={{ maxWidth: '1000px', width: '90vw' }}>
          <DialogBody>
            <DialogTitle>{MSG.cutTitle}</DialogTitle>
            <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Text>{MSG.cutHelp}</Text>
              {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
              {statusError && <Button onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>{MSG.retry}</Button>}
              {busy && <Spinner label={active || starting ? MSG.cutProcessing : MSG.cutLoading} />}
              <video
                ref={videoRef} src={videoUrl} controls
                style={{ width: '100%', maxHeight: '36vh', background: '#000' }}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onError={() => setError(MSG.playerVideoError)}
              />
              <Timeline
                duration={project.video.duration} currentTime={currentTime}
                clickPoints={project.clickPoints} cuts={cuts}
                onSeek={(time) => { if (videoRef.current) videoRef.current.currentTime = time; setCurrentTime(time); }}
              />
              <fieldset disabled={busy || statusError || confirm} style={{ border: 0, padding: 0, margin: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'end' }}>
                  <div>
                    <Label htmlFor="cut-start">{MSG.cutStart}</Label>
                    <Input id="cut-start" type="number" min={0} max={project.video.duration} step={0.01}
                      value={start} onChange={(_, data) => setStart(data.value)} />
                    <Button onClick={() => setStart((videoRef.current?.currentTime ?? currentTime).toFixed(2))}>{MSG.cutSetStart}</Button>
                  </div>
                  <div>
                    <Label htmlFor="cut-end">{MSG.cutEnd}</Label>
                    <Input id="cut-end" type="number" min={0} max={project.video.duration} step={0.01}
                      value={end} onChange={(_, data) => setEnd(data.value)} />
                    <Button onClick={() => setEnd((videoRef.current?.currentTime ?? currentTime).toFixed(2))}>{MSG.cutSetEnd}</Button>
                  </div>
                  <Button onClick={addRange}>{MSG.cutAdd}</Button>
                </div>
                <ul style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  {cuts.map((cut, index) => (
                    <li key={`${cut.start}-${cut.end}`}>
                      {cut.start.toFixed(2)} - {cut.end.toFixed(2)} s{' '}
                      <Button size="small" aria-label={`${MSG.delete}: ${cut.start.toFixed(2)} - ${cut.end.toFixed(2)}`}
                        onClick={() => setCuts((ranges) => ranges.filter((_, i) => i !== index))}>{MSG.delete}</Button>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <Text>{MSG.cutSummary(remainingDuration.toFixed(2), removedPoints)}</Text>
              {confirm && <MessageBar intent="warning"><MessageBarBody>{MSG.cutConfirm(removedPoints, remainingDuration.toFixed(2))}</MessageBarBody></MessageBar>}
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => { if (confirm) setConfirm(false); else onClose(); }}>{confirm ? MSG.cancel : MSG.close}</Button>
              <Button appearance="primary" disabled={busy || statusError || !cuts.length}
                onClick={() => { if (confirm) void apply(); else setConfirm(true); }}>{MSG.cutApply}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
  );
}
