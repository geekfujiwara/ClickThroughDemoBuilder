// ============================================================
// 全UI テキスト（日本語） — 将来の i18n に備えて集約
// ============================================================

export const MSG = {
  // ---------- 共通 ----------
  appName: 'Click Through Demo Builder',
  loading: '読み込み中...',
  save: '保存',
  cancel: 'キャンセル',
  delete: '削除',
  duplicate: '複製',
  edit: '編集',
  close: '閉じる',
  confirm: '確認',
  error: 'エラー',
  retry: '再試行',

  // ---------- ホーム ----------
  homeHeroTitle: 'インタラクティブなデモを、\n動画から簡単に作成。',
  homeNewProject: '新規作成',
  homeViewProjects: 'プロジェクト一覧を見る',
  homeRecentProjects: '最近のプロジェクト',
  homeEmptyTitle: 'まだデモがありません。',
  homeEmptyDescription: '「新規作成」から始めましょう。',

  // ---------- プロジェクト一覧 ----------
  projectsTitle: 'プロジェクト一覧',
  projectsNew: '新規作成',
  projectsSearch: '検索...',
  projectsGroupFilter: 'グループ絞り込み',
  projectsGroupAll: 'すべてのグループ',
  projectsNoGroup: 'グループ未設定',
  projectsGroupMaster: 'グループマスター',
  projectsGroupNamePlaceholder: '新規グループ名',
  projectsGroupCreate: 'グループ作成',
  projectsGroupSave: '名称保存',
  projectsGroupDeleteConfirm: (name: string) => `グループ「${name}」を削除しますか？`,
  projectsSortUpdated: '更新日',
  projectsSortCreated: '作成日',
  projectsSortTitle: 'タイトル',
  projectsEmptyTitle: 'プロジェクトがありません。',
  projectsEmptyAction: '新規デモを作成する',
  projectsDeleteConfirm: (title: string) =>
    `「${title}」を削除しますか？この操作は取り消せません。`,
  projectsSteps: (n: number) => `${n} ステップ`,

  // ---------- デザイナー ----------
  designerBack: '← 戻る',
  designerPreview: 'プレビュー',
  designerSaving: '保存中...',
  designerSaved: '保存済み',
  designerUnsaved: '未保存の変更があります',

  // ツールパネル
  toolVideo: '動画',
  toolClickPoint: 'クリックポイント',
  toolSettings: '設定',

  // 動画アップロード
  uploadDropzone: '動画をドラッグ＆ドロップ\nまたはクリックして選択',
  uploadInvalidType: 'MP4 または WebM 形式の動画を選択してください。',
  uploadTooLarge: 'ファイルサイズは 500MB 以下にしてください。',
  uploadFailed: '動画の読み込みに失敗しました。',
  uploadReplaceConfirm:
    '動画を差し替えると、すべてのクリックポイントが削除されます。続行しますか？',

  // クリックポイント
  cpAdd: 'クリックポイント追加',
  cpListTitle: 'クリックポイント一覧',
  cpMaxReached: 'クリックポイントは最大50個までです。',
  cpTimestampDuplicate: 'このタイムスタンプにはすでにクリックポイントがあります。',
  cpDeleteConfirm: 'このクリックポイントを削除しますか？',
  cpDeleteSelectedConfirm: (n: number) => `選択中の ${n} 件のクリックポイントを削除しますか？`,
  cpDeleteAllConfirm: 'すべてのクリックポイントを削除しますか？この操作は取り消せません。',
  cpDeleteAll: '全削除',
  cpDeleteSelected: '選択削除',

  // プロパティ
  propTimestamp: 'タイムスタンプ',
  propPosition: '位置',
  propShape: '形状',
  propCircle: '円形',
  propRectangle: '矩形',
  propRadius: '半径',
  propWidth: '幅',
  propHeight: '高さ',
  propDescription: '説明テキスト',
  propDescriptionPosition: '説明テキスト位置',
  propOrder: '順序',
  propPulseSpeed: '点滅速度',
  propDescriptionStyle: '説明テキストスタイル',
  propTemplate: 'テンプレート',
  propApplyAll: '全CPに適用',
  propSetDefault: '既定値に設定',
  propFontSize: 'フォントサイズ',
  propTextColor: 'テキスト色',
  propBgColor: '背景色',
  propBorderColor: '枠線色',

  // 設定
  settingsTitle: 'デモ設定',
  settingsDemoTitle: 'デモタイトル',
  settingsDescription: '説明文',
  settingsCompletionMsg: '完了メッセージ',
  settingsAutoStart: '自動再生',
  settingsShowProgress: 'プログレスバー表示',
  settingsAllowSkip: 'スキップ許可',

  // デザイナー操作
  designerDeleteProject: 'プロジェクト削除',
  designerDeleteProjectConfirm: 'このプロジェクトを削除しますか？この操作は取り消せません。',
  designerReplaceVideo: '動画を変更',

  // デモ番号 / エクスポート
  demoNumber: 'デモ番号',
  exportDemo: 'エクスポート',
  exportSuccess: 'エクスポートが完了しました。',
  exportFailed: 'エクスポートに失敗しました。',
  exportFolder: 'エクスポート先',
  exportNotYet: 'まだエクスポートされていません',
  exportOpenFolder: 'フォルダを開く',
  saveFolder: '保存先フォルダ',
  saveFolderNotSet: '未設定',
  saveFolderSelect: 'フォルダを選択',
  saveFolderChange: '変更',
  exportAll: '一括エクスポート',
  exportAllSuccess: (n: number) => `${n} 件のデモをエクスポートしました。`,
  exportAllFailed: '一括エクスポートに失敗しました。',
  exportAllProgress: (done: number, total: number) => `エクスポート中... ${done} / ${total}`,
  exportNoProjects: 'エクスポート対象のプロジェクトがありません。',

  // ---------- プレーヤー ----------
  playerStep: (current: number, total: number) => `ステップ ${current} / ${total}`,
  playerComplete: 'デモ完了！',
  playerRestart: 'もう一度',
  playerBackHome: 'ホームに戻る',
  playerVideoError: '動画の読み込みに失敗しました。',
  playerNoClickPoints: 'クリックポイントが設定されていません。通常の動画として再生します。',
  playerLoading: 'デモを読み込んでいます...',
  playerLoadingVideo: '動画を読み込み中...',
  playerStartOverlay: '再生を開始',
  playerRestartFromBeginning: 'はじめから再生',
  playerPrevClickPoint: '前のクリックポイントへ',
  playerTimelineLabel: '再生位置',

  // ---------- Navigation ----------
  navHome: 'ホーム',
  navProjects: 'プロジェクト',
} as const;
