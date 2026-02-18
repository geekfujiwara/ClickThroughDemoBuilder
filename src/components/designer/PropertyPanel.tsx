import {
  makeStyles,
  tokens,
  Text,
  Input,
  Textarea,
  Select,
  Slider,
  Label,
  Divider,
  Button,
  RadioGroup,
  Radio,
} from '@fluentui/react-components';
import { DeleteRegular, CheckmarkRegular } from '@fluentui/react-icons';
import { useDesignerStore } from '@/stores/designerStore';
import { MSG } from '@/constants/messages';
import type { ClickPoint, PulseSpeed, DescriptionStyle, DescriptionTemplateId } from '@/types';
import { DESCRIPTION_TEMPLATES, DEFAULT_DESCRIPTION_STYLE } from '@/types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  heading: {
    marginBottom: tokens.spacingVerticalXS,
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  halfField: {
    flex: 1,
  },
  deleteBtn: {
    marginTop: tokens.spacingVerticalM,
  },
  templatePreview: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    minWidth: '60px',
    border: '1px solid',
  },
  bulkRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
});

export default function PropertyPanel() {
  const classes = useStyles();
  const {
    currentProject,
    selectedElementId,
    selectedElementType,
    updateClickPoint,
    removeClickPoint,
    bulkUpdateDescriptionStyle,
  } = useDesignerStore();

  if (!selectedElementId || !selectedElementType || !currentProject) {
    return (
      <div className={classes.root}>
        <Text size={300} weight="semibold" className={classes.heading}>
          プロパティ
        </Text>
        <Text size={200}>要素を選択してください</Text>
      </div>
    );
  }

  if (selectedElementType === 'clickPoint') {
    const cp = currentProject.clickPoints.find((c) => c.id === selectedElementId);
    if (!cp) return null;
    return (
      <ClickPointProperties
        cp={cp}
        duration={currentProject.video?.duration ?? 0}
        onUpdate={(u) => updateClickPoint(cp.id, u)}
        onDelete={() => removeClickPoint(cp.id)}
        onBulkApplyStyle={bulkUpdateDescriptionStyle}
      />
    );
  }

  return null;
}

// ========== Click Point Properties ==========

function ClickPointProperties({
  cp,
  duration,
  onUpdate,
  onDelete,
  onBulkApplyStyle,
}: {
  cp: ClickPoint;
  duration: number;
  onUpdate: (u: Partial<ClickPoint>) => void;
  onDelete: () => void;
  onBulkApplyStyle: (style: DescriptionStyle) => void;
}) {
  const classes = useStyles();

  // descriptionStyle が未定義の場合のフォールバック
  const style = cp.descriptionStyle ?? DEFAULT_DESCRIPTION_STYLE;

  const updateDescStyle = (patch: Partial<DescriptionStyle>) => {
    onUpdate({ descriptionStyle: { ...style, ...patch } });
  };

  const applyTemplate = (templateId: DescriptionTemplateId) => {
    const tpl = DESCRIPTION_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      onUpdate({ descriptionStyle: { templateId, ...tpl.style } });
    }
  };

  return (
    <div className={classes.root}>
      <Text size={300} weight="semibold" className={classes.heading}>
        {MSG.toolClickPoint} #{cp.order}
      </Text>

      <Divider />

      <div className={classes.field}>
        <Label>{MSG.propTimestamp}</Label>
        <Input
          type="number"
          min={0}
          max={duration}
          step={0.01}
          value={String(cp.timestamp)}
          onChange={(_, d) => onUpdate({ timestamp: clampNum(parseFloat(d.value) || 0, 0, duration) })}
        />
      </div>

      <div className={classes.field}>
        <Label>{MSG.propPosition}</Label>
        <div className={classes.row}>
          <div className={classes.halfField}>
            <Label size="small">X (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={String(cp.position.x)}
              onChange={(_, d) =>
                onUpdate({
                  position: { ...cp.position, x: clampNum(parseFloat(d.value) || 0, 0, 100) },
                })
              }
            />
          </div>
          <div className={classes.halfField}>
            <Label size="small">Y (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={String(cp.position.y)}
              onChange={(_, d) =>
                onUpdate({
                  position: { ...cp.position, y: clampNum(parseFloat(d.value) || 0, 0, 100) },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className={classes.field}>
        <Label>{MSG.propShape}</Label>
        <RadioGroup
          layout="horizontal"
          value={cp.area.type}
          onChange={(_, d) => {
            if (d.value === 'circle') {
              onUpdate({ area: { type: 'circle', radius: 30 } });
            } else {
              onUpdate({ area: { type: 'rectangle', width: 80, height: 40 } });
            }
          }}
        >
          <Radio value="circle" label={MSG.propCircle} />
          <Radio value="rectangle" label={MSG.propRectangle} />
        </RadioGroup>
      </div>

      {cp.area.type === 'circle' ? (
        <div className={classes.field}>
          <Label>{MSG.propRadius} (px)</Label>
          <Slider
            min={5}
            max={200}
            value={cp.area.radius}
            onChange={(_, d) => onUpdate({ area: { type: 'circle', radius: d.value } })}
          />
          <Text size={100}>{cp.area.radius}px</Text>
        </div>
      ) : (
        <div className={classes.row}>
          <div className={classes.halfField}>
            <Label>{MSG.propWidth} (px)</Label>
            <Input
              type="number"
              min={10}
              max={400}
              value={String(cp.area.width)}
              onChange={(_, d) =>
                onUpdate({
                  area: { type: 'rectangle', width: clampNum(parseInt(d.value) || 10, 10, 400), height: cp.area.type === 'rectangle' ? cp.area.height : 40 },
                })
              }
            />
          </div>
          <div className={classes.halfField}>
            <Label>{MSG.propHeight} (px)</Label>
            <Input
              type="number"
              min={10}
              max={400}
              value={String(cp.area.type === 'rectangle' ? cp.area.height : 40)}
              onChange={(_, d) =>
                onUpdate({
                  area: { type: 'rectangle', width: cp.area.type === 'rectangle' ? cp.area.width : 80, height: clampNum(parseInt(d.value) || 10, 10, 400) },
                })
              }
            />
          </div>
        </div>
      )}

      <div className={classes.field}>
        <Label>{MSG.propDescription}</Label>
        <Textarea
          value={cp.description}
          maxLength={200}
          rows={3}
          resize="vertical"
          placeholder="ここをクリック"
          onChange={(_, d) => onUpdate({ description: d.value })}
        />
      </div>

      <div className={classes.field}>
        <Label>{MSG.propDescriptionPosition}</Label>
        <div className={classes.row}>
          <div className={classes.halfField}>
            <Label size="small">オフセット X (%)</Label>
            <Input
              type="number"
              min={-100}
              max={100}
              step={0.1}
              value={String(cp.descriptionOffset?.x ?? 5)}
              onChange={(_, d) =>
                onUpdate({
                  descriptionOffset: {
                    x: clampNum(parseFloat(d.value) || 0, -100, 100),
                    y: cp.descriptionOffset?.y ?? -10,
                  },
                })
              }
            />
          </div>
          <div className={classes.halfField}>
            <Label size="small">オフセット Y (%)</Label>
            <Input
              type="number"
              min={-100}
              max={100}
              step={0.1}
              value={String(cp.descriptionOffset?.y ?? -10)}
              onChange={(_, d) =>
                onUpdate({
                  descriptionOffset: {
                    x: cp.descriptionOffset?.x ?? 5,
                    y: clampNum(parseFloat(d.value) || 0, -100, 100),
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      <div className={classes.field}>
        <Label>{MSG.propOrder}</Label>
        <Input
          type="number"
          min={1}
          value={String(cp.order)}
          onChange={(_, d) => onUpdate({ order: Math.max(1, parseInt(d.value) || 1) })}
        />
      </div>

      <div className={classes.field}>
        <Label>{MSG.propPulseSpeed}</Label>
        <Slider
          min={1}
          max={5}
          step={1}
          value={cp.pulseSpeed}
          onChange={(_, d) => onUpdate({ pulseSpeed: d.value as PulseSpeed })}
        />
        <Text size={100}>{cp.pulseSpeed} / 5</Text>
      </div>

      <Divider />

      {/* ---- 説明テキストスタイル ---- */}
      <Text size={300} weight="semibold">
        {MSG.propDescriptionStyle}
      </Text>

      <div className={classes.field}>
        <Label>{MSG.propTemplate}</Label>
        <Select
          value={style.templateId}
          onChange={(_, d) => applyTemplate(d.value as DescriptionTemplateId)}
        >
          {DESCRIPTION_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
        {/* プレビュー */}
        <div
          className={classes.templatePreview}
          style={{
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            borderRadius: `${style.borderRadius}px`,
            fontSize: `${style.fontSize}px`,
          }}
        >
          サンプル
        </div>
      </div>

      <div className={classes.field}>
        <Label>{MSG.propFontSize}</Label>
        <Slider
          min={10}
          max={24}
          value={style.fontSize}
          onChange={(_, d) => updateDescStyle({ fontSize: d.value })}
        />
        <Text size={100}>{style.fontSize}px</Text>
      </div>

      <div className={classes.field}>
        <Label>{MSG.propTextColor}</Label>
        <input
          type="color"
          value={style.color}
          onChange={(e) => updateDescStyle({ color: e.target.value })}
        />
      </div>

      <div className={classes.field}>
        <Label>{MSG.propBgColor}</Label>
        <input
          type="color"
          value={style.backgroundColor.slice(0, 7)}
          onChange={(e) => updateDescStyle({ backgroundColor: e.target.value + 'CC' })}
        />
      </div>

      <div className={classes.field}>
        <Label>{MSG.propBorderColor}</Label>
        <input
          type="color"
          value={style.borderColor}
          onChange={(e) => updateDescStyle({ borderColor: e.target.value })}
        />
      </div>

      <Divider />

      <div className={classes.bulkRow}>
        <Button
          size="small"
          icon={<CheckmarkRegular />}
          onClick={() => onBulkApplyStyle(style)}
        >
          {MSG.propApplyAll}
        </Button>
      </div>

      <Button
        className={classes.deleteBtn}
        icon={<DeleteRegular />}
        appearance="subtle"
        onClick={onDelete}
      >
        {MSG.delete}
      </Button>
    </div>
  );
}

function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
