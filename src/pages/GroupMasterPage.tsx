/**
 * GroupMasterPage — 組織一覧・管理ページ
 * 組織ロゴ画像（トリミング・圧縮）、背景色、テキストカラーの設定が可能
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardFooter,
  Body1,
  Caption1,
  Input,
  Label,
  Spinner,
  Text,
  makeStyles,
  tokens,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogBody,
  DialogTrigger,
  Tooltip,
} from '@fluentui/react-components';
import {
  AddRegular,
  EditRegular,
  DeleteRegular,
  SaveRegular,
  DismissRegular,
  ImageRegular,
  ImageEditRegular,
  DeleteDismissRegular,
} from '@fluentui/react-icons';
import type { DemoGroup } from '@/types';
import * as groupService from '@/services/groupService';
import type { GroupInput } from '@/services/groupService';
import { useAuthStore } from '@/stores/authStore';
import { useMsg } from '@/hooks/useMsg';

// ── カラーパレット ──────────────────────────────────────────

const BG_COLORS = [
  '#F5F5F5', '#ECEFF1', '#E8EAF6', '#E3F2FD', '#E0F2F1', '#E8F5E9',
  '#FFF8E1', '#FFF3E0', '#FCE4EC', '#F3E5F5', '#EFEBE9',
  '#1565C0', '#0D47A1', '#006064', '#004D40', '#1B5E20',
  '#F57F17', '#E65100', '#B71C1C', '#880E4F', '#4A148C',
  '#263238', '#37474F', '#455A64', '#212121', '#000000',
];

const TEXT_COLORS = [
  // ニュートラル (白 → 黒)
  '#FFFFFF', '#F5F5F5', '#E0E0E0', '#BDBDBD', '#9E9E9E',
  '#757575', '#616161', '#424242', '#212121', '#000000',
  // ブルー系
  '#E3F2FD', '#90CAF9', '#42A5F5', '#1565C0', '#0D47A1',
  // ティール・グリーン系
  '#E0F7FA', '#80DEEA', '#26C6DA', '#00838F', '#004D40',
  // グリーン系
  '#E8F5E9', '#A5D6A7', '#66BB6A', '#2E7D32', '#1B5E20',
  // イエロー・オレンジ系
  '#FFFDE7', '#FFE082', '#FFA726', '#E65100', '#BF360C',
  // レッド・ピンク系
  '#FCE4EC', '#F48FB1', '#EC407A', '#C62828', '#880E4F',
  // パープル系
  '#F3E5F5', '#CE93D8', '#AB47BC', '#6A1B9A', '#4A148C',
  // ブラウン・グレー系
  '#EFEBE9', '#BCAAA4', '#795548', '#4E342E', '#37474F',
];

const CARD_H = 128; // カードヘッダー高さ(px)
const CROP_VW = 320;
const CROP_VH = 180;
const OUT_W = 480;
const OUT_H = 270;

// ── utils ─────────────────────────────────────────────────────

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Styles ────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXL },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: tokens.spacingHorizontalM,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  card: {
    overflow: 'hidden', padding: 0,
    transition: 'box-shadow 200ms ease',
    ':hover': { boxShadow: tokens.shadow8 },
  },
  cardHead: {
    position: 'relative', overflow: 'hidden',
    width: '100%',
    flexShrink: 0,
  },
  cardHeadImg: {
    display: 'block', width: '100%', objectFit: 'cover',
  },
  cardHeadOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
  },
  cardBody: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
  },
  cardFooterCustom: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}`,
  },
  // ── Edit Form ──
  editForm: {
    display: 'flex', flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  swatchRow: {
    display: 'flex', alignItems: 'center',
    gap: '4px', flexWrap: 'wrap', marginTop: '4px',
  },
  swatch: {
    width: '20px', height: '20px',
    borderRadius: tokens.borderRadiusSmall,
    border: '2px solid transparent',
    cursor: 'pointer', flexShrink: 0,
    transition: 'transform 100ms ease',
    ':hover': { transform: 'scale(1.2)' },
  },
  swatchSelected: { border: `2px solid ${tokens.colorBrandBackground}`, boxShadow: tokens.shadow4 },
  colorInputWrap: {
    position: 'relative', width: '22px', height: '22px',
    overflow: 'hidden', borderRadius: tokens.borderRadiusSmall,
    border: `1px dashed ${tokens.colorNeutralStroke1}`, cursor: 'pointer', flexShrink: 0,
  },
  imageUploadArea: {
    border: `1.5px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
    cursor: 'pointer',
    position: 'relative',
  },
  imagePreview: {
    display: 'block', width: '100%', objectFit: 'cover',
  },
  imageActions: {
    display: 'flex', gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap', marginTop: '4px',
  },
  editActions: {
    display: 'flex', gap: tokens.spacingHorizontalXS,
    paddingTop: tokens.spacingVerticalXS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  emptyText: { color: tokens.colorNeutralForeground3 },
  // ── Dialog form ──
  dialogForm: {
    display: 'flex', flexDirection: 'column',
    gap: tokens.spacingVerticalM, minWidth: '340px',
  },
  // ── Crop viewport ──
  cropViewport: {
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    border: `2px solid ${tokens.colorBrandBackground}`,
    position: 'relative',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    margin: '0 auto',
  },
  cropSliderRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
  },
});

// ── ImageCropDialog ───────────────────────────────────────────

function ImageCropDialog({
  open, rawSrc, bgColor, onClose, onConfirm,
}: {
  open: boolean;
  rawSrc: string;
  bgColor: string;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const styles = useStyles();
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [natW, setNatW] = useState(1);
  const [natH, setNatH] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // 画像読み込み時に初期値設定
  useEffect(() => {
    if (!rawSrc || !open) return;
    const img = new Image();
    img.src = rawSrc;
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      setNatW(nw);
      setNatH(nh);
      const baseScale = CROP_VW / nw;
      const mz = Math.max(1, CROP_VH / (nh * baseScale));
      setMinZoom(mz);
      setZoom(mz);
      const dh = nh * baseScale * mz;
      setPanX(0);
      setPanY(-(dh - CROP_VH) / 2);
    };
  }, [rawSrc, open]);

  function clamp(px: number, py: number, z: number) {
    const baseScale = CROP_VW / natW;
    const dw = natW * baseScale * z;
    const dh = natH * baseScale * z;
    return {
      cx: Math.min(0, Math.max(CROP_VW - dw, px)),
      cy: Math.min(0, Math.max(CROP_VH - dh, py)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    const { cx, cy } = clamp(panX + dx, panY + dy, zoom);
    setPanX(cx);
    setPanY(cy);
  }
  function onPointerUp() { dragging.current = false; }

  function onZoomChange(newZ: number) {
    const { cx, cy } = clamp(panX, panY, newZ);
    setZoom(newZ);
    setPanX(cx);
    setPanY(cy);
  }

  function handleConfirm() {
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext('2d')!;
    // 背景色を先に塗る
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    const baseScale = CROP_VW / natW;
    const sx = -panX / (baseScale * zoom);
    const sy = -panY / (baseScale * zoom);
    const sw = CROP_VW / (baseScale * zoom);
    const sh = CROP_VH / (baseScale * zoom);
    const img = new Image();
    img.src = rawSrc;
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
      onConfirm(canvas.toDataURL('image/jpeg', 0.72));
    };
  }

  const dispW = natW * (CROP_VW / natW) * zoom;

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>画像をトリミング</DialogTitle>
          <DialogContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                ドラッグして位置を調整。ズームスライダーで拡大できます。
              </Caption1>
              <div
                className={styles.cropViewport}
                style={{ width: `${CROP_VW}px`, height: `${CROP_VH}px`, backgroundColor: bgColor }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {rawSrc && (
                  <img
                    src={rawSrc}
                    alt=""
                    style={{
                      position: 'absolute', left: 0, top: 0,
                      width: `${dispW}px`, height: 'auto',
                      transform: `translate(${panX}px, ${panY}px)`,
                      pointerEvents: 'none', userSelect: 'none',
                    }}
                    draggable={false}
                  />
                )}
              </div>
              <div className={styles.cropSliderRow}>
                <Caption1>ズーム</Caption1>
                <input
                  type="range"
                  min={minZoom}
                  max={Math.max(minZoom * 4, 4)}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => onZoomChange(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>キャンセル</Button>
            <Button appearance="primary" onClick={handleConfirm}>切り取る</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ── ColorPickerRow ────────────────────────────────────────────

function ColorPickerRow({
  colors, value, onChange,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  const styles = useStyles();
  return (
    <div className={styles.swatchRow}>
      {colors.map((c) => (
        <div
          key={c}
          className={`${styles.swatch} ${value === c ? styles.swatchSelected : ''}`}
          style={{ backgroundColor: c, boxSizing: 'border-box' }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
      <div className={styles.colorInputWrap} title="カスタムカラー">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', inset: '-4px', width: '40px', height: '40px', cursor: 'pointer', border: 'none', padding: 0 }}
        />
      </div>
    </div>
  );
}

// ── EditPanel (inline or dialog shared form) ──────────────────

interface EditState {
  name: string;
  color: string;
  textColor: string;
  imageDataUrl: string; // '' = no image
}

function EditForm({
  value,
  onChange,
  groupName, // 元の名前（プレビュー用フォールバック）
}: {
  value: EditState;
  onChange: (next: EditState) => void;
  groupName?: string;
}) {
  const styles = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [rawSrc, setRawSrc] = useState('');

  function set<K extends keyof EditState>(key: K, val: EditState[K]) {
    onChange({ ...value, [key]: val });
  }

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setRawSrc(dataUrl);
    setCropOpen(true);
    e.target.value = '';
  }

  function onCropConfirm(dataUrl: string) {
    set('imageDataUrl', dataUrl);
    setCropOpen(false);
    setRawSrc('');
  }

  const previewBg = value.color || '#e0e0e0';
  const previewFg = value.textColor || (isLight(previewBg) ? '#212121' : '#FFFFFF');
  const previewName = value.name || groupName || '組織名';

  return (
    <div className={styles.editForm}>
      {/* 組織名 */}
      <div className={styles.field}>
        <Label>組織名</Label>
        <Input
          value={value.name}
          onChange={(_, d) => set('name', d.value)}
          autoFocus
        />
      </div>

      {/* 背景色 */}
      <div className={styles.field}>
        <Label>背景色</Label>
        <ColorPickerRow colors={BG_COLORS} value={value.color} onChange={(c) => set('color', c)} />
      </div>

      {/* テキストカラー */}
      <div className={styles.field}>
        <Label>テキストカラー</Label>
        <ColorPickerRow colors={TEXT_COLORS} value={value.textColor} onChange={(c) => set('textColor', c)} />
      </div>

      {/* ロゴ画像 */}
      <div className={styles.field}>
        <Label>ロゴ画像</Label>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileSelect} />
        {value.imageDataUrl ? (
          <>
            <div className={styles.imageUploadArea} style={{ height: '90px' }}>
              <img src={value.imageDataUrl} alt="ロゴ" className={styles.imagePreview} style={{ height: '90px' }} />
            </div>
            <div className={styles.imageActions}>
              <Button size="small" appearance="subtle" icon={<ImageEditRegular />} onClick={() => fileInputRef.current?.click()}>
                差し替え
              </Button>
              <Button size="small" appearance="subtle" icon={<DeleteDismissRegular />} onClick={() => set('imageDataUrl', '')}>
                削除
              </Button>
            </div>
          </>
        ) : (
          <div
            className={styles.imageUploadArea}
            style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageRegular fontSize={22} style={{ color: tokens.colorNeutralForeground3 }} />
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>クリックして画像をアップロード</Caption1>
          </div>
        )}
      </div>

      {/* プレビュー */}
      <div className={styles.field}>
        <Label>プレビュー</Label>
        <div style={{
          borderRadius: tokens.borderRadiusMedium, overflow: 'hidden',
          border: `1px solid ${tokens.colorNeutralStroke2}`, display: 'inline-block',
        }}>
          <div style={{
            position: 'relative', height: '56px', backgroundColor: previewBg,
            backgroundImage: value.imageDataUrl ? `url(${value.imageDataUrl})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}>
            {value.imageDataUrl && (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.45))' }} />
            )}
            <span style={{
              position: 'absolute', bottom: '4px', left: '8px',
              color: previewFg, fontWeight: 600, fontSize: '13px',
              textShadow: value.imageDataUrl ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
            }}>
              {previewName}
            </span>
          </div>
        </div>
      </div>

      {/* Crop Dialog */}
      {rawSrc && (
        <ImageCropDialog
          open={cropOpen}
          rawSrc={rawSrc}
          bgColor={value.color}
          onClose={() => { setCropOpen(false); setRawSrc(''); }}
          onConfirm={onCropConfirm}
        />
      )}
    </div>
  );
}

// ── GroupMasterPage ───────────────────────────────────────────

const DEFAULT_COLOR = '#1565C0';
const DEFAULT_TEXT_COLOR = '#FFFFFF';

function makeDefault(): EditState {
  return { name: '', color: DEFAULT_COLOR, textColor: DEFAULT_TEXT_COLOR, imageDataUrl: '' };
}

export default function GroupMasterPage() {
  const styles = useStyles();
  const MSG = useMsg();
  const { role } = useAuthStore();
  const isDesigner = role === 'designer';

  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>(makeDefault());
  const [createOpen, setCreateOpen] = useState(false);
  const [createState, setCreateState] = useState<EditState>(makeDefault());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setGroups(await groupService.getAllGroups()); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startEdit(group: DemoGroup) {
    setEditingId(group.id);
    setEditState({
      name: group.name,
      color: group.color ?? DEFAULT_COLOR,
      textColor: group.textColor ?? DEFAULT_TEXT_COLOR,
      imageDataUrl: group.imageDataUrl ?? '',
    });
  }

  const handleSave = useCallback(async (id: string) => {
    const name = editState.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      const input: GroupInput = {
        name,
        color: editState.color,
        textColor: editState.textColor,
        imageDataUrl: editState.imageDataUrl || null,
      };
      await groupService.updateGroup(id, input);
      setEditingId(null);
      await load();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  }, [editState, load]);

  const handleCreate = useCallback(async () => {
    const name = createState.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      await groupService.createGroup(name, {
        color: createState.color,
        textColor: createState.textColor,
        imageDataUrl: createState.imageDataUrl || undefined,
      });
      setCreateOpen(false);
      setCreateState(makeDefault());
      await load();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  }, [createState, load]);

  const handleDelete = useCallback(async (group: DemoGroup) => {
    if (!confirm(MSG.projectsGroupDeleteConfirm(group.name))) return;
    try {
      await groupService.deleteGroup(group.id);
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [MSG, load]);

  if (isLoading) return <Spinner label="Loading..." />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Text as="h1" size={700} weight="semibold">{MSG.organizationMasterTitle}</Text>
        {isDesigner && (
          <Button appearance="primary" icon={<AddRegular />} onClick={() => { setCreateState(makeDefault()); setCreateOpen(true); }}>
            {MSG.organizationNew}
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <Text size={300} className={styles.emptyText}>{MSG.organizationNoGroups}</Text>
      ) : (
        <div className={styles.grid}>
          {groups.map((group) => {
            const bg = group.color ?? DEFAULT_COLOR;
            const fg = group.textColor ?? (isLight(bg) ? '#212121' : '#FFFFFF');
            const isEditing = editingId === group.id;

            return (
              <Card key={group.id} className={styles.card}>
                {isEditing ? (
                  <>
                    <EditForm value={editState} onChange={setEditState} groupName={group.name} />
                    <div className={styles.editActions} style={{ padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}` }}>
                      <Button size="small" appearance="primary" icon={<SaveRegular />}
                        disabled={saving || !editState.name.trim()}
                        onClick={() => void handleSave(group.id)}
                      >
                        保存
                      </Button>
                      <Button size="small" appearance="subtle" icon={<DismissRegular />} onClick={() => setEditingId(null)}>
                        キャンセル
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* カードヘッダー: 画像または背景色 */}
                    <div className={styles.cardHead} style={{ height: `${CARD_H}px`, backgroundColor: bg }}>
                      {group.imageDataUrl && (
                        <img
                          src={group.imageDataUrl}
                          alt={group.name}
                          className={styles.cardHeadImg}
                          style={{ height: `${CARD_H}px` }}
                        />
                      )}
                      <div
                        className={styles.cardHeadOverlay}
                        style={group.imageDataUrl
                          ? {}
                          : { background: 'none', bottom: '8px' }}
                      >
                        <Body1 style={{ color: fg, fontWeight: 700, textShadow: group.imageDataUrl ? '0 1px 3px rgba(0,0,0,0.7)' : 'none' }}>
                          {group.name}
                        </Body1>
                      </div>
                    </div>
                    {isDesigner && (
                      <CardFooter className={styles.cardFooterCustom}>
                        <Tooltip content="編集" relationship="label">
                          <Button icon={<EditRegular />} size="small" appearance="subtle" onClick={() => startEdit(group)}>
                            編集
                          </Button>
                        </Tooltip>
                        <Tooltip content="削除" relationship="label">
                          <Button icon={<DeleteRegular />} size="small" appearance="subtle" onClick={() => void handleDelete(group)}>
                            削除
                          </Button>
                        </Tooltip>
                      </CardFooter>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 新規作成ダイアログ */}
      <Dialog
        open={createOpen}
        onOpenChange={(_, d) => { if (!d.open) { setCreateOpen(false); setCreateState(makeDefault()); } }}
      >
        <DialogSurface style={{ maxWidth: '500px' }}>
          <DialogBody>
            <DialogTitle>新しい組織を作成</DialogTitle>
            <DialogContent>
              <EditForm value={createState} onChange={setCreateState} />
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">キャンセル</Button>
              </DialogTrigger>
              <Button appearance="primary" disabled={saving || !createState.name.trim()} onClick={() => void handleCreate()}>
                {saving ? <Spinner size="tiny" /> : '作成'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}