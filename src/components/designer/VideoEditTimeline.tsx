import { useRef } from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import type { ClickPoint } from '@/types';
import type { AudioWaveform } from '../../../api/src/shared/videoCuts';
import { FRAME_DURATION, sourceToTimeline, type TimelineClip } from '../../../api/src/shared/videoTimeline';
import { useMsg } from '@/hooks/useMsg';
import { formatTime } from '@/utils/time';

const useStyles = makeStyles({
  scroll: {
    overflowX: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  timeline: {
    position: 'relative',
    height: '210px',
    userSelect: 'none',
    touchAction: 'none',
    outlineOffset: '-2px',
  },
  ruler: {
    position: 'absolute', top: 0, height: '30px', width: '100%',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    color: tokens.colorNeutralForeground2, cursor: 'crosshair',
  },
  clip: {
    position: 'absolute', top: '35px', height: '145px', boxSizing: 'border-box',
    padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer',
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
  },
  selected: {
    border: `3px solid ${tokens.colorBrandStroke1}`,
    boxShadow: `inset 0 0 0 1px ${tokens.colorNeutralBackground1}`,
  },
  clipName: {
    display: 'block', height: '30px', padding: '4px 8px', overflow: 'hidden', whiteSpace: 'nowrap',
    fontWeight: tokens.fontWeightSemibold, boxSizing: 'border-box',
  },
  waveform: {
    display: 'block', width: '100%', height: '80px', color: tokens.colorBrandForeground1,
  },
  muted: {
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground3,
  },
  playhead: {
    position: 'absolute', top: 0, bottom: '4px', width: '2px',
    backgroundColor: tokens.colorPaletteRedForeground1,
    pointerEvents: 'none', zIndex: 3,
  },
  point: {
    position: 'absolute', bottom: '8px', width: '8px', height: '8px',
    backgroundColor: tokens.colorBrandForeground1, borderRadius: '50%',
    transform: 'translateX(-50%)', pointerEvents: 'none',
  },
});

interface Props {
  clips: TimelineClip[];
  duration: number;
  currentTime: number;
  selectedId: string | null;
  muteAll: boolean;
  waveform: AudioWaveform | null;
  clickPoints: ClickPoint[];
  zoom: number;
  disabled: boolean;
  onSelect: (id: string) => void;
  onSeek: (time: number) => void;
}

function waveformPath(waveform: AudioWaveform, start: number, end: number): string {
  const count = waveform.peaks.length;
  if (!count) return '';
  const first = Math.max(0, Math.floor(start / waveform.duration * count));
  const last = Math.min(count, Math.ceil(end / waveform.duration * count));
  const paths: string[] = [];
  for (let index = first; index < last; index++) {
    const time = (index + 0.5) / count * waveform.duration;
    const x = Math.max(0, Math.min(1000, (time - start) / (end - start) * 1000));
    const height = Math.max(0.5, Math.min(38, (waveform.peaks[index] ?? 0) * 100));
    paths.push(`M${x.toFixed(2)},${(40 - height).toFixed(2)}V${(40 + height).toFixed(2)}`);
  }
  return paths.join('');
}

export default function VideoEditTimeline(props: Props) {
  const { clips, duration, currentTime, selectedId, muteAll, waveform, clickPoints, zoom, disabled, onSelect, onSeek } = props;
  const classes = useStyles();
  const MSG = useMsg();
  const timelineRef = useRef<HTMLDivElement>(null);
  let offset = 0;
  const layout = clips.map((clip) => {
    const start = offset;
    offset += clip.end - clip.start;
    return { clip, start };
  });
  const tickCount = Math.max(2, Math.ceil(10 * zoom));
  const seekAt = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) onSeek(Math.max(0, Math.min(duration, (clientX - rect.left) / rect.width * duration)));
  };
  return (
    <div className={classes.scroll}>
      <div ref={timelineRef} className={classes.timeline}
        style={{ width: `${zoom * 100}%` }}
        role="group" tabIndex={0} aria-label={MSG.editTimeline} aria-disabled={disabled}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          if (event.target instanceof Element) {
            const id = event.target.closest<HTMLElement>('[data-clip-id]')?.dataset.clipId;
            if (id) onSelect(id);
          }
          seekAt(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!disabled && event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event.clientX);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          if (disabled || event.target !== event.currentTarget) return;
          const next = event.key === 'ArrowLeft' ? currentTime - FRAME_DURATION
            : event.key === 'ArrowRight' ? currentTime + FRAME_DURATION
            : event.key === 'Home' ? 0 : event.key === 'End' ? duration : null;
          if (next !== null) {
            event.preventDefault();
            event.stopPropagation();
            onSeek(Math.max(0, Math.min(duration, next)));
          }
        }}
      >
        <div className={classes.ruler} aria-hidden="true">
          {Array.from({ length: tickCount }, (_, index) => {
            const percent = index / (tickCount - 1) * 100;
            return <span key={index} style={{
              position: 'absolute', left: `${percent}%`, transform: index === tickCount - 1 ? 'translateX(-100%)' : undefined,
              fontSize: '11px', paddingTop: '6px',
            }}>{formatTime(duration * percent / 100)}</span>;
          })}
        </div>
        {layout.map(({ clip, start }, index) => {
          const muted = muteAll || clip.muted;
          return (
            <button key={clip.id} type="button" data-clip-id={clip.id} disabled={disabled}
              aria-label={MSG.editClip(index + 1)} aria-pressed={clip.id === selectedId}
              className={`${classes.clip} ${clip.id === selectedId ? classes.selected : ''} ${muted ? classes.muted : ''}`}
              style={{ left: `${start / duration * 100}%`, width: `${(clip.end - clip.start) / duration * 100}%` }}
              onClick={(event) => { if (event.detail === 0) { onSelect(clip.id); onSeek(start); } }}
            >
              <span className={classes.clipName}>{MSG.editClip(index + 1)}{muted ? ` / ${MSG.editMuted}` : ''}</span>
              <svg className={classes.waveform} viewBox="0 0 1000 80" preserveAspectRatio="none"
                role="img" aria-label={`${MSG.editWaveform}: ${MSG.editClip(index + 1)}`}
                style={{ opacity: muted ? 0.3 : 1 }}>
                <path d="M0,40H1000" fill="none" stroke="currentColor" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                {waveform?.status === 'completed' && (
                  <path d={waveformPath(waveform, clip.start, clip.end)} fill="none"
                    stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                )}
              </svg>
              <Text size={100} style={{ padding: '0 8px', whiteSpace: 'nowrap' }}>
                {formatTime(clip.start)} - {formatTime(clip.end)}
              </Text>
            </button>
          );
        })}
        {clickPoints.map((point) => {
          const time = sourceToTimeline(clips, point.timestamp);
          return time === null ? null : <span key={point.id} className={classes.point}
            title={`CP${point.order}: ${point.description}`} style={{ left: `${time / duration * 100}%` }} />;
        })}
        <div className={classes.playhead} style={{ left: `calc(${currentTime / duration * 100}% - 1px)` }} />
      </div>
    </div>
  );
}
