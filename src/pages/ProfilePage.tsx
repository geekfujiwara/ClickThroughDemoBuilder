/**
 * ProfilePage — ログイン中のユーザーが自分のプロフィールを編集するページ
 * - 表示名・表示言語を変更可
 * - メールアドレス: ローカルユーザーのみ変更可（Entra ユーザーは読み取り専用）
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Avatar,
  Body1,
  Body2,
  Button,
  Caption1,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Tab,
  TabList,
  Text,
  Textarea,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { SelectTabData, SelectTabEvent } from '@fluentui/react-components';
import { OpenRegular, HeartRegular, PlayRegular, ChatRegular, PersonRegular } from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import * as creatorService from '@/services/creatorService';
import type { CreatorProfile } from '@/services/creatorService';
import * as groupService from '@/services/groupService';
import * as socialService from '@/services/socialService';
import type { DemoGroup, DemoComment } from '@/types';
import { useMsg } from '@/hooks/useMsg';

type SocialKind = 'x' | 'linkedin' | 'youtube';

/**
 * SNS の入力値を正規化する。
 * - すでに http(s):// で始まる場合はそのまま
 * - www. 始まりは https:// を補う
 * - それ以外はアカウント名（ハンドル）とみなし、各プラットフォームの URL を構築
 */
function normalizeSocialUrl(kind: SocialKind, value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  const handle = v.replace(/^@+/, '').replace(/^\/+/, '');
  switch (kind) {
    case 'x': return `https://x.com/${handle}`;
    case 'linkedin': return `https://www.linkedin.com/in/${handle}`;
    case 'youtube': return `https://www.youtube.com/@${handle}`;
    default: return v;
  }
}

const useStyles = makeStyles({
  page: { maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  section: {
    display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    maxWidth: '560px',
  },
  sectionTitle: {
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `2px solid ${tokens.colorBrandBackground}`,
    marginBottom: tokens.spacingVerticalS,
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  urlRow: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  row: { display: 'flex', gap: tokens.spacingHorizontalS, alignItems: 'flex-end', flexWrap: 'wrap' },
  tabPanel: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, paddingTop: tokens.spacingVerticalM },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  kpiCard: {
    textAlign: 'center',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  kpiValue: { display: 'block', fontSize: '26px', fontWeight: tokens.fontWeightSemibold, lineHeight: '1.2', marginBottom: '4px' },
  kpiLabel: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 },
  detailTitle: {
    marginBottom: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, whiteSpace: 'nowrap',
  },
  thNum: {
    textAlign: 'right', padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, whiteSpace: 'nowrap',
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  tdNum: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  },
  demoLink: {
    color: tokens.colorBrandForeground1, textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  commentList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  commentItem: {
    display: 'flex', gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  commentHead: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap', marginBottom: '2px' },
  commentDate: { color: tokens.colorNeutralForeground4, marginLeft: 'auto' },
  muted: { color: tokens.colorNeutralForeground3 },
});

/** 統計詳細タブ — 総いいね/再生/コメント数の内訳をデモ別に表示 */
function StatsDetail({ creatorId }: { creatorId: string }) {
  const styles = useStyles();
  const MSG = useMsg();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<DemoComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    creatorService.getCreatorProfile(creatorId)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [creatorId]);

  const loadComments = useCallback(async () => {
    if (!profile) return;
    setCommentsLoading(true);
    try {
      const withComments = profile.demos.filter((d) => d.commentCount > 0);
      const lists = await Promise.all(withComments.map((d) => socialService.getComments(d.id)));
      const all = lists.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setComments(all);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [profile]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Spinner label={MSG.loading} /></div>;
  if (!profile) return <Text className={styles.muted}>{MSG.creatorProfileNotFound}</Text>;

  const { stats, demos } = profile;
  const titleById = new Map(demos.map((d) => [d.id, d.title]));
  const sortedDemos = [...demos].sort((a, b) => (b.likeCount + b.playCount + b.commentCount) - (a.likeCount + a.playCount + a.commentCount));

  return (
    <div className={styles.tabPanel}>
      {/* KPI サマリ */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue} style={{ color: '#0078D4' }}>{stats.demoCount}</span>
          <span className={styles.kpiLabel}>{MSG.creatorProfileStatDemos}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue} style={{ color: '#D13438' }}>{stats.totalLikes}</span>
          <span className={styles.kpiLabel}>{MSG.creatorProfileStatLikes}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue} style={{ color: '#107C10' }}>{stats.totalPlays}</span>
          <span className={styles.kpiLabel}>{MSG.creatorProfileStatPlays}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiValue} style={{ color: '#CA5010' }}>{stats.totalComments}</span>
          <span className={styles.kpiLabel}>{MSG.creatorProfileStatComments}</span>
        </div>
      </div>

      {/* デモ別内訳 */}
      <div>
        <Text as="h3" size={400} weight="semibold" className={styles.detailTitle}>
          {MSG.profileStatsBreakdownTitle}
        </Text>
        {demos.length === 0 ? (
          <Caption1 className={styles.muted}>{MSG.profileStatsNoDemos}</Caption1>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>{MSG.profileStatsColDemo}</th>
                <th className={styles.thNum}><HeartRegular fontSize={14} /></th>
                <th className={styles.thNum}><PlayRegular fontSize={14} /></th>
                <th className={styles.thNum}><ChatRegular fontSize={14} /></th>
              </tr>
            </thead>
            <tbody>
              {sortedDemos.map((d) => (
                <tr key={d.id}>
                  <td className={styles.td}>
                    <Link to={`/demos/${d.id}`} className={styles.demoLink}>
                      {d.demoNumber ? `#${d.demoNumber} ` : ''}{d.title}
                    </Link>
                  </td>
                  <td className={styles.tdNum}>{d.likeCount}</td>
                  <td className={styles.tdNum}>{d.playCount}</td>
                  <td className={styles.tdNum}>{d.commentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* コメント詳細 */}
      <div>
        <Text as="h3" size={400} weight="semibold" className={styles.detailTitle}>
          {MSG.profileStatsCommentsTitle}
        </Text>
        {comments === null ? (
          <Button
            appearance="secondary"
            disabled={commentsLoading || stats.totalComments === 0}
            icon={commentsLoading ? <Spinner size="tiny" /> : <ChatRegular />}
            onClick={() => void loadComments()}
          >
            {stats.totalComments === 0 ? MSG.profileStatsNoComments : `${MSG.profileStatsShowComments} (${stats.totalComments})`}
          </Button>
        ) : comments.length === 0 ? (
          <Caption1 className={styles.muted}>{MSG.profileStatsNoComments}</Caption1>
        ) : (
          <div className={styles.commentList}>
            {comments.map((c) => (
              <div key={c.id} className={styles.commentItem}>
                <Avatar name={c.creatorName} size={32} icon={<PersonRegular />} color="colorful" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.commentHead}>
                    <Body1><strong>{c.creatorName}</strong></Body1>
                    <Caption1 className={styles.muted}>
                      →{' '}
                      <Link to={`/demos/${c.demoId}`} className={styles.demoLink}>
                        {titleById.get(c.demoId) ?? c.demoId}
                      </Link>
                    </Caption1>
                    <Caption1 className={styles.commentDate}>
                      {new Date(c.createdAt).toLocaleString('ja-JP', {
                        year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </Caption1>
                  </div>
                  <Body2 style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</Body2>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('settings');

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
  }, [selectedCreator, name, email, language, groupId, isEntraUser, MSG, selectCreator]);

  const handleSaveProfile = useCallback(async () => {
    if (!selectedCreator) return;
    setProfileMsg(null);
    setProfileError(false);
    // アカウント名だけの入力を正規化し、入力欄にも反映
    const nx = normalizeSocialUrl('x', xUrl);
    const nl = normalizeSocialUrl('linkedin', linkedInUrl);
    const ny = normalizeSocialUrl('youtube', youTubeUrl);
    setXUrl(nx);
    setLinkedInUrl(nl);
    setYouTubeUrl(ny);
    setSavingProfile(true);
    try {
      const updated = await creatorService.updateCreator(selectedCreator.id, {
        name: name.trim(),
        // 既存値を消さないよう言語・組織も送信（メールは未指定なら維持される）
        language,
        groupId: groupId || undefined,
        bio: bio.trim(),
        xUrl: nx,
        linkedInUrl: nl,
        youTubeUrl: ny,
      });
      selectCreator(updated);
      setProfileMsg(MSG.profileSaved);
      setProfileError(false);
    } catch (e) {
      setProfileMsg((e as Error).message);
      setProfileError(true);
    } finally {
      setSavingProfile(false);
    }
  }, [selectedCreator, name, language, groupId, bio, xUrl, linkedInUrl, youTubeUrl, MSG, selectCreator]);

  if (!selectedCreator) return <Spinner label="Loading..." />;

  return (
    <div className={styles.page}>
      <Text as="h1" size={700} weight="semibold">{MSG.profileTitle}</Text>

      <TabList selectedValue={activeTab} onTabSelect={(_: SelectTabEvent, d: SelectTabData) => setActiveTab(d.value as string)}>
        <Tab value="settings">{MSG.profileTabSettings}</Tab>
        <Tab value="stats">{MSG.profileTabStats}</Tab>
      </TabList>

      {activeTab === 'stats' ? (
        <StatsDetail creatorId={selectedCreator.id} />
      ) : (
      <>
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
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {MSG.profileUrlHint}
        </Text>
        <div className={styles.field}>
          <Label>{MSG.profileXUrl}</Label>
          <div className={styles.urlRow}>
            <Input style={{ flex: 1 }} value={xUrl} placeholder="geekfujiwara または https://x.com/..." onChange={(_, d) => setXUrl(d.value)} />
            <Tooltip content={MSG.profileTestLink} relationship="label">
              <Button
                appearance="secondary"
                icon={<OpenRegular />}
                disabled={!normalizeSocialUrl('x', xUrl)}
                onClick={() => window.open(normalizeSocialUrl('x', xUrl), '_blank', 'noopener,noreferrer')}
              />
            </Tooltip>
          </div>
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileLinkedInUrl}</Label>
          <div className={styles.urlRow}>
            <Input style={{ flex: 1 }} value={linkedInUrl} placeholder="geekfujiwara または https://www.linkedin.com/in/..." onChange={(_, d) => setLinkedInUrl(d.value)} />
            <Tooltip content={MSG.profileTestLink} relationship="label">
              <Button
                appearance="secondary"
                icon={<OpenRegular />}
                disabled={!normalizeSocialUrl('linkedin', linkedInUrl)}
                onClick={() => window.open(normalizeSocialUrl('linkedin', linkedInUrl), '_blank', 'noopener,noreferrer')}
              />
            </Tooltip>
          </div>
        </div>
        <div className={styles.field}>
          <Label>{MSG.profileYouTubeUrl}</Label>
          <div className={styles.urlRow}>
            <Input style={{ flex: 1 }} value={youTubeUrl} placeholder="geekfujiwara または https://www.youtube.com/@..." onChange={(_, d) => setYouTubeUrl(d.value)} />
            <Tooltip content={MSG.profileTestLink} relationship="label">
              <Button
                appearance="secondary"
                icon={<OpenRegular />}
                disabled={!normalizeSocialUrl('youtube', youTubeUrl)}
                onClick={() => window.open(normalizeSocialUrl('youtube', youTubeUrl), '_blank', 'noopener,noreferrer')}
              />
            </Tooltip>
          </div>
        </div>
        {profileMsg && (
          <MessageBar intent={profileError ? 'error' : 'success'}>
            <MessageBarBody>{profileMsg}</MessageBarBody>
          </MessageBar>
        )}
        <div>
          <Button appearance="primary" disabled={savingProfile || !name.trim()} onClick={() => void handleSaveProfile()}>
            {savingProfile ? <Spinner size="tiny" /> : MSG.profileSaveInfo}
          </Button>
        </div>
      </section>
      </>
      )}

    </div>
  );
}
