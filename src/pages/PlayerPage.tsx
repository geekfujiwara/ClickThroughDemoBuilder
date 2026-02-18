import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Dialog,
  DialogBody,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import {
  DismissRegular,
  FullScreenMaximizeRegular,
  PlayRegular,
} from '@fluentui/react-icons';
import type { DemoProject, ClickPoint, PlayerState } from '@/types';
import { PULSE_DURATION_MAP, DEFAULT_DESCRIPTION_STYLE } from '@/types';
import { getProject } from '@/services/projectService';
import { getVideoUrl } from '@/services/videoService';
import { logDemoUsage } from '@/services/usageService';
import { MSG } from '@/constants/messages';
import { formatTime } from '@/utils/time';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    zIndex: 10,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
  },
  topBarMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
    overflow: 'hidden',
  },
  topBarTitle: {
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '60vw',
  },
  topBarTime: {
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  topBarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  topBarActionBtn: {
    color: '#fff',
  },
  videoContainer: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 80px)',
  },
  video: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 80px)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
  },
  overlayCenter: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  overlayStartButton: {
    pointerEvents: 'auto',
    backgroundColor: 'rgba(0,0,0,0.72)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.32)',
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.88)',
      color: '#fff',
    },
  },
  overlayLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    color: '#fff',
  },
  clickPoint: {
    position: 'absolute',
    borderRadius: '50%',
    backgroundColor: '#FFEB3B4D',
    border: '2px solid #FFEB3BB3',
    cursor: 'pointer',
    transform: 'translate(-50%, -50%)',
    transition: 'transform 0.15s ease',
    '&:hover': {
      transform: 'translate(-50%, -50%) scale(1.15)',
      backgroundColor: '#FFEB3B80',
    },
  },
  clickPointRect: {
    position: 'absolute',
    backgroundColor: '#FFEB3B4D',
    border: '2px solid #FFEB3BB3',
    cursor: 'pointer',
    transform: 'translate(-50%, -50%)',
    transition: 'transform 0.15s ease',
    '&:hover': {
      transform: 'translate(-50%, -50%) scale(1.05)',
      backgroundColor: '#FFEB3B80',
    },
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    maxWidth: '200px',
    wordBreak: 'break-word',
    padding: '4px 12px',
  },
  descriptionNearCp: {
    position: 'absolute',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    maxWidth: '200px',
    wordBreak: 'break-word',
    padding: '6px 10px',
    lineHeight: '1.5',
    boxSizing: 'border-box',
  },
  progressArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL} ${tokens.spacingVerticalM}`,
    background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  controlBtn: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.85)',
      color: '#fff',
    },
  },
  timelineWrap: {
    position: 'relative',
  },
  timelineSlider: {
    width: '100%',
    margin: 0,
  },
  timelineLabel: {
    color: '#fff',
    marginBottom: tokens.spacingVerticalXXS,
  },
  cpMarkerLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: '0px',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  cpMarker: {
    position: 'absolute',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#FFD84D',
    border: '1px solid rgba(0,0,0,0.45)',
    transform: 'translate(-50%, -50%)',
  },
  stepText: {
    color: '#fff',
  },
  nextCpArea: {
    position: 'absolute',
    bottom: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  nextCpBtn: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    ':hover': {
      backgroundColor: 'rgba(0,0,0,0.85)',
      color: '#fff',
    },
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
    color: '#fff',
  },
});

export default function PlayerPage() {
  const classes = useStyles();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const loggedStartRef = useRef(false);
  const loggedCompleteRef = useRef(false);

  const [project, setProject] = useState<DemoProject | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('INIT');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  // ソート済みクリックポイント
  const sortedClickPoints = useMemo(
    () => (project?.clickPoints ?? []).slice().sort((a, b) => a.order - b.order),
    [project?.clickPoints],
  );

  const currentCp: ClickPoint | undefined = sortedClickPoints[currentStepIndex];

  // プロジェクト読み込み
  useEffect(() => {
    if (!projectId) return;
    loggedStartRef.current = false;
    loggedCompleteRef.current = false;
    (async () => {
      try {
        const p = await getProject(projectId);
        if (!p) {
          setError('プロジェクトが見つかりません。');
          return;
        }
        setProject(p);
        setCurrentTime(0);
        setPlayerState('INIT');
        setHasStarted(false);
        setIsVideoReady(false);
        setIsBuffering(true);
        if (!loggedStartRef.current) {
          loggedStartRef.current = true;
          void logDemoUsage(projectId, 'view_start').catch(() => undefined);
        }
        const url = await getVideoUrl(p.video.videoId);
        if (!url) {
          setError(MSG.playerVideoError);
          return;
        }
        setVideoUrl(url);
      } catch {
        setError(MSG.playerVideoError);
      }
    })();
  }, [projectId]);

  // SAS URL はオブジェクト URL ではないのでクリーンアップ不要
  useEffect(() => {
    return () => {
      // noop — SAS URL は解放不要
    };
  }, [videoUrl]);

  // 動画準備完了 → 自動再生
  const handleCanPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsVideoReady(true);
    setIsBuffering(false);
    setCurrentTime(video.currentTime);
    if (!hasStarted) {
      video.pause();
    }
  }, [hasStarted]);

  // requestAnimationFrame で高精度にCPタイムスタンプを検出 (~60Hz)
  useEffect(() => {
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        if (!video.paused) {
          setCurrentTime(video.currentTime);
        }
        if (hasStarted && !video.paused && currentCp) {
          if (video.currentTime >= currentCp.timestamp) {
            video.pause();
            // タイムスタンプの位置に正確に巻き戻す
            video.currentTime = currentCp.timestamp;
            setCurrentTime(currentCp.timestamp);
            setPlayerState('WAITING');
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentCp, hasStarted]);

  // onTimeUpdate はシーク反映のために利用
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  }, []);

  const syncStepByTime = useCallback((time: number) => {
    if (sortedClickPoints.length === 0) {
      setCurrentStepIndex(0);
      return;
    }
    const index = sortedClickPoints.findIndex((cp) => cp.timestamp >= time - 0.001);
    setCurrentStepIndex(index >= 0 ? index : sortedClickPoints.length);
  }, [sortedClickPoints]);

  const handleStartPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    setPlayerState('PLAYING');
    void video.play();
  }, []);

  // クリックポイントをクリック → 次ステップへ
  const handleClickPointClick = useCallback(() => {
    if (playerState !== 'WAITING') return;
    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= sortedClickPoints.length) {
      // 最後のCPをクリック → 動画を最後まで再生し続ける
      setCurrentStepIndex(nextIndex); // 範囲外にしてCPを非表示にする
      setPlayerState('PLAYING');
      videoRef.current?.play();
      return;
    }

    setCurrentStepIndex(nextIndex);
    setPlayerState('PLAYING');
    videoRef.current?.play();
  }, [playerState, currentStepIndex, sortedClickPoints.length]);

  // リスタート
  const handleRestart = useCallback(() => {
    setCurrentStepIndex(0);
    setCurrentTime(0);
    setPlayerState('PLAYING');
    setShowCompletion(false);
    setHasStarted(true);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play();
    }
  }, []);

  const handleGoToPreviousClickPoint = useCallback(() => {
    const video = videoRef.current;
    if (!video || sortedClickPoints.length === 0) return;

    const current = video.currentTime;
    let targetIndex = -1;
    for (let i = sortedClickPoints.length - 1; i >= 0; i--) {
      if (sortedClickPoints[i]!.timestamp < current - 0.05) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex < 0) return;

    const target = sortedClickPoints[targetIndex]!;
    video.pause();
    video.currentTime = target.timestamp;
    setCurrentTime(target.timestamp);
    setCurrentStepIndex(targetIndex);
    setPlayerState('WAITING');
  }, [sortedClickPoints]);

  const handleSliderSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(video.duration || time, time));
    video.currentTime = clamped;
    setCurrentTime(clamped);
    syncStepByTime(clamped);
  }, [syncStepByTime]);

  // フルスクリーン
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // キーボード
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFullscreen, navigate]);

  // (visibleAnnotations removed)

  // --- Loading / Error ---
  if (error) {
    return (
      <div className={classes.root}>
        <div className={classes.loading}>
          <Text size={400}>{error}</Text>
          <Button appearance="primary" onClick={() => navigate('/')}>
            {MSG.playerBackHome}
          </Button>
        </div>
      </div>
    );
  }

  if (!project || !videoUrl) {
    return (
      <div className={classes.root}>
        <div className={classes.loading}>
          <Spinner size="large" />
          <Text size={300}>{MSG.playerLoading}</Text>
        </div>
      </div>
    );
  }

  const duration = project.video.duration || 0;

  return (
    <div className={classes.root}>
      {/* Top bar */}
      <div className={classes.topBar}>
        <div className={classes.topBarMeta}>
          <Text className={classes.topBarTitle} weight="semibold">{project.title}</Text>
          <Text className={classes.topBarTime} size={200}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </div>
        <div className={classes.topBarActions}>
          <Button
            icon={<FullScreenMaximizeRegular />}
            appearance="subtle"
            className={classes.topBarActionBtn}
            onClick={toggleFullscreen}
          />
          <Button
            icon={<DismissRegular />}
            appearance="subtle"
            className={classes.topBarActionBtn}
            onClick={() => navigate(-1)}
          />
        </div>
      </div>

      {/* Video */}
      <div className={classes.videoContainer}>
        <video
          ref={videoRef}
          className={classes.video}
          src={videoUrl}
          onCanPlay={handleCanPlay}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            // 動画が最後まで再生されたら完了
            setPlayerState('COMPLETE');
            setShowCompletion(true);
            if (projectId && !loggedCompleteRef.current) {
              loggedCompleteRef.current = true;
              void logDemoUsage(projectId, 'view_complete').catch(() => undefined);
            }
          }}
        />

        {/* Overlay */}
        <div className={classes.overlay}>
          {isVideoReady && !hasStarted && !showCompletion && (
            <div className={classes.overlayCenter}>
              <Button
                icon={<PlayRegular />}
                size="large"
                className={classes.overlayStartButton}
                onClick={handleStartPlayback}
              >
                {MSG.playerStartOverlay}
              </Button>
            </div>
          )}

          {isBuffering && (
            <div className={classes.overlayCenter}>
              <div className={classes.overlayLoading}>
                <Spinner size="tiny" />
                <Text>{MSG.playerLoadingVideo}</Text>
              </div>
            </div>
          )}

          {/* クリックポイント (待機中のみ表示) */}
          {playerState === 'WAITING' && currentCp && (() => {
            const descStyle = currentCp.descriptionStyle ?? DEFAULT_DESCRIPTION_STYLE;
            const descOffset = currentCp.descriptionOffset ?? { x: 5, y: -10 };
            return (
              <>
                <div
                  className={
                    currentCp.area.type === 'circle' ? classes.clickPoint : classes.clickPointRect
                  }
                  style={{
                    left: `${currentCp.position.x}%`,
                    top: `${currentCp.position.y}%`,
                    ...(currentCp.area.type === 'circle'
                      ? {
                          width: `${currentCp.area.radius * 2}px`,
                          height: `${currentCp.area.radius * 2}px`,
                        }
                      : {
                          width: `${currentCp.area.width}px`,
                          height: `${currentCp.area.height}px`,
                          borderRadius: '4px',
                        }),
                    animation: `clickPointPulse ${PULSE_DURATION_MAP[currentCp.pulseSpeed]}s ease-in-out infinite`,
                  }}
                  onClick={handleClickPointClick}
                />
                {/* 説明テキスト (CP付近に表示) */}
                {currentCp.description && (
                  <div
                    className={classes.descriptionNearCp}
                    style={{
                      left: `${Math.max(0, Math.min(100, currentCp.position.x + descOffset.x))}%`,
                      top: `${Math.max(0, Math.min(100, currentCp.position.y + descOffset.y))}%`,
                      color: descStyle.color,
                      backgroundColor: descStyle.backgroundColor,
                      fontSize: `${descStyle.fontSize}px`,
                      border: `1px solid ${descStyle.borderColor}`,
                      borderRadius: `${descStyle.borderRadius}px`,
                    }}
                  >
                    {currentCp.description}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* 次のCPまで再生ボタン */}
      {playerState === 'WAITING' && currentCp && (
        <div className={classes.nextCpArea}>
          <Button
            icon={<PlayRegular />}
            className={classes.nextCpBtn}
            size="medium"
            onClick={handleClickPointClick}
          >
            次のクリックポイントまで再生
          </Button>
        </div>
      )}

      {/* Progress */}
      {project.settings.showProgress && (
        <div className={classes.progressArea}>
          <div className={classes.controlsRow}>
            <Button className={classes.controlBtn} size="small" onClick={handleRestart}>
              {MSG.playerRestartFromBeginning}
            </Button>
            <Button
              className={classes.controlBtn}
              size="small"
              disabled={sortedClickPoints.length === 0}
              onClick={handleGoToPreviousClickPoint}
            >
              {MSG.playerPrevClickPoint}
            </Button>
            {sortedClickPoints.length > 0 ? (
              <Text size={200} className={classes.stepText}>
                {MSG.playerStep(
                  Math.min(currentStepIndex + 1, sortedClickPoints.length),
                  sortedClickPoints.length,
                )}
              </Text>
            ) : null}
          </div>

          <Text size={200} className={classes.timelineLabel}>{MSG.playerTimelineLabel}</Text>
          <div className={classes.timelineWrap}>
            <input
              className={classes.timelineSlider}
              type="range"
              aria-label={MSG.playerTimelineLabel}
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.01}
              value={Math.max(0, Math.min(currentTime, Math.max(duration, 0.01)))}
              onChange={(e) => handleSliderSeek(Number(e.target.value))}
            />
            <div className={classes.cpMarkerLayer}>
              {sortedClickPoints.map((cp) => (
                <span
                  key={cp.id}
                  className={classes.cpMarker}
                  style={{ left: `${duration > 0 ? (cp.timestamp / duration) * 100 : 0}%` }}
                  title={`CP${cp.order}: ${formatTime(cp.timestamp)}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Completion dialog */}
      <Dialog open={showCompletion}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>🎉 {MSG.playerComplete}</DialogTitle>
            <DialogContent>
              <Text>{project.settings.completionMessage}</Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={handleRestart}>
                {MSG.playerRestart}
              </Button>
              <Button appearance="primary" onClick={() => navigate('/')}>
                {MSG.playerBackHome}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
