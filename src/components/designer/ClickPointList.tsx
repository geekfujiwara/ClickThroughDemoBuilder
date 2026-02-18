import { useState, useCallback } from 'react';
import { makeStyles, tokens, Text, Button, Checkbox, Tooltip } from '@fluentui/react-components';
import {
  CursorClickRegular,
  DeleteRegular,
  DismissRegular,
  SelectAllOnRegular,
  DeleteDismissRegular,
} from '@fluentui/react-icons';
import { useDesignerStore } from '@/stores/designerStore';
import { MSG } from '@/constants/messages';
import { formatTime } from '@/utils/time';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXS,
  },
  headingActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    marginLeft: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  itemSelected: {
    backgroundColor: tokens.colorBrandBackground2,
    '&:hover': {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  orderBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#0078D4',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  itemDesc: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  deleteBtn: {
    minWidth: 'auto',
    opacity: 0,
    '.item:hover &': {
      opacity: 1,
    },
  },
  empty: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalL,
  },
  selectionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalXS,
  },
});

export default function ClickPointList({ onSeek }: { onSeek?: (time: number) => void }) {
  const classes = useStyles();
  const {
    currentProject,
    selectedElementId,
    selectElement,
    removeClickPoint,
    removeClickPoints,
    removeAllClickPoints,
  } = useDesignerStore();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);

  const clickPoints = currentProject?.clickPoints ?? [];

  const isSelectionMode = checkedIds.size > 0;

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setCheckedIds(new Set(clickPoints.map((cp) => cp.id)));
  }, [clickPoints]);

  const clearSelection = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    removeClickPoints(Array.from(checkedIds));
    setCheckedIds(new Set());
    setConfirmDeleteSelected(false);
  }, [checkedIds, removeClickPoints]);

  const handleDeleteAll = useCallback(() => {
    removeAllClickPoints();
    setCheckedIds(new Set());
    setConfirmDeleteAll(false);
  }, [removeAllClickPoints]);

  return (
    <div className={classes.root}>
      <div className={classes.heading}>
        <CursorClickRegular />
        <Text weight="semibold" size={200}>
          {MSG.cpListTitle}
        </Text>
        <div className={classes.headingActions}>
          {clickPoints.length > 0 && (
            <>
              <Tooltip content="全選択" relationship="label">
                <Button
                  icon={<SelectAllOnRegular />}
                  appearance="subtle"
                  size="small"
                  onClick={selectAll}
                />
              </Tooltip>
              <Tooltip content={MSG.cpDeleteAll} relationship="label">
                <Button
                  icon={<DeleteDismissRegular />}
                  appearance="subtle"
                  size="small"
                  onClick={() => setConfirmDeleteAll(true)}
                />
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* 選択モードバー */}
      {isSelectionMode && (
        <div className={classes.selectionBar}>
          <Text size={200} weight="semibold">
            {checkedIds.size} 件選択中
          </Text>
          <Tooltip content={MSG.cpDeleteSelected} relationship="label">
            <Button
              icon={<DeleteRegular />}
              appearance="subtle"
              size="small"
              onClick={() => setConfirmDeleteSelected(true)}
            />
          </Tooltip>
          <Tooltip content="選択解除" relationship="label">
            <Button
              icon={<DismissRegular />}
              appearance="subtle"
              size="small"
              onClick={clearSelection}
            />
          </Tooltip>
        </div>
      )}

      {clickPoints.length === 0 ? (
        <Text size={200} className={classes.empty}>
          クリックポイントがありません
        </Text>
      ) : (
        clickPoints.map((cp) => (
          <div
            key={cp.id}
            className={`item ${classes.item} ${
              selectedElementId === cp.id ? classes.itemSelected : ''
            }`}
            onClick={() => {
              selectElement(cp.id, 'clickPoint');
              onSeek?.(cp.timestamp);
            }}
          >
            <Checkbox
              checked={checkedIds.has(cp.id)}
              onChange={(e) => {
                e.stopPropagation();
                toggleCheck(cp.id);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <span className={classes.orderBadge}>{cp.order}</span>
            <div className={classes.itemInfo}>
              <Text size={200} weight="semibold" className={classes.itemDesc}>
                {cp.description || `CP ${cp.order}`}
              </Text>
              <Text size={100} className={classes.itemDesc}>
                {formatTime(cp.timestamp)}
              </Text>
            </div>
            <Button
              className={classes.deleteBtn}
              icon={<DeleteRegular />}
              appearance="subtle"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                removeClickPoint(cp.id);
              }}
            />
          </div>
        ))
      )}

      {/* 選択削除確認 */}
      <ConfirmDialog
        open={confirmDeleteSelected}
        title={MSG.delete}
        message={MSG.cpDeleteSelectedConfirm(checkedIds.size)}
        confirmLabel={MSG.delete}
        danger
        onConfirm={handleDeleteSelected}
        onCancel={() => setConfirmDeleteSelected(false)}
      />

      {/* 全削除確認 */}
      <ConfirmDialog
        open={confirmDeleteAll}
        title={MSG.cpDeleteAll}
        message={MSG.cpDeleteAllConfirm}
        confirmLabel={MSG.cpDeleteAll}
        danger
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}
