/**
 * GroupPromptDialog — 組織未設定時にプロフィール設定を促すダイアログ
 */
import { useEffect, useCallback, useState } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Text,
  tokens,
} from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import { useMsg } from '@/hooks/useMsg';
import { useGuestNavigate } from '@/hooks/useGuestNav';

const DISMISSED_KEY = 'groupPromptDismissed';

export default function GroupPromptDialog() {
  const MSG = useMsg();
  const { selectedCreator, isGuest } = useAuthStore();
  const navigate = useGuestNavigate();
  const [open, setOpen] = useState(false);

  // 組織未設定かつゲストでない場合に表示
  useEffect(() => {
    if (isGuest) return;
    if (!selectedCreator) return;
    if (selectedCreator.groupId) return;
    if (sessionStorage.getItem(DISMISSED_KEY) === selectedCreator.id) return;
    setOpen(true);
  }, [selectedCreator, isGuest]);

  const handleGoToProfile = useCallback(() => {
    setOpen(false);
    navigate('/profile');
  }, [navigate]);

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
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={handleLater}>
              {MSG.groupPromptLater}
            </Button>
            <Button appearance="primary" onClick={handleGoToProfile}>
              {MSG.groupPromptGoProfile}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
