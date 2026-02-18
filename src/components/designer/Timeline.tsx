import {} from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import type { ClickPoint } from '@/types';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    height: '40px',
    backgroundColor: '#F5F5F5',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    userSelect: 'none',
  },
  track: {
    position: 'absolute',
    top: '50%',
    left: '16px',
    right: '16px',
    height: '2px',
    backgroundColor: tokens.colorNeutralStroke1,
    transform: 'translateY(-50%)',
  },
  playhead: {
    position: 'absolute',
    top: '4px',
    bottom: '4px',
    width: '2px',
    backgroundColor: tokens.colorBrandBackground,
    zIndex: 3,
    pointerEvents: 'none',
  },
  cpMarker: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#0078D4',
    zIndex: 2,
    cursor: 'grab',
    '&:hover': {
      transform: 'translate(-50%, -50%) scale(1.3)',
    },
  },
  timeLabel: {
    position: 'absolute',
    top: '2px',
    right: '18px',
    pointerEvents: 'none',
  },
});

interface TimelineProps {
  duration: number;
  currentTime: number;
  clickPoints: ClickPoint[];
  onSeek: (time: number) => void;
}

export default function Timeline({
  duration,
  currentTime,
  clickPoints,
  onSeek,
}: TimelineProps) {
  const classes = useStyles();
  const padding = 16; // px left/right padding

  const timeToPercent = (t: number) => {
    if (duration <= 0) return 0;
    return (t / duration) * 100;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const trackWidth = rect.width - padding * 2;
    const x = e.clientX - rect.left - padding;
    const clamped = Math.max(0, Math.min(trackWidth, x));
    const time = (clamped / trackWidth) * duration;
    onSeek(Math.round(time * 100) / 100);
  };

  return (
    <div className={classes.root} onClick={handleClick}>
      <div className={classes.track} />
      {/* Playhead */}
      <div
        className={classes.playhead}
        style={{
          left: `calc(${padding}px + (100% - ${padding * 2}px) * ${timeToPercent(currentTime)} / 100)`,
        }}
      />

      {/* クリックポイントマーカー */}
      {clickPoints.map((cp) => (
        <div
          key={cp.id}
          className={classes.cpMarker}
          style={{
            left: `calc(${padding}px + (100% - ${padding * 2}px) * ${timeToPercent(cp.timestamp)} / 100)`,
          }}
          title={`CP${cp.order}: ${cp.description || cp.timestamp.toFixed(2)}s`}
        />
      ))}

      <Text size={100} className={classes.timeLabel}>
        {formatShort(currentTime)} / {formatShort(duration)}
      </Text>
    </div>
  );
}

function formatShort(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
}
