import { type RefObject, useCallback, useRef, useState, useEffect } from 'react';
import { makeStyles, tokens, Spinner } from '@fluentui/react-components';
import { useDesignerStore } from '@/stores/designerStore';
import { toPercent, toPixel, getScale } from '@/utils/coordinates';
import { validateClickPointAdd } from '@/utils/validation';
import { PULSE_DURATION_MAP, DEFAULT_DESCRIPTION_STYLE } from '@/types';

const useStyles = makeStyles({
  wrapper: {
    position: 'relative',
    display: 'inline-block',
    lineHeight: 0,
  },
  video: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: tokens.borderRadiusLarge,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: tokens.borderRadiusLarge,
    zIndex: 20,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    cursor: 'crosshair',
  },
  clickPoint: {
    position: 'absolute',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 235, 59, 0.4)',
    border: '2px solid rgba(255, 235, 59, 0.8)',
    transform: 'translate(-50%, -50%)',
    cursor: 'grab',
    animation: 'clickPointPulse ease-in-out infinite',
    transition: 'box-shadow 200ms',
    '&:active': {
      cursor: 'grabbing',
    },
  },
  clickPointDragging: {
    cursor: 'grabbing',
    opacity: 0.8,
    animationPlayState: 'paused',
    zIndex: 100,
  },
  clickPointSelected: {
    border: '2px solid #0078D4',
    boxShadow: '0 0 0 3px rgba(0, 120, 212, 0.3)',
  },
  clickPointLabel: {
    position: 'absolute',
    top: '-28px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: tokens.borderRadiusMedium,
    fontSize: '11px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  descriptionText: {
    position: 'absolute',
    cursor: 'grab',
    pointerEvents: 'auto',
    maxWidth: '200px',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    userSelect: 'none',
    zIndex: 10,
    lineHeight: '1.5',
    boxSizing: 'border-box',
    '&:active': {
      cursor: 'grabbing',
    },
  },
  descriptionDragging: {
    opacity: 0.7,
    cursor: 'grabbing',
    zIndex: 200,
  },
});

interface DesignerCanvasProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  currentTime: number;
  onTimeUpdate: () => void;
  onVideoLoaded?: () => void;
  onVideoLoadError?: () => void;
}

export default function DesignerCanvas({
  videoRef,
  videoUrl,
  currentTime,
  onTimeUpdate,
  onVideoLoaded,
  onVideoLoadError,
}: DesignerCanvasProps) {
  const classes = useStyles();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  // CP ドラッグ状態
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // 説明テキスト ドラッグ状態
  const [descDraggingId, setDescDraggingId] = useState<string | null>(null);
  const [descDragOffset, setDescDragOffset] = useState({ x: 0, y: 0 });
  const [descDragPos, setDescDragPos] = useState<{ x: number; y: number } | null>(null);

  const {
    currentProject,
    selectedElementId,
    activeTool,
    selectElement,
    addClickPoint,
    updateClickPoint,
  } = useDesignerStore();

  // ResizeObserver でラッパーサイズを追跡
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWrapperSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = currentProject?.video
    ? getScale(wrapperSize.width, currentProject.video.width)
    : 1;

  useEffect(() => {
    setIsVideoLoading(true);
  }, [videoUrl]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // ドラッグ終了直後はクリック処理をスキップ
      if (draggingId || descDraggingId) return;
      if (!currentProject || !wrapperRef.current) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const x = toPercent(e.clientX - rect.left, rect.width);
      const y = toPercent(e.clientY - rect.top, rect.height);

      if (activeTool === 'addClickPoint') {
        const error = validateClickPointAdd(currentProject, currentTime);
        if (error) {
          console.warn(error);
          return;
        }
        const defaultStyle =
          currentProject.settings?.defaultDescriptionStyle ?? DEFAULT_DESCRIPTION_STYLE;
        addClickPoint({
          timestamp: Math.round(currentTime * 100) / 100,
          position: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
          area: { type: 'circle', radius: 30 },
          description: '',
          order: currentProject.clickPoints.length + 1,
          pulseSpeed: 3,
          descriptionOffset: { x: 5, y: -10 },
          descriptionStyle: { ...defaultStyle },
        });
      } else {
        selectElement(null);
      }
    },
    [currentProject, activeTool, currentTime, addClickPoint, selectElement, draggingId, descDraggingId],
  );

  // --- CP ドラッグ開始 ---
  const handleDragStart = useCallback(
    (e: React.MouseEvent, cpId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!wrapperRef.current) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const cp = currentProject?.clickPoints.find((c) => c.id === cpId);
      if (!cp) return;

      const cpCenterX = toPixel(cp.position.x, rect.width);
      const cpCenterY = toPixel(cp.position.y, rect.height);
      setDragOffset({
        x: e.clientX - rect.left - cpCenterX,
        y: e.clientY - rect.top - cpCenterY,
      });
      setDraggingId(cpId);
      setDragPos(null);
      selectElement(cpId, 'clickPoint');
    },
    [currentProject?.clickPoints, selectElement],
  );

  // --- CP ドラッグ中 & 終了 ---
  useEffect(() => {
    if (!draggingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left - dragOffset.x;
      const rawY = e.clientY - rect.top - dragOffset.y;
      const pctX = Math.max(0, Math.min(100, toPercent(rawX, rect.width)));
      const pctY = Math.max(0, Math.min(100, toPercent(rawY, rect.height)));
      setDragPos({ x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10 });
    };

    const handleMouseUp = () => {
      if (dragPos) {
        updateClickPoint(draggingId, { position: dragPos });
      }
      setDraggingId(null);
      setDragPos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, dragOffset, dragPos, updateClickPoint]);

  // --- 説明テキスト ドラッグ開始 ---
  const handleDescDragStart = useCallback(
    (e: React.MouseEvent, cpId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!wrapperRef.current) return;

      const cp = currentProject?.clickPoints.find((c) => c.id === cpId);
      if (!cp) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      // 説明テキストの現在位置(px) = CP位置 + offset(%)
      const descX = toPixel(cp.position.x + (cp.descriptionOffset?.x ?? 5), rect.width);
      const descY = toPixel(cp.position.y + (cp.descriptionOffset?.y ?? -10), rect.height);
      setDescDragOffset({
        x: e.clientX - rect.left - descX,
        y: e.clientY - rect.top - descY,
      });
      setDescDraggingId(cpId);
      setDescDragPos(null);
      selectElement(cpId, 'clickPoint');
    },
    [currentProject?.clickPoints, selectElement],
  );

  // --- 説明テキスト ドラッグ中 & 終了 ---
  useEffect(() => {
    if (!descDraggingId) return;

    const cp = currentProject?.clickPoints.find((c) => c.id === descDraggingId);
    if (!cp) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left - descDragOffset.x;
      const rawY = e.clientY - rect.top - descDragOffset.y;
      // descDragPos は absolute % 座標（動画内）
      const pctX = Math.max(0, Math.min(100, toPercent(rawX, rect.width)));
      const pctY = Math.max(0, Math.min(100, toPercent(rawY, rect.height)));
      setDescDragPos({ x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10 });
    };

    const handleMouseUp = () => {
      if (descDragPos) {
        // offset = absolute位置 - CP位置
        const offsetX = Math.round((descDragPos.x - cp.position.x) * 10) / 10;
        const offsetY = Math.round((descDragPos.y - cp.position.y) * 10) / 10;
        updateClickPoint(descDraggingId, {
          descriptionOffset: { x: offsetX, y: offsetY },
        });
      }
      setDescDraggingId(null);
      setDescDragPos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [descDraggingId, descDragOffset, descDragPos, currentProject?.clickPoints, updateClickPoint]);

  return (
    <div ref={wrapperRef} className={classes.wrapper}>
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        src={videoUrl}
        crossOrigin="anonymous"
        className={classes.video}
        onTimeUpdate={onTimeUpdate}
        onLoadStart={() => setIsVideoLoading(true)}
        onLoadedData={() => {
          setIsVideoLoading(false);
          onVideoLoaded?.();
        }}
        onError={() => {
          setIsVideoLoading(false);
          onVideoLoadError?.();
        }}
        onPause={() => {}}
        onPlay={() => {}}
      />
      {isVideoLoading && (
        <div className={classes.loadingOverlay}>
          <Spinner size="large" />
        </div>
      )}
      <div className={classes.overlay} onClick={handleOverlayClick}>
        {currentProject?.clickPoints
          .filter((cp) => Math.abs(cp.timestamp - currentTime) < 0.15)
          .map((cp) => {
          // ドラッグ中は仮位置を使う
          const pos = draggingId === cp.id && dragPos ? dragPos : cp.position;
          const left = toPixel(pos.x, wrapperSize.width);
          const top = toPixel(pos.y, wrapperSize.height);
          const size =
            cp.area.type === 'circle'
              ? cp.area.radius * 2 * scale
              : cp.area.width * scale;
          const height =
            cp.area.type === 'rectangle' ? cp.area.height * scale : size;
          const isSelected = cp.id === selectedElementId;
          const isDragging = cp.id === draggingId;

          // 説明テキスト位置計算
          const descOffset = cp.descriptionOffset ?? { x: 5, y: -10 };
          const descStyle = cp.descriptionStyle ?? DEFAULT_DESCRIPTION_STYLE;
          let descLeft: number;
          let descTop: number;
          if (descDraggingId === cp.id && descDragPos) {
            // ドラッグ中は仮位置
            descLeft = toPixel(descDragPos.x, wrapperSize.width);
            descTop = toPixel(descDragPos.y, wrapperSize.height);
          } else {
            // CPからのオフセット
            descLeft = toPixel(
              Math.max(0, Math.min(100, pos.x + descOffset.x)),
              wrapperSize.width,
            );
            descTop = toPixel(
              Math.max(0, Math.min(100, pos.y + descOffset.y)),
              wrapperSize.height,
            );
          }

          return (
            <div key={cp.id}>
              {/* CP circle */}
              <div
                className={`${classes.clickPoint} ${isSelected ? classes.clickPointSelected : ''} ${isDragging ? classes.clickPointDragging : ''}`}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${size}px`,
                  height: `${height}px`,
                  animationDuration: `${PULSE_DURATION_MAP[cp.pulseSpeed]}s`,
                  borderRadius: cp.area.type === 'circle' ? '50%' : tokens.borderRadiusMedium,
                }}
                onMouseDown={(e) => handleDragStart(e, cp.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  selectElement(cp.id, 'clickPoint');
                }}
              >
                <span className={classes.clickPointLabel}>{cp.order}</span>
              </div>

              {/* Description text (only when non-empty) */}
              {cp.description && (
                <div
                  className={`${classes.descriptionText} ${descDraggingId === cp.id ? classes.descriptionDragging : ''}`}
                  style={{
                    left: `${descLeft}px`,
                    top: `${descTop}px`,
                    color: descStyle.color,
                    backgroundColor: descStyle.backgroundColor,
                    fontSize: `${descStyle.fontSize}px`,
                    borderColor: descStyle.borderColor,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: `${descStyle.borderRadius}px`,
                    padding: '6px 10px',
                  }}
                  onMouseDown={(e) => handleDescDragStart(e, cp.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectElement(cp.id, 'clickPoint');
                  }}
                >
                  {cp.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
