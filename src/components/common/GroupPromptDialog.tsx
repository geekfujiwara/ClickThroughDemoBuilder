/**
 * GroupPromptDialog — 組織未設定時に表示するダイアログ
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  Text,
  tokens,
} from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import { useMsg } from '@/hooks/useMsg';
import * as groupService from '@/services/groupService';
import * as creatorService from '@/services/creatorService';
import type { DemoGroup } from '@/types';

const DISMISSED_KEY = 'groupPromptDismissed';

export default function GroupPromptDialog() {
  const MSG = useMsg();
  const { selectedCreator, selectCreator, isGuest } = useAuthStore();
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // 組織未設定かつゲストでない場合に表示
  useEffect(() => {
    if (isGuest) return;
    if (!selectedCreator) return;
    if (selectedCreator.groupId) return;
    // セッション内で「あとで」を押した場合はスキップ
    if (sessionStorage.getItem(DISMISSED_KEY) === selectedCreator.id) return;
    setOpen(true);
  }, [selectedCreator, isGuest]);

  // グループ一覧取得
  useEffect(() => {
    if (!open) return;
    void groupService.getAllGroups().then(setGroups);
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!selectedCreator || !selectedGroupId) return;
    setSaving(true);
    try {
      const updated = await creatorService.updateCreator(selectedCreator.id, {
        groupId: selectedGroupId,
      });
      selectCreator(updated);
      setOpen(false);
    } catch {
      // エラー時は閉じない
    } finally {
      setSaving(false);
    }
  }, [selectedCreator, selectedGroupId, selectCreator]);

  const handleLater = useCallback(() => {
    if (selectedCreator) {
      sessionStorage.setItem(DISMISSED_KEY, selectedCreator.id);
    }
    setOpen(false);
  }, [selectedCreator]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) handleLater(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{MSG.groupPromptTitle}</DialogTitle>
          <DialogContent>
            <Text
              style={{ display: 'block', marginBottom: tokens.spacingVerticalM }}
            >
              {MSG.groupPromptDescription}
            </Text>
            <Select
              value={selectedGroupId}
              onChange={(_, d) => setSelectedGroupId(d.value)}
              style={{ width: '100%' }}
            >
              <option value="">{MSG.groupPromptSelect}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={handleLater}>
              {MSG.groupPromptLater}
            </Button>
            <Button
              appearance="primary"
              onClick={handleSave}
              disabled={!selectedGroupId || saving}
            >
              {MSG.save}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
