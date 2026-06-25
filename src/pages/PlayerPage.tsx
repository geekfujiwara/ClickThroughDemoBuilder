import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Tooltip,
  Dialog,
  DialogBody,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
} from '@fluentui/react-components';
import {
  DismissRegular,
  FullScreenMaximizeRegular,
  PlayRegular,
  HeartRegular,
  HeartFilled,
  BookmarkRegular,
  BookmarkFilled,
  PresenterRegular,
} from '@fluentui/react-icons';
import type { DemoProject, ClickPoint, PlayerState } from '@/types';
import { PULSE_DURATION_MAP, DEFAULT_DESCRIPTION_STYLE } from '@/types';
import { getProject } from '@/services/projectService';
import { getVideoUrl } from '@/services/videoService';
import { logDemoUsage } from '@/services/usageService';
import {
  addLike, removeLike, getLikeStatus,
  getFavorites, addFavorite, removeFavorite,
} from '@/services/socialService';
import { useAuthStore } from '@/stores/authStore';
import { useMsg } from '@/hooks/useMsg';
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
    zIndex: 20,
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
  conferenceModeBtn: {
    color: '#fff',
  },
  conferenceVideoContainer: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: '100vh',
  },
  conferenceVideo: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '100vh',
    cursor: 'default',
  },
  conferenceClickPoint: {
    position: 'absolute',
    cursor: 'pointer',
    transform: 'translate(-50%, -50%)',
  },
  shortcutList: {
    listStyleType: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacingVerticalS,
  },
  shortcutItem: {
    fontFamily: 'monospace',
    fontSize: '14px',
  },
  shortcutCheckbox: {
    marginTop: tokens.spacingVerticalM,
  },
});

export default function PlayerPage() {
  const MSG = useMsg();
  const classes = useStyles();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // ゲストモード検出 (authStore から)
  const isGuest = useAuthStore((s) => s.isGuest);

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

  // ソーシャル状態
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);

  // カンファレンスモード
  const [isConferenceMode, setIsConferenceMode] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // いいね・お気に入りのロード (ゲストモードでは無効)
  useEffect(() => {
    if (!projectId || isGuest) return;
    getLikeStatus(projectId)
      .then((res) => {
        setIsLiked(res.liked);
        setLikeCount(res.count);
      })
      .catch(() => undefined);
    getFavorites()
      .then((favs) => {
        setIsFavorited(favs.some((f) => f.demoId === projectId));
      })
      .catch(() => undefined);
  }, [projectId, isGuest]);

  const handleLikeToggle = useCallback(async () => {
    if (!projectId) return;
    if (isLiked) {
      setIsLiked(false);
      setLikeCount((n) => Math.max(0, n - 1));
      try { await removeLike(projectId); } catch { setIsLiked(true); setLikeCount((n) => n + 1); }
    } else {
      setIsLiked(true);
      setLikeCount((n) => n + 1);
      try { await addLike(projectId); } catch { setIsLiked(false); setLikeCount((n) => Math.max(0, n - 1)); }
    }
  }, [projectId, isLiked]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!projectId) return;
    if (isFavorited) {
      setIsFavorited(false);
      try { await removeFavorite(projectId); } catch { setIsFavorited(true); }
    } else {
      setIsFavorited(true);
      try { await addFavorite(projectId); } catch { setIsFavorited(false); }
    }
  }, [projectId, isFavorited]);

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

  // カンファレンスモード切り替え
  const handleEnterConferenceMode = useCallback(() => {
    setIsConferenceMode(true);
    const hideShortcuts = localStorage.getItem('conference-mode-hide-shortcuts');
    if (hideShortcuts !== 'true') {
      setShowShortcutsModal(true);
    }
  }, []);

  const handleExitConferenceMode = useCallback(() => {
    setIsConferenceMode(false);
  }, []);

  // キーボード
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ショートカットモーダルが表示中はEscで閉じるだけ
      if (showShortcutsModal) {
        if (e.key === 'Escape') {
          setShowShortcutsModal(false);
        }
        return;
      }

      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (isConferenceMode) {
          handleExitConferenceMode();
        } else if (!document.fullscreenElement) {
          navigate(-1);
        }
      } else if (isConferenceMode) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleGoToPreviousClickPoint();
        } else if ((e.key === ' ' || e.key === 'Enter') && playerState === 'WAITING') {
          e.preventDefault();
          handleClickPointClick();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          handleRestart();
        }
      } else {
        // 通常モードのキーボードショートカット
        if ((e.key === ' ' || e.key === 'Enter') && !hasStarted && isVideoReady) {
          e.preventDefault();
          handleStartPlayback();
        } else if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && playerState === 'WAITING') {
          e.preventDefault();
          handleClickPointClick();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleGoToPreviousClickPoint();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          handleRestart();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleFullscreen, navigate, isConferenceMode, showShortcutsModal, handleExitConferenceMode, handleGoToPreviousClickPoint, handleClickPointClick, handleRestart, handleStartPlayback, playerState, hasStarted, isVideoReady]);

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
      {/* Top bar — カンファレンスモードでは非表示 */}
      {!isConferenceMode && (
      <div className={classes.topBar}>
        <div className={classes.topBarMeta}>
          <Text className={classes.topBarTitle} weight="semibold">{project.title}</Text>
          <Text className={classes.topBarTime} size={200}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
          {isGuest && (
            <Text size={200} style={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>
              (ゲスト閲覧)
            </Text>
          )}
        </div>
        <div className={classes.topBarActions}>
          {!isGuest && (
            <>
              <Tooltip content={isLiked ? MSG.unlike : MSG.like} relationship="label">
                <Button
                  icon={isLiked ? <HeartFilled style={{ color: '#ff6b81' }} /> : <HeartRegular />}
                  appearance="subtle"
                  className={classes.topBarActionBtn}
                  onClick={() => void handleLikeToggle()}
                >
                  {likeCount > 0 ? likeCount : undefined}
                </Button>
              </Tooltip>
              <Tooltip content={isFavorited ? MSG.unfavorite : MSG.favorite} relationship="label">
                <Button
                  icon={isFavorited ? <BookmarkFilled style={{ color: '#f0c040' }} /> : <BookmarkRegular />}
                  appearance="subtle"
                  className={classes.topBarActionBtn}
                  onClick={() => void handleFavoriteToggle()}
                />
              </Tooltip>
            </>
          )}
          <Tooltip content={MSG.conferenceMode} relationship="label">
            <Button
              icon={<PresenterRegular />}
              appearance="subtle"
              className={classes.conferenceModeBtn}
              onClick={handleEnterConferenceMode}
            />
          </Tooltip>
          <Button
            icon={<FullScreenMaximizeRegular />}
            appearance="subtle"
            className={classes.topBarActionBtn}
            onClick={toggleFullscreen}
          />
          {!isGuest ? (
            <Button
              icon={<DismissRegular />}
              appearance="subtle"
              className={classes.topBarActionBtn}
              onClick={() => navigate(-1)}
            />
          ) : (
            <Button
              icon={<DismissRegular />}
              appearance="subtle"
              className={classes.topBarActionBtn}
              onClick={() => navigate('/?guestMode=true')}
            />
          )}
        </div>
      </div>
      )}

      {/* Video */}
      <div className={isConferenceMode ? classes.conferenceVideoContainer : classes.videoContainer}>
        <video
          ref={videoRef}
          className={isConferenceMode ? classes.conferenceVideo : classes.video}
          src={videoUrl}
          onCanPlay={handleCanPlay}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => {
            setPlayerState('COMPLETE');
            if (!isConferenceMode) {
              setShowCompletion(true);
            }
            if (projectId && !loggedCompleteRef.current) {
              loggedCompleteRef.current = true;
              void logDemoUsage(projectId, 'view_complete').catch(() => undefined);
            }
          }}
        />

        {/* Overlay */}
        <div className={classes.overlay}>
          {isVideoReady && !hasStarted && !showCompletion && !isConferenceMode && (
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

          {isBuffering && !isConferenceMode && (
            <div className={classes.overlayCenter}>
              <div className={classes.overlayLoading}>
                <Spinner size="tiny" />
                <Text>{MSG.playerLoadingVideo}</Text>
              </div>
            </div>
          )}

          {/* クリックポイント (待機中のみ表示) */}
          {playerState === 'WAITING' && currentCp && (() => {
            // カンファレンスモード: 透明だがクリック可能なクリックポイント
            if (isConferenceMode) {
              return (
                <div
                  className={classes.conferenceClickPoint}
                  style={{
                    left: `${currentCp.position.x}%`,
                    top: `${currentCp.position.y}%`,
                    ...(currentCp.area.type === 'circle'
                      ? {
                          width: `${currentCp.area.radius * 2}px`,
                          height: `${currentCp.area.radius * 2}px`,
                          borderRadius: '50%',
                        }
                      : {
                          width: `${currentCp.area.width}px`,
                          height: `${currentCp.area.height}px`,
                        }),
                  }}
                  onClick={handleClickPointClick}
                />
              );
            }

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

      {/* 次のCPまで再生ボタン — カンファレンスモードでは非表示 */}
      {!isConferenceMode && playerState === 'WAITING' && currentCp && (
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

      {/* Progress — カンファレンスモードでは非表示 */}
      {!isConferenceMode && project.settings.showProgress && (
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

      {/* Completion dialog — カンファレンスモードでは非表示 */}
      <Dialog open={showCompletion && !isConferenceMode}>
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
              {isGuest ? (
                <Button appearance="primary" onClick={() => window.location.assign('/login')}>
                  ログインしてフル機能を使う
                </Button>
              ) : (
                <Button appearance="primary" onClick={() => navigate('/')}>
                  {MSG.playerBackHome}
                </Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {/* カンファレンスモード ショートカットモーダル */}
      <Dialog open={showShortcutsModal}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{MSG.conferenceModeShortcuts}</DialogTitle>
            <DialogContent>
              <ul className={classes.shortcutList}>
                <li className={classes.shortcutItem}>{MSG.conferenceModeShortcutClick}</li>
                <li className={classes.shortcutItem}>{MSG.conferenceModeShortcutNext}</li>
                <li className={classes.shortcutItem}>{MSG.conferenceModeShortcutPrev}</li>
                <li className={classes.shortcutItem}>{MSG.conferenceModeShortcutRestart}</li>
                <li className={classes.shortcutItem}>{MSG.conferenceModeShortcutFullscreen}</li>
                <li className={classes.shortcutItem}>{MSG.conferenceModeShortcutExit}</li>
              </ul>
              <div className={classes.shortcutCheckbox}>
                <Checkbox
                  label={MSG.conferenceModeDoNotShowAgain}
                  onChange={(_e, data) => {
                    if (data.checked) {
                      localStorage.setItem('conference-mode-hide-shortcuts', 'true');
                    } else {
                      localStorage.removeItem('conference-mode-hide-shortcuts');
                    }
                  }}
                />
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setShowShortcutsModal(false)}>
                {MSG.conferenceModeStart}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
