import { type RefObject, useCallback } from 'react';
import { makeStyles, tokens, Button, Text, Tooltip } from '@fluentui/react-components';
import {
  PlayRegular,
  PauseRegular,
  PreviousRegular,
  NextRegular,
} from '@fluentui/react-icons';
import { formatTime } from '@/utils/time';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  separator: {
    width: '1px',
    height: '20px',
    backgroundColor: tokens.colorNeutralStroke2,
    marginInline: tokens.spacingHorizontalXS,
  },
  skipBtn: {
    minWidth: 'auto',
    fontSize: '12px',
    fontWeight: 600,
  },
  time: {
    fontVariantNumeric: 'tabular-nums',
    minWidth: '80px',
    textAlign: 'center',
    flex: 1,
  },
  speedBtn: {
    minWidth: 'auto',
    fontSize: '12px',
  },
});

interface VideoControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlayPause: () => void;
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const;

export default function VideoControls({
  videoRef,
  currentTime,
  duration,
  isPlaying,
  onPlayPause,
}: VideoControlsProps) {
  const classes = useStyles();

  const handleGoToStart = useCallback(() => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  }, [videoRef]);

  const handleSkip = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    },
    [videoRef],
  );

  const handleFrameStep = useCallback(
    (direction: 'prev' | 'next') => {
      const video = videoRef.current;
      if (!video) return;
      const step = direction === 'next' ? 1 / 30 : -1 / 30; // ~1 frame at 30fps
      const newTime = Math.max(0, Math.min(video.duration, video.currentTime + step));
      video.currentTime = newTime;
    },
    [videoRef],
  );

  const handleSpeedChange = useCallback(
    (speed: number) => {
      const video = videoRef.current;
      if (video) video.playbackRate = speed;
    },
    [videoRef],
  );

  return (
    <div className={classes.root}>
      {/* 最初に戻る / 10秒戻る / 1秒戻る / 0.1秒戻る */}
      <Tooltip content="最初に戻る" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={classes.skipBtn}
          onClick={handleGoToStart}
        >
          ⏮
        </Button>
      </Tooltip>
      <Tooltip content="10秒戻る" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={classes.skipBtn}
          onClick={() => handleSkip(-10)}
        >
          -10s
        </Button>
      </Tooltip>
      <Tooltip content="1秒戻る" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={classes.skipBtn}
          onClick={() => handleSkip(-1)}
        >
          -1s
        </Button>
      </Tooltip>
      <Tooltip content="0.1秒戻る" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={classes.skipBtn}
          onClick={() => handleSkip(-0.1)}
        >
          -0.1s
        </Button>
      </Tooltip>

      <div className={classes.separator} />

      {/* フレームステップ & 再生/一時停止 */}
      <Button
        icon={<PreviousRegular />}
        appearance="subtle"
        size="small"
        onClick={() => handleFrameStep('prev')}
      />
      <Button
        icon={isPlaying ? <PauseRegular /> : <PlayRegular />}
        appearance="subtle"
        onClick={onPlayPause}
      />
      <Button
        icon={<NextRegular />}
        appearance="subtle"
        size="small"
        onClick={() => handleFrameStep('next')}
      />

      <div className={classes.separator} />

      {/* 0.1秒進む / 1秒進む / 10秒進む */}
      <Tooltip content="0.1秒進む" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={classes.skipBtn}
          onClick={() => handleSkip(0.1)}
        >
          +0.1s
        </Button>
      </Tooltip>
      <Tooltip content="1秒進む" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={classes.skipBtn}
          onClick={() => handleSkip(1)}
        >
          +1s
        </Button>
      </Tooltip>
      <Tooltip content="10秒進む" relationship="label">
        <Button
          appearance="subtle"
          size="small"
          className={classes.skipBtn}
          onClick={() => handleSkip(10)}
        >
          +10s
        </Button>
      </Tooltip>

      <Text size={200} className={classes.time}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </Text>

      {SPEEDS.map((speed) => (
        <Button
          key={speed}
          className={classes.speedBtn}
          size="small"
          appearance="subtle"
          onClick={() => handleSpeedChange(speed)}
        >
          {speed}x
        </Button>
      ))}
    </div>
  );
}
