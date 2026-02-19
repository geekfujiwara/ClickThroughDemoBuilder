/**
 * ProfilePage — ログイン中のユーザーが自分のプロフィールを編集するページ
 * - 表示名・表示言語を変更可
 * - メールアドレス: ローカルユーザーのみ変更可（Entra ユーザーは読み取り専用）
 * - パスワード変更: 不可（Entra 認証 / ロールベース認証ともに非対応）
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
  const { selectedCreator, selectCreator, isEntraUser } = useAuthStore();

  // Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoError, setInfoError] = useState(false);

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
    // ローカルユーザーのみメールバリデーション
    if (!isEntraUser && email && !email.toLowerCase().endsWith('@microsoft.com')) {
      setInfoMsg(MSG.profileEmailInvalid);
      setInfoError(true);
      return;
    }
    setSaving(true);
    try {
      const updated = await creatorService.updateCreator(selectedCreator.id, {
        name: name.trim(),
        // Entra ユーザーはメール変更不可（現在値をそのまま送らない）
        ...(!isEntraUser && { email: email.trim() || undefined }),
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
  }, [selectedCreator, name, email, language, isEntraUser, MSG, selectCreator]);

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
          {isEntraUser ? (
            <>
              <Input
                type="email"
                value={email}
                readOnly
                appearance="filled-darker"
              />
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                Microsoft Entra ID で管理されているため変更できません。
              </Text>
            </>
          ) : (
            <Input
              type="email"
              value={email}
              placeholder="user@microsoft.com"
              onChange={(_, d) => setEmail(d.value)}
            />
          )}
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

    </div>
  );
}
