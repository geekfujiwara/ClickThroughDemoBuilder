/**
 * ProfilePage — ログイン中のユーザーが自分のプロフィールを編集するページ
 * - 表示名・表示言語を変更可
 * - メールアドレス: ローカルユーザーのみ変更可（Entra ユーザーは読み取り専用）
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { OpenRegular } from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import * as creatorService from '@/services/creatorService';
import * as groupService from '@/services/groupService';
import type { DemoGroup } from '@/types';
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
  const [groupId, setGroupId] = useState<string>('');
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoError, setInfoError] = useState(false);

  // 公開プロフィール
  const [bio, setBio] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [youTubeUrl, setYouTubeUrl] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void groupService.getAllGroups().then(setGroups);
  }, []);

  useEffect(() => {
    if (selectedCreator) {
      setName(selectedCreator.name);
      setEmail(selectedCreator.email ?? '');
      setLanguage(selectedCreator.language);
      setGroupId(selectedCreator.groupId ?? '');
      setBio(selectedCreator.bio ?? '');
      setXUrl(selectedCreator.xUrl ?? '');
      setLinkedInUrl(selectedCreator.linkedInUrl ?? '');
      setYouTubeUrl(selectedCreator.youTubeUrl ?? '');
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
        groupId: groupId || undefined,
        bio: bio.trim(),
        xUrl: xUrl.trim(),
        linkedInUrl: linkedInUrl.trim(),
        youTubeUrl: youTubeUrl.trim(),
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
  }, [selectedCreator, name, email, language, groupId, bio, xUrl, linkedInUrl, youTubeUrl, isEntraUser, MSG, selectCreator]);

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
          <Label>{MSG.creatorGroup}</Label>
          <Select value={groupId} onChange={(_, d) => setGroupId(d.value)}>
            <option value="">{MSG.projectsNoGroup}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
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

      {/* ── 公開プロフィール ── */}
      <section className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacingHorizontalS }} className={styles.sectionTitle}>
          <Text as="h2" size={500} weight="semibold">
            {MSG.profilePublicSection}
          </Text>
          <Link to={`/creators/${selectedCreator.id}`} style={{ textDecoration: 'none' }}>
            <Button appearance="subtle" size="small" icon={<OpenRegular />}>
              {MSG.profileViewPublic}
            </Button>
          </Link>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: `-${tokens.spacingVerticalS}` }}>
          {MSG.profilePublicDescription}
        </Text>
        <div className={styles.field}>
          <Label>{MSG.profileBio}</Label>
          <Textarea
            value={bio}
            placeholder={MSG.profileBioPlaceholder}
            onChange={(_, d) => setBio(d.value)}
            resize="vertical"
            maxLength={1000}
          />
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileXUrl}</Label>
          <Input type="url" value={xUrl} placeholder="https://x.com/..." onChange={(_, d) => setXUrl(d.value)} />
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileLinkedInUrl}</Label>
          <Input type="url" value={linkedInUrl} placeholder="https://www.linkedin.com/in/..." onChange={(_, d) => setLinkedInUrl(d.value)} />
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileYouTubeUrl}</Label>
          <Input type="url" value={youTubeUrl} placeholder="https://www.youtube.com/@..." onChange={(_, d) => setYouTubeUrl(d.value)} />
        </div>
        <div>
          <Button appearance="primary" disabled={saving || !name.trim()} onClick={() => void handleSaveInfo()}>
            {saving ? <Spinner size="tiny" /> : MSG.profileSaveInfo}
          </Button>
        </div>
      </section>

    </div>
  );
}
