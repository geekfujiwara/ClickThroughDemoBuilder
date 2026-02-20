/**
 * ProfilePage — ログイン中のユーザーが自分のプロフィールを編集するページ
 * - 表示名・表示言語・記資カラーを変更可
 * - メールアドレス: ローカルユーザーのみ変更可（Entra ユーザーは読み取り専用）
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Caption1,
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
import * as groupService from '@/services/groupService';
import type { DemoGroup } from '@/types';
import { useMsg } from '@/hooks/useMsg';

const DEFAULT_COLORS = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
  '#00BCD4', '#FF5722', '#607D8B', '#795548', '#3F51B5',
];

function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 128;
}

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
  colorPickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  colorSwatch: {
    width: '22px',
    height: '22px',
    borderRadius: tokens.borderRadiusSmall,
    border: `2px solid transparent`,
    cursor: 'pointer',
    flexShrink: 0,
  },
  selectedSwatch: {
    border: `2px solid ${tokens.colorBrandBackground}`,
    boxShadow: tokens.shadow4,
  },
  colorInputWrapper: {
    position: 'relative',
    width: '26px',
    height: '26px',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    cursor: 'pointer',
    flexShrink: 0,
  },
  colorPreview: { marginTop: '6px' },
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
  const [color, setColor] = useState<string>(DEFAULT_COLORS[0]!);
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoError, setInfoError] = useState(false);

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
      setColor(selectedCreator.color ?? DEFAULT_COLORS[0]!);
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
        groupId: groupId || undefined,        color: color || undefined,      });
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
        <div className={styles.field}>
          <Label>{MSG.creatorColorLabel}</Label>
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{MSG.creatorColorHint}</Caption1>
          <div className={styles.colorPickerRow}>
            {DEFAULT_COLORS.map((c) => (
              <div
                key={c}
                className={`${styles.colorSwatch} ${color === c ? styles.selectedSwatch : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
            <div className={styles.colorInputWrapper} title="カスタムカラー">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ position: 'absolute', inset: '-4px', width: '40px', height: '40px', cursor: 'pointer', border: 'none', padding: 0 }}
              />
            </div>
          </div>
          <div className={styles.colorPreview}>
            <span style={{ display: 'inline-block', backgroundColor: color, color: isLightColor(color) ? '#111' : '#fff', borderRadius: '4px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
              {name || '表示名'}
            </span>
          </div>
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
