/**
 * ThumbnailPickerDialog
 * 動画の任意フレームをサムネイルとして選択するダイアログ。
 * DesignerPage の videoRef (DesignerCanvas と共有) を使い、
 * 別途動画を再ダウンロードせずにフレームをキャプチャする。
 */
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ImageRegular } from '@fluentui/react-icons';
import { formatTime } from '@/utils/time';

const PREVIEW_W = 480;

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    minWidth: `${PREVIEW_W}px`,
  },
  hint: { color: tokens.colorNeutralForeground3 },
  canvas: {
    display: 'block',
    width: '100%',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: '#000',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  slider: { flex: 1 },
  currentThumb: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  thumbRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  thumbImg: {
    width: '80px',
    height: '45px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: '#000',
    flexShrink: 0,
  },
});

interface Props {
  open: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  currentThumbnailDataUrl?: string;
  onClose: () => void;
  onConfirm: (thumbnailDataUrl: string) => void;
}

export default function ThumbnailPickerDialog({
  open,
  videoRef,
  duration,
  currentThumbnailDataUrl,
  onClose,
  onConfirm,
}: Props) {
  const styles = useStyles();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [seekTime, setSeekTime] = useState(0);
  const isSeeking = useRef(false);

  // ── フレームをキャンバスに描画 ──────────────────
  const drawFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const W = PREVIEW_W;
    const H = Math.round((W / video.videoWidth) * video.videoHeight) || Math.round(W * 9 / 16);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(video, 0, 0, W, H);
  };

  // ── ダイアログが開いたとき: 現在の動画時刻をラッチ ──
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    const t = video?.currentTime ?? 0;
    setSeekTime(t);
    // 少し待ってから描画（videoがseekしている可能性があるため）
    const id = setTimeout(() => drawFrame(), 80);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── seeked イベントでキャンバスを更新 ──────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !open) return;
    const onSeeked = () => {
      drawFrame();
      isSeeking.current = false;
    };
    video.addEventListener('seeked', onSeeked);
    return () => video.removeEventListener('seeked', onSeeked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── スライダー変更: 動画をシーク ─────────────────
  const handleSliderChange = (newTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    setSeekTime(newTime);
    if (!isSeeking.current) {
      isSeeking.current = true;
      video.currentTime = newTime;
    }
  };

  // ── 確定: キャンバスの現在フレームを JPEG に変換 ──
  const handleConfirm = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) { onClose(); return; }
    // 最新フレームを再描画
    const W = PREVIEW_W;
    const H = Math.round((W / video.videoWidth) * video.videoHeight) || Math.round(W * 9 / 16);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) { onClose(); return; }
    ctx.drawImage(video, 0, 0, W, H);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    onConfirm(dataUrl);
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>サムネイルを設定</DialogTitle>
          <DialogContent>
            <div className={styles.content}>
              <Caption1 className={styles.hint}>
                スライダーで再生位置を調整し、この画面をサムネイルとして設定します。
              </Caption1>

              {/* プレビューキャンバス */}
              <canvas ref={canvasRef} className={styles.canvas} />

              {/* シークスライダー */}
              <div className={styles.sliderRow}>
                <Caption1>{formatTime(seekTime)}</Caption1>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.033}
                  value={seekTime}
                  className={styles.slider}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                />
                <Caption1>{formatTime(duration)}</Caption1>
              </div>

              {/* 現在のサムネイル */}
              {currentThumbnailDataUrl && (
                <div className={styles.currentThumb}>
                  <Caption1 className={styles.hint}>現在のサムネイル</Caption1>
                  <div className={styles.thumbRow}>
                    <img src={currentThumbnailDataUrl} alt="現在のサムネイル" className={styles.thumbImg} />
                    <Caption1 className={styles.hint}>
                      上のプレビューで位置を選んで「設定」を押すと更新されます。
                    </Caption1>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>キャンセル</Button>
            <Button appearance="primary" icon={<ImageRegular />} onClick={handleConfirm}>
              この画面をサムネイルに設定
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
