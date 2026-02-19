/**
 * ApplyDesignerPage — デザイナー権限申請ページ
 */
import { useState, useCallback } from 'react';
import {
  Button,
  Label,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import * as socialService from '@/services/socialService';
import { MSG } from '@/constants/messages';

const useStyles = makeStyles({
  page: {
    maxWidth: '540px',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  textarea: {
    minHeight: '120px',
  },
});

export default function ApplyDesignerPage() {
  const styles = useStyles();
  const { selectedCreator, role } = useAuthStore();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const appStatus = selectedCreator?.designerApplicationStatus;

  const handleSubmit = useCallback(async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setMessage(null);
    setIsError(false);
    try {
      await socialService.applyDesigner(reason);
      setMessage(MSG.applyDesignerSuccess);
      setSubmitted(true);
    } catch (e) {
      setMessage((e as Error).message);
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  }, [reason]);

  if (role === 'designer') {
    return (
      <div className={styles.page}>
        <Text weight="semibold" size={500}>{MSG.applyDesignerTitle}</Text>
        <MessageBar intent="success">
          <MessageBarBody>{MSG.applyDesignerApproved}</MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Text weight="semibold" size={500}>{MSG.applyDesignerTitle}</Text>
      <Text>{MSG.applyDesignerDescription}</Text>

      {appStatus === 'pending' && !submitted ? (
        <MessageBar intent="info">
          <MessageBarBody>{MSG.applyDesignerPending}</MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.section}>
          {message && (
            <MessageBar intent={isError ? 'error' : 'success'}>
              <MessageBarBody>{message}</MessageBarBody>
            </MessageBar>
          )}

          {!submitted && (
            <>
              <div className={styles.field}>
                <Label required>{MSG.applyDesignerReason}</Label>
                <Textarea
                  className={styles.textarea}
                  placeholder={MSG.applyDesignerReasonPlaceholder}
                  value={reason}
                  onChange={(_, d) => setReason(d.value)}
                  disabled={submitting}
                  resize="vertical"
                />
              </div>
              <Button
                appearance="primary"
                onClick={() => void handleSubmit()}
                disabled={!reason.trim() || submitting}
                icon={submitting ? <Spinner size="tiny" /> : undefined}
              >
                {submitting ? MSG.applyDesignerSubmitting : MSG.applyDesignerSubmit}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
