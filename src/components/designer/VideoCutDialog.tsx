import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface,
  DialogTitle, Input, Label, MessageBar, MessageBarBody, Spinner, Text, ToggleButton, tokens,
} from '@fluentui/react-components';
import { CutRegular, DeleteRegular, PlayRegular, PauseRegular, ArrowUndoRegular, ArrowRedoRegular, SpeakerMuteRegular } from '@fluentui/react-icons';
import type { DemoProject } from '@/types';
import { useMsg } from '@/hooks/useMsg';
import { apiGet } from '@/services/apiClient';
import { getAudioWaveform, getVideoCutJob, startVideoCut } from '@/services/videoCutService';
import { formatTime } from '@/utils/time';
import {
  isCutJobActive, normalizeVideoEdits, remapClickPoints, type AudioWaveform, type VideoCutJob,
} from '../../../api/src/shared/videoCuts';
import {
  deleteTimelineClip, FRAME_DURATION, restoreTimeline, sourceToTimeline, splitTimeline, timelineDuration,
  timelineEdits, timelineToSource, type TimelineEdit,
} from '../../../api/src/shared/videoTimeline';
import VideoEditTimeline from './VideoEditTimeline';

interface Props {
  project: DemoProject;
  videoUrl: string;
  onClose: () => void;
  onComplete: (project: DemoProject) => void;
}

export default function VideoCutDialog({ project, videoUrl, onClose, onComplete }: Props) {
  const MSG = useMsg();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [edit, setEdit] = useState<TimelineEdit>(() => restoreTimeline(project.video.duration, [], { muteAll: false, muteRanges: [] }));
  const editRef = useRef(edit);
  editRef.current = edit;
  const [undoStack, setUndoStack] = useState<TimelineEdit[]>([]);
  const [redoStack, setRedoStack] = useState<TimelineEdit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [job, setJob] = useState<VideoCutJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [retry, setRetry] = useState(0);
  const [waveform, setWaveform] = useState<AudioWaveform | null>(null);
  const [waveError, setWaveError] = useState('');
  const [waveRetry, setWaveRetry] = useState(0);
  const restoredJobRef = useRef<string | null>(null);
  const active = job !== null && isCutJobActive(job);
  const busy = loading || starting || active;
  const locked = busy || statusError || confirm;
  const changes = timelineEdits(edit, project.video.duration);
  const duration = timelineDuration(edit.clips);
  const hasChanges = changes.cuts.length > 0 || changes.muteRanges.length > 0 || changes.muteAll;
  const removedPoints = project.clickPoints.length - remapClickPoints(project.clickPoints, changes.cuts).length;
  const selected = edit.clips.find((clip) => clip.id === selectedId);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const seek = useCallback((time: number, state = editRef.current) => {
    const next = Math.max(0, Math.min(timelineDuration(state.clips), time));
    const source = timelineToSource(state.clips, next);
    const clip = state.clips.find((item) => source >= item.start && source < item.end);
    if (videoRef.current) {
      videoRef.current.currentTime = source;
      videoRef.current.muted = state.muteAll || (clip?.muted ?? false);
    }
    setCurrentTime(next);
  }, []);

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
          if (restoredJobRef.current !== latest.id) {
            restoredJobRef.current = latest.id;
            setEdit(restoreTimeline(project.video.duration, latest.cuts, {
              muteAll: latest.muteAll ?? false, muteRanges: latest.muteRanges ?? [],
            }));
          }
          timer = setTimeout(() => void check(), 2500);
        } else if (latest?.status === 'completed') {
          const updated = await apiGet<DemoProject>(`/projects/${project.id}`);
          if (!cancelled && updated.video.videoId !== project.video.videoId) onComplete(updated);
        } else if (latest?.status === 'failed') {
          if (restoredJobRef.current !== latest.id) {
            restoredJobRef.current = latest.id;
            setEdit(restoreTimeline(project.video.duration, latest.cuts, {
              muteAll: latest.muteAll ?? false, muteRanges: latest.muteRanges ?? [],
            }));
          }
          setError(MSG.cutFailed);
        }
      } catch (err) {
        if (!cancelled) {
          setStatusError(true);
          setError(err instanceof Error ? err.message : MSG.cutStatusError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [project.id, project.video.videoId, project.video.duration, retry, onComplete, MSG.cutFailed, MSG.cutStatusError]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let first = true;
    const check = async () => {
      try {
        const result = await getAudioWaveform(project.id, first && waveRetry > 0);
        first = false;
        if (cancelled) return;
        if (result.videoId !== project.video.videoId) throw new Error(MSG.cutStatusError);
        setWaveform(result);
        setWaveError(result.status === 'failed' ? MSG.editWaveError : '');
        if (result.status === 'queued' || result.status === 'processing') timer = setTimeout(() => void check(), 2500);
      } catch (err) {
        if (!cancelled) setWaveError(err instanceof Error ? err.message : MSG.editWaveError);
      }
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [project.id, project.video.videoId, waveRetry, MSG.editWaveError, MSG.cutStatusError]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const state = editRef.current;
      if (video && !video.paused) {
        const source = video.currentTime;
        const clip = state.clips.find((item) => source >= item.start && source < item.end);
        if (clip) {
          video.muted = state.muteAll || clip.muted;
          setCurrentTime(sourceToTimeline(state.clips, source) ?? 0);
        } else {
          const next = state.clips.find((item) => item.start > source);
          if (next) {
            video.muted = state.muteAll || next.muted;
            video.currentTime = next.start;
            setCurrentTime(sourceToTimeline(state.clips, next.start) ?? 0);
          } else {
            video.pause();
            setIsPlaying(false);
            setCurrentTime(timelineDuration(state.clips));
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const commitEdit = (next: TimelineEdit, nextTime = currentTime) => {
    pause();
    setUndoStack((stack) => [...stack.slice(-49), edit]);
    setRedoStack([]);
    setEdit(next);
    seek(nextTime, next);
    setError('');
  };

  const split = () => {
    try {
      const next = splitTimeline(edit, currentTime);
      commitEdit(next);
      const source = timelineToSource(next.clips, currentTime);
      setSelectedId(next.clips.find((clip) => Math.abs(clip.start - source) < 1e-6)?.id ?? null);
    } catch { setError(MSG.editSplitError); }
  };

  const remove = () => {
    try {
      if (!selectedId) throw new Error(MSG.editSelectClip);
      const index = edit.clips.findIndex((clip) => clip.id === selectedId);
      const start = timelineDuration(edit.clips.slice(0, index));
      const length = selected ? selected.end - selected.start : 0;
      const next = deleteTimelineClip(edit, selectedId, project.video.duration);
      commitEdit(next, currentTime <= start ? currentTime : currentTime >= start + length ? currentTime - length : start);
      setSelectedId(next.clips[Math.min(index, next.clips.length - 1)]?.id ?? null);
    } catch { setError(selectedId ? MSG.editDeleteError : MSG.editSelectClip); }
  };

  const toggleMute = () => {
    if (!selected || edit.muteAll) return;
    const next = { ...edit, clips: edit.clips.map((clip) => clip.id === selectedId ? { ...clip, muted: !clip.muted } : clip) };
    const audio = timelineEdits(next, project.video.duration);
    if (audio.muteRanges.length > 50) { setError(MSG.editRangeLimit); return; }
    commitEdit(next);
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    pause();
    setRedoStack((stack) => [...stack, edit]);
    setUndoStack((stack) => stack.slice(0, -1));
    setEdit(previous);
    setSelectedId(null);
    seek(currentTime, previous);
    setError('');
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    pause();
    setUndoStack((stack) => [...stack, edit]);
    setRedoStack((stack) => stack.slice(0, -1));
    setEdit(next);
    setSelectedId(null);
    seek(currentTime, next);
    setError('');
  };

  const playPause = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) { pause(); return; }
    seek(currentTime >= duration - 0.001 ? 0 : currentTime);
    try { await video.play(); } catch (err) { setError(err instanceof Error ? err.message : MSG.playerVideoError); }
  };

  const apply = async () => {
    setConfirm(false);
    setStarting(true);
    setError('');
    pause();
    try {
      const validated = normalizeVideoEdits(changes.cuts, changes.muteRanges, changes.muteAll, project.video.duration);
      setJob(await startVideoCut(project, validated.cuts, validated));
      setRetry((value) => value + 1);
    } catch (err) {
      setStatusError(true);
      setError(err instanceof Error ? err.message : MSG.cutStatusError);
    } finally { setStarting(false); }
  };

  return (
    <Dialog open onOpenChange={(_, data) => {
      if (!data.open && !busy) { if (confirm) setConfirm(false); else onClose(); }
    }}>
      <DialogSurface style={{ maxWidth: '1440px', width: '96vw', maxHeight: '96vh' }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
            || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
          const key = event.key.toLowerCase();
          const modifier = event.ctrlKey || event.metaKey;
          if (locked) return;
          if ((!modifier && !event.altKey && (key === 's' || key === 'delete'))
            || (modifier && (key === 'z' || key === 'y'))) {
            event.preventDefault();
            event.stopPropagation();
            if (event.repeat) return;
            if (modifier) { if (key === 'y' || event.shiftKey) redo(); else undo(); }
            else if (key === 's') split(); else remove();
          } else if (key === ' ' && !(event.target instanceof Element && event.target.closest('button'))) {
            event.preventDefault();
            event.stopPropagation();
            void playPause();
          }
        }}>
        <DialogBody>
          <DialogTitle>{MSG.cutTitle}</DialogTitle>
          <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Text>{MSG.editHelp}</Text>
            {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
            {statusError && <Button onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>{MSG.retry}</Button>}
            {busy && <Spinner label={active || starting ? MSG.cutProcessing : MSG.cutLoading} />}
            <video ref={videoRef} src={videoUrl} playsInline
              aria-label={MSG.editPreview}
              style={{ width: '100%', height: 'min(30vh, 320px)', backgroundColor: tokens.colorNeutralBackgroundInverted }}
              onLoadedMetadata={() => seek(currentTime)}
              onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
              onEnded={() => { setIsPlaying(false); setCurrentTime(duration); }}
              onError={() => setError(MSG.playerVideoError)}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <Button icon={isPlaying ? <PauseRegular /> : <PlayRegular />} disabled={locked}
                onClick={() => void playPause()}>{isPlaying ? MSG.editPause : MSG.play}</Button>
              <Button disabled={locked} aria-label={MSG.editPrevFrame} onClick={() => { pause(); seek(currentTime - FRAME_DURATION); }}>&lt;</Button>
              <Button disabled={locked} aria-label={MSG.editNextFrame} onClick={() => { pause(); seek(currentTime + FRAME_DURATION); }}>&gt;</Button>
              <Label htmlFor="edit-playhead">{MSG.editPlayhead}</Label>
              <Input id="edit-playhead" type="number" min={0} max={duration} step={FRAME_DURATION}
                disabled={locked} value={Number(currentTime.toFixed(3)).toString()}
                style={{ width: '110px' }} onChange={(_, data) => {
                  const value = Number(data.value);
                  if (data.value.trim() && Number.isFinite(value)) { pause(); seek(value); }
                }} />
              <Text style={{ fontFamily: 'Consolas, monospace' }}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
              <Button icon={<ArrowUndoRegular />} disabled={locked || !undoStack.length} aria-label={MSG.editUndo} onClick={undo} />
              <Button icon={<ArrowRedoRegular />} disabled={locked || !redoStack.length} aria-label={MSG.editRedo} onClick={redo} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <Button icon={<CutRegular />} disabled={locked} onClick={split}>{MSG.editSplit}</Button>
              <Button icon={<DeleteRegular />} disabled={locked || !selected} onClick={remove}>{MSG.editDelete}</Button>
              <ToggleButton icon={<SpeakerMuteRegular />} checked={selected?.muted ?? false}
                disabled={locked || !selected || edit.muteAll} onClick={toggleMute}>{MSG.editMuteClip}</ToggleButton>
              <ToggleButton icon={<SpeakerMuteRegular />} checked={edit.muteAll} disabled={locked}
                onClick={() => commitEdit({ ...edit, muteAll: !edit.muteAll })}>{MSG.editMuteAll}</ToggleButton>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button disabled={zoom <= 1} aria-label={MSG.editZoomOut} onClick={() => setZoom((value) => value / 2)}>-</Button>
                <Text>{zoom}x</Text>
                <Button disabled={zoom >= 16} aria-label={MSG.editZoomIn} onClick={() => setZoom((value) => value * 2)}>+</Button>
              </div>
            </div>
            <VideoEditTimeline clips={edit.clips} duration={duration} currentTime={currentTime}
              selectedId={selectedId} muteAll={edit.muteAll} waveform={waveform} clickPoints={project.clickPoints}
              zoom={zoom} disabled={locked} onSelect={setSelectedId} onSeek={(time) => { pause(); seek(time); }} />
            {waveError ? (
              <MessageBar intent="warning"><MessageBarBody>
                {waveError} <Button size="small" onClick={() => { setWaveError(''); setWaveRetry((value) => value + 1); }}>{MSG.editWaveRetry}</Button>
              </MessageBarBody></MessageBar>
            ) : waveform?.status === 'completed'
              ? <Text size={200}>{waveform.hasAudio ? MSG.editWaveReady : MSG.editNoAudio}</Text>
              : <Spinner size="tiny" label={MSG.editWaveLoading} />}
            <Text>{MSG.cutSummary(duration.toFixed(2), removedPoints)}</Text>
            {selected && <Text size={200}>{MSG.editSelection(formatTime(selected.start), formatTime(selected.end))}</Text>}
            {confirm && <MessageBar intent="warning"><MessageBarBody>{MSG.editConfirm(removedPoints, duration.toFixed(2))}</MessageBarBody></MessageBar>}
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => { if (confirm) setConfirm(false); else onClose(); }}>{confirm ? MSG.cancel : MSG.close}</Button>
            <Button appearance="primary" disabled={busy || statusError || !hasChanges}
              onClick={() => { pause(); if (confirm) void apply(); else setConfirm(true); }}>{MSG.editApply}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
