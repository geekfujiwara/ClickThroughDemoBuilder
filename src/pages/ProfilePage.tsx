/**
 * ProfilePage — ログイン中のユーザーが自分のプロフィールを編集するページ
 * - 表示名・メールアドレス（@microsoft.com のみ）・表示言語を変更可
 * - パスワードを変更可（現在のパスワード確認 + 新パスワード x2）
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import * as creatorService from '@/services/creatorService';
import { useMsg } from '@/hooks/useMsg';

const useStyles = makeStyles({
  page: { maxWidth: '540px', display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXL },
  section: {
    display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  sectionTitle: {
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `2px solid ${tokens.colorBrandBackground}`,
    marginBottom: tokens.spacingVerticalS,
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  row: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'flex-end', flexWrap: 'wrap' },
});

export default function ProfilePage() {
  const styles = useStyles();
  const MSG = useMsg();
  const { selectedCreator, selectCreator } = useAuthStore();

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoError, setInfoError] = useState(false);

  // Password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedCreator) {
      setName(selectedCreator.name);
      setEmail(selectedCreator.email ?? '');
      setLanguage(selectedCreator.language);
    }
  }, [selectedCreator]);

  const handleSaveInfo = useCallback(async () => {
    if (!selectedCreator) return;
    setInfoMsg(null);
    setInfoError(false);
    if (email && !email.toLowerCase().endsWith('@microsoft.com')) {
      setInfoMsg(MSG.profileEmailInvalid);
      setInfoError(true);
      return;
    }
    setSaving(true);
    try {
      const updated = await creatorService.updateCreator(selectedCreator.id, {
        name: name.trim(),
        email: email.trim() || undefined,
        language,
      });
      // 選択中のクリエイター情報を更新（言語切り替えも含む）
      selectCreator(updated);
      setInfoMsg(MSG.profileSaved);
      setInfoError(false);
    } catch (e) {
      setInfoMsg((e as Error).message);
      setInfoError(true);
    } finally {
      setSaving(false);
    }
  }, [selectedCreator, name, email, language, MSG, selectCreator]);

  const handleChangePassword = useCallback(async () => {
    if (!selectedCreator) return;
    setPwMsg(null);
    setPwError(false);
    if (newPw !== confirmPw) {
      setPwMsg(MSG.profilePasswordMismatch);
      setPwError(true);
      return;
    }
    if (!newPw) return;
    setSaving(true);
    try {
      await creatorService.updateCreator(selectedCreator.id, {
        name: selectedCreator.name,
        language: selectedCreator.language,
        currentPassword: currentPw || undefined,
        password: newPw,
      });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg(MSG.profileSaved);
      setPwError(false);
    } catch (e) {
      setPwMsg((e as Error).message);
      setPwError(true);
    } finally {
      setSaving(false);
    }
  }, [selectedCreator, currentPw, newPw, confirmPw, MSG]);

  if (!selectedCreator) return <Spinner label="Loading..." />;

  return (
    <div className={styles.page}>
      <Text as="h1" size={700} weight="semibold">{MSG.profileTitle}</Text>

      {/* ── プロフィール情報 ── */}
      <section className={styles.section}>
        <Text as="h2" size={500} weight="semibold" className={styles.sectionTitle}>
          {MSG.profileTitle}
        </Text>
        <div className={styles.field}>
          <Label>{MSG.profileName}</Label>
          <Input value={name} onChange={(_, d) => setName(d.value)} />
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileEmail}</Label>
          <Input type="email" value={email} placeholder="user@microsoft.com" onChange={(_, d) => setEmail(d.value)} />
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileLanguage}</Label>
          <Select value={language} onChange={(_, d) => setLanguage(d.value === 'en' ? 'en' : 'ja')}>
            <option value="ja">{MSG.languageJapanese}</option>
            <option value="en">{MSG.languageEnglish}</option>
          </Select>
        </div>
        {infoMsg && (
          <MessageBar intent={infoError ? 'error' : 'success'}>
            <MessageBarBody>{infoMsg}</MessageBarBody>
          </MessageBar>
        )}
        <div>
          <Button appearance="primary" disabled={saving || !name.trim()} onClick={() => void handleSaveInfo()}>
            {saving ? <Spinner size="tiny" /> : MSG.profileSaveInfo}
          </Button>
        </div>
      </section>

      {/* ── パスワード変更 ── */}
      <section className={styles.section}>
        <Text as="h2" size={500} weight="semibold" className={styles.sectionTitle}>
          {MSG.profilePasswordSection}
        </Text>
        <div className={styles.field}>
          <Label>{MSG.profileCurrentPassword}</Label>
          <Input type="password" value={currentPw} onChange={(_, d) => setCurrentPw(d.value)} placeholder="Leave blank if no password set" />
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileNewPassword}</Label>
          <Input type="password" value={newPw} onChange={(_, d) => setNewPw(d.value)} />
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileConfirmPassword}</Label>
          <Input type="password" value={confirmPw} onChange={(_, d) => setConfirmPw(d.value)} />
        </div>
        {pwMsg && (
          <MessageBar intent={pwError ? 'error' : 'success'}>
            <MessageBarBody>{pwMsg}</MessageBarBody>
          </MessageBar>
        )}
        <div>
          <Button appearance="primary" disabled={saving || !newPw} onClick={() => void handleChangePassword()}>
            {saving ? <Spinner size="tiny" /> : MSG.profileSavePassword}
          </Button>
        </div>
      </section>
    </div>
  );
}
