# Click Through デモアプリケーション 設計書

> **バージョン**: 1.3  
> **最終更新**: 2026-02-18  
> **ステータス**: 実装反映済み

---

## 1. プロジェクト概要

### 1.1 アプリケーション名
**Click Through Demo Builder**

### 1.2 目的
動画を元にしたインタラクティブな Click Through デモを作成・実行できる Web アプリケーション。  
デモ作成者は動画上にクリックポイントと説明テキストを配置してデモを設計し、視聴者は再生中に表示されるクリックポイントを順にクリックしながら、製品やサービスの操作手順を体験的に学ぶことができる。

### 1.3 用語定義

| 用語 | 定義 |
|------|------|
| **デモ** | 動画 + クリックポイント + 注釈で構成される一連のインタラクティブ体験 |
| **クリックポイント** | 動画上の特定時間・位置に設定された、視聴者のクリックを待つインタラクション箇所 |
| **説明テキスト** | クリックポイント付近に表示される補足テキスト |
| **デザイナー** | デモを作成・編集するモード |
| **プレーヤー** | デモを視聴者が体験するモード |
| **ステップ** | 1つのクリックポイントとそれに紐づく注釈・説明の単位 |

### 1.4 主要機能
| 機能 | 概要 |
|------|------|
| **デモデザイナー** | 動画のアップロード、クリックポイント配置、説明表示スタイル編集、プレビュー |
| **デモプレーヤー** | 視聴者がデモを体験。クリックポイント点滅・説明表示・進捗管理 |
| **プロジェクト管理** | デモの保存・読込・エクスポート・複製・削除・グループ割り当て |
| **グループマスター管理** | グループ作成・更新・削除、検索フィルター連携 |
| **利用ログ収集** | デモ利用時のデモ名/グループ/IP/拠点推定ログ収集 |

### 1.5 確定済み仕様方針

| 項目 | 決定 | 補足 |
|------|------|------|
| UI表示言語 | **日本語のみ** | 将来のi18n対応はv3.0ロードマップに含む |
| テーマ | **ライトモードのみ** | ダークモードはv1スコープ外 |
| タイムスタンプとCPの関係 | **1タイムスタンプ = 1CP** | 同一タイムスタンプに複数CPは設定不可 |
| デモ共有方法 | **Azure Static Web Apps のURL共有** | 認証付きでデモ閲覧/編集を制御 |
| 動画差し替え | **可能（CP・注釈はリセット）** | 確認ダイアログで警告後、全CP・注釈を削除して新動画に置換 |
| 誤クリック時の挙動 | **無視（何も起きない）** | クリックポイント以外の場所をクリックしても反応しない |
| CPの最大数 | **1デモあたり最大50個** | 注釈も最大50個 |
| デプロイ先 | **Azure Static Web Apps + Functions** | GitHub Actions で自動デプロイ |

### 1.6 ユーザーペルソナ

#### デモ作成者
- 製品マーケティング担当、セールスエンジニア、カスタマーサクセス担当
- 動画キャプチャツールで録画した操作動画をデモ化したい
- 技術知識は必ずしも高くない → 直感的な操作が求められる

#### デモ視聴者
- 見込み顧客、新規ユーザー、研修生
- 同じPC上のブラウザでデモを再生して体験（v1ではローカルのみ）
- モバイルからもアクセスする可能性がある

---

## 2. システム構成

### 2.1 技術スタック

| レイヤー | 技術 | 選定理由 |
|----------|------|----------|
| フレームワーク | React 18+ | コンポーネント設計に適し、エコシステムが充実 |
| 言語 | TypeScript (strict mode) | 型安全性によりデータモデルの整合性を保証 |
| UI ライブラリ | Fluent UI React v9 | 要件のFluent・角丸デザインに直接対応。テーマトークンで一貫性確保 |
| 状態管理 | Zustand | Context APIより再レンダリング制御が容易。デザイナーの複雑な状態に適合 |
| ルーティング | React Router v6 | SPA標準。ネストルート・パラメータ対応 |
| ビデオ制御 | ネイティブ HTML5 `<video>` + カスタムフック | 外部依存を減らし、`currentTime` や `pause()` の細かい制御が必要なため |
| アニメーション | Framer Motion | 宣言的API、パルスアニメーション・レイアウトアニメーションに最適 |
| スタイリング | Fluent UI Tokens + CSS Modules | Fluent UIのデザイントークンを活用しつつ、カスタムスタイルはCSS Modulesで分離 |
| バックエンド | Azure Functions (Node.js 20) | 認証、データAPI、利用ログ収集をサーバーレスで実現 |
| ストレージ | Azure Blob Storage | プロジェクトJSON/動画/ログを分離して保存 |
| 監視 | Application Insights | フロントのテレメトリ収集 |
| ビルドツール | Vite | 高速HMR、TypeScript対応、ビルド最適化 |
| リンター/フォーマッター | ESLint + Prettier | コード品質と一貫性を確保 |
| テスト | Vitest + React Testing Library + Playwright | ユニット・統合・E2Eを網羅 |

### 2.2 アーキテクチャ

```
┌───────────────────────────────────────────────────┐
│                 React Application                 │
├───────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────┐   ┌──────────┐   ┌─────────────┐ │
│  │  Pages   │   │  Pages   │   │   Pages     │ │
│  │  Home    │   │ Designer │   │   Player    │ │
│  │ Projects │   │          │   │             │ │
│  └────┬─────┘   └────┬─────┘   └──────┬──────┘ │
│       │               │                │         │
│  ┌────┴───────────────┴────────────────┴──────┐ │
│  │         Zustand Store (状態管理)            │ │
│  │  ┌─────────────┐  ┌──────────────────────┐│ │
│  │  │ projectStore│  │ designerStore        ││ │
│  │  │ (CRUD操作)  │  │ (選択/Undo/Redo等)  ││ │
│  │  └─────────────┘  └──────────────────────┘│ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────┴───────────────────────┐ │
│  │          Services Layer                     │ │
│  │  storage.ts │ videoProcessor.ts │ export.ts │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────┴───────────────────────┐ │
│  │         IndexedDB (永続化)                  │ │
│  │  projects(JSON) │ videos(Blob)              │ │
│  └────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

### 2.3 Blob Storage スキーマ

```
Containers:
  ├── projects      // {projectId}.json
  ├── videos        // {projectId}/video.{ext}
  ├── masters       // groups.json
  └── usage-logs    // {yyyy-mm-dd}/{timestamp}-{uuid}.json
```

- プロジェクトJSONと動画を分離保存し、更新コストを低減
- グループマスターは `masters/groups.json` で一元管理
- 利用ログは日付パーティションで保存し分析しやすくする

---

## 3. 機能仕様

### 3.1 デモデザイナー機能

#### 3.1.1 動画管理

**動画アップロード**
| 項目 | 仕様 |
|------|------|
| サポート形式 | MP4 (H.264), WebM (VP8/VP9) |
| 最大ファイルサイズ | 500 MB |
| 入力方法 | ドラッグ&ドロップ / ファイル選択ダイアログ |
| バリデーション | MIMEタイプ検証、ファイルサイズ検証、再生可能性チェック |
| サムネイル生成 | アップロード時に先頭フレームからCanvasで自動生成 |
| 動画差し替え | 既存プロジェクトの動画を差し替え可能。**差し替え時はCP・注釈を全削除**（確認ダイアログ表示） |

**動画プレビュー**
- 再生/一時停止/シーク (クリックまたはドラッグ)
- 再生速度調整: 0.25x, 0.5x, 1x, 1.5x, 2x
- 現在時間・総時間の表示 (MM:SS.ms)
- フレーム単位送り (← → キー)

#### 3.1.2 クリックポイント設定

**追加方法**
1. 動画を目的のタイムスタンプまで再生・一時停止
2. ツールパネルの「クリックポイント追加」をクリック
3. 動画プレビュー上の目的の位置をクリックして座標を確定
4. プロパティパネルで詳細を編集

**編集操作**
| 操作 | 方法 |
|------|------|
| 位置変更 | ドラッグ & ドロップ |
| サイズ変更 | リサイズハンドルのドラッグ |
| 時間変更 | タイムライン上のマーカードラッグ or プロパティ入力 |
| 削除 | 選択 → Delete キー or コンテキストメニュー |
| 順序変更 | タイムライン上でドラッグ or プロパティで数値指定 |

**プロパティ一覧**
| プロパティ | 型 | 説明 | デフォルト |
|------------|------|------|------------|
| タイムスタンプ | number (秒) | 動画の一時停止タイミング | 現在の再生位置 |
| 位置 (X, Y) | number (%) | 動画領域に対する相対座標 | クリック位置 |
| 範囲形状 | circle / rectangle | クリック可能領域の形状 | circle |
| 半径 / 幅×高さ | number (px) | 領域サイズ | 30px |
| 説明テキスト | string | クリックポイント横に表示 | 空 |
| 順序 | number | クリック順 | 自動連番 |
| 点滅速度 | 1-5 | パルスアニメーション速度 | 3 |

> **制約**: 1つのタイムスタンプに設定できるCPは**1つまで**。同じタイムスタンプへの重複追加はバリデーションエラーとなる。  
> **制約**: 1デモあたりのCP最大数は**50個**。

#### 3.1.3 グループ管理機能

**グループマスター管理**
- プロジェクト一覧・デザイナー設定ポップオーバーの両方で管理可能
- グループの作成・名称更新・削除をサポート
- 同名グループの重複作成を禁止（大文字小文字を区別しない）

**デモへの割り当て**
- 各デモに `groupId` を設定可能（未設定可）
- プロジェクト一覧カードの操作領域から割り当て変更可能
- デザイナー画面の設定ポップオーバーからも変更可能

**削除時挙動**
- グループ削除時、該当グループに紐づくデモの `groupId` は未設定へ自動変更

#### 3.1.4 Undo / Redo

- すべての編集操作を履歴スタックで管理
- `Ctrl+Z` で Undo、`Ctrl+Y` / `Ctrl+Shift+Z` で Redo
- 履歴の最大保持数: 50 操作

#### 3.1.5 プレビューモード

- デザイナー画面からワンクリックでプレビューに切り替え
- 実際のプレーヤーと同じ挙動でデモを確認可能
- プレビュー中はプレーヤー画面に遷移せず、インラインで動作

#### 3.1.6 キーボードショートカット

| ショートカット | 操作 |
|---------------|------|
| `Space` | 再生 / 一時停止 |
| `←` / `→` | 1フレーム戻る / 進む |
| `Shift+←` / `Shift+→` | 5秒戻る / 進む |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | 選択要素の削除 |
| `Ctrl+S` | プロジェクト保存 |
| `Ctrl+D` | 選択要素の複製 |
| `Escape` | 選択解除 / モード解除 |

#### 3.1.7 プロジェクト管理

**保存**
- 自動保存: 編集操作後3秒のデバウンスで自動保存
- 手動保存: `Ctrl+S` またはツールバーボタン
- 保存先: IndexedDB

**エクスポート / インポート**
- JSON形式のプロジェクトファイル (.ctdemo)
- エクスポート時に動画を含める/含めないの選択
- 動画を含める場合は Zip 形式で出力

> **v1注記**: デモの共有手段はローカルのみ。エクスポート/インポートは「同じPCでのバックアップ・リストア」目的。  
> 他ユーザーへのファイル共有・URL共有は将来バージョンで対応。

**設定項目**
| 設定 | 型 | デフォルト |
|------|------|-----------|
| デモタイトル | string | "無題のデモ" |
| 説明文 | string | 空 |
| 完了メッセージ | string | "お疲れ様でした！デモが完了しました。" |
| 自動開始 | boolean | true |
| 進捗バー表示 | boolean | true |
| スキップ許可 | boolean | false |

### 3.2 デモ実行機能

#### 3.2.1 プレーヤーの状態遷移

```
                  ┌──────────┐
                  │  INIT    │  デモ読み込み完了
                  └────┬─────┘
                       │ autoStart=true → 自動再生
                       ▼
                  ┌──────────┐
           ┌─────│ PLAYING  │◄──────────────┐
           │     └────┬─────┘               │
           │          │ クリックポイントの     │
           │          │ タイムスタンプに到達   │
           │          ▼                      │
           │     ┌──────────┐               │
           │     │ WAITING  │  視聴者が      │
           │     │ (一時停止)│  クリック      │
           │     └────┬─────┘───────────────┘
           │          │ 最後のポイントをクリック
           │          ▼
           │     ┌──────────┐
           │     │ COMPLETE │
           │     └──────────┘
           │          │ "もう一度"
           │          ▼
           └──────────┘
```

#### 3.2.2 クリックポイント表示

**点滅アニメーション**
- 色: 薄い黄色 (`#FFEB3B`) 
- 不透明度: 0.3 ↔ 0.7 を周期的に変化
- スケール: 1.0 ↔ 1.15 のパルス
- 周期: 1.2秒 (点滅速度3の場合)
- 外縁にリング状のリプルエフェクトを追加し、視認性を向上

**ヒットエリア**
- 表示サイズより 20% 大きいヒット判定領域を設定（タッチ操作の許容範囲拡大）
- マウスホバー時: カーソルを `pointer` に変更、不透明度を 0.8 に上昇
- **クリックポイント以外の場所をクリック → 何も起きない（無視）**

**説明テキスト表示**
- クリックポイントの上方にツールチップ形式（半透明角丸カード）
- テキストが長い場合は最大幅 320px で折り返し
- 動画端にかかる場合は表示位置を自動調整（画面内に収まるよう）

#### 3.2.3 説明テキスト表示
- WAITING 状態でクリックポイント付近に表示
- テキストスタイル（フォントサイズ・文字色・背景色・枠線色・角丸）はクリックポイントごとに保持
- 説明テキストはクリックを透過し、クリックポイント操作を妨げない

#### 3.2.4 プログレス表示
- 画面下部にプログレスバー
- 「ステップ N / M」のテキスト表示
- 完了したステップはチェックマーク付きで表示

#### 3.2.5 完了画面
- 全クリックポイント完了後にモーダル表示
- カスタマイズ可能な完了メッセージ
- アクションボタン: 「もう一度」「ホームに戻る」

#### 3.2.6 エラー・エッジケース

| ケース | 挙動 |
|--------|------|
| 動画の読み込み失敗 | エラーメッセージ + リトライボタン |
| クリックポイントが0件 | 通常の動画再生として動作 |
| ブラウザ非対応コーデック | 対応形式への変換を促すメッセージ |
| ログ送信失敗 | プレーヤー動作は継続（ログ送信のみ失敗として扱う） |

---

## 4. データ構造

### 4.1 デモプロジェクト (DemoProject)

```typescript
interface DemoProject {
  id: string;                    // UUID v4
  demoNumber: number;            // 自動採番
  title: string;                 // デモタイトル（1-100文字）
  groupId?: string;              // 所属グループID（未設定可）
  description: string;           // 説明文（0-500文字）
  createdAt: string;             // ISO 8601 (例: "2026-02-17T10:30:00Z")
  updatedAt: string;             // ISO 8601
  video: VideoInfo;              // 動画情報
  clickPoints: ClickPoint[];     // クリックポイント配列（orderでソート済み）
  settings: DemoSettings;        // デモ設定
  version: number;               // スキーマバージョン（将来のマイグレーション用）
  lastExportFolderName?: string;
  lastExportedAt?: string;
}
```

### 4.2 動画情報 (VideoInfo)

```typescript
interface VideoInfo {
  videoId: string;               // IndexedDB videos ストアのキー
  fileName: string;              // 元のファイル名
  mimeType: string;              // "video/mp4" | "video/webm"
  duration: number;              // 動画の長さ（秒、小数点以下2桁）
  width: number;                 // 動画の解像度（横px）
  height: number;                // 動画の解像度（縦px）
  thumbnailDataUrl: string;      // サムネイル (data:image/jpeg;base64,...)
}
```

### 4.3 クリックポイント (ClickPoint)

```typescript
interface ClickPoint {
  id: string;                    // UUID v4
  timestamp: number;             // 動画の一時停止時間（秒、小数点以下2桁）
  position: Position;            // 動画領域内の相対座標
  area: ClickArea;               // クリック可能領域
  description: string;           // 説明テキスト（0-200文字）
  descriptionOffset: Position;   // 説明表示位置オフセット（%）
  descriptionStyle: DescriptionStyle;
  order: number;                 // クリック順序（1始まり、連番）
  pulseSpeed: PulseSpeed;        // 点滅速度
}

interface Position {
  x: number;                     // X座標（0-100、動画幅に対する%）
  y: number;                     // Y座標（0-100、動画高さに対する%）
}

type ClickArea =
  | { type: 'circle'; radius: number }         // 半径（px、5-200）
  | { type: 'rectangle'; width: number; height: number }; // 幅・高さ（px、10-400）

type PulseSpeed = 1 | 2 | 3 | 4 | 5;
// 1=2.0秒周期（遅い）, 2=1.6秒, 3=1.2秒, 4=0.8秒, 5=0.5秒（速い）
```

### 4.4 グループマスター (DemoGroup)

```typescript
interface DemoGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

### 4.5 デモ設定 (DemoSettings)

```typescript
interface DemoSettings {
  autoStart: boolean;            // デモ読み込み時に自動再生（デフォルト: true）
  showProgress: boolean;         // プログレスバー表示（デフォルト: true）
  completionMessage: string;     // 完了メッセージ
  allowSkip: boolean;            // ステップスキップ許可（デフォルト: false）
  defaultDescriptionStyle: DescriptionStyle;
}
```

### 4.6 利用ログ (DemoUsageLog)

```typescript
interface DemoUsageLog {
  id: string;
  timestamp: string;
  event: 'view_start' | 'view_complete';
  demoId: string;
  demoName: string;
  demoGroupId?: string;
  demoGroupName: string;
  role: 'viewer' | 'designer' | 'unknown';
  ip: string;
  site: string;                  // IPルールまたはGeo推定
  userAgent: string;
}
```

### 4.7 バリデーションルール

| フィールド | ルール |
|-----------|--------|
| `title` | 1文字以上100文字以下、空白のみ不可 |
| `clickPoints[].timestamp` | 0 ≤ timestamp ≤ video.duration |
| `clickPoints[].position.x/y` | 0 ≤ value ≤ 100 |
| `clickPoints[].order` | 1から始まる連番、重複不可 |
| `clickPoints[].timestamp` (重複) | 同一プロジェクト内でタイムスタンプの重複不可 |
| `clickPoints[]` (件数) | 1プロジェクトあたり最大50件 |
| `group.name` | 空不可、同名重複不可 |
| `usage.event` | `view_start` / `view_complete` のみ |

---

## 5. 画面設計

### 5.1 画面一覧とルーティング

| 画面 | パス | 説明 |
|------|------|------|
| Viewerログイン | `/viewer/login` | 視聴者ログイン |
| Adminログイン | `/admin/login` | 管理者ログイン |
| ホーム | `/` | ランディング、最近のプロジェクト表示（designer） |
| デザイナー（新規） | `/designer` | 新規デモ作成 |
| デザイナー（編集） | `/designer/:projectId` | 既存デモ編集 |
| プレーヤー | `/player/:projectId` | デモ実行 |
| Viewerデモ一覧 | `/viewer/demos` | 視聴者向けデモ一覧 |
| プロジェクト一覧 | `/projects` | 全プロジェクト管理 |

### 5.2 各画面の詳細

#### 5.2.1 ホーム画面 (`/`)

```
┌─────────────────────────────────────────────────┐
│  Logo  Click Through Demo Builder    [Projects] │
├─────────────────────────────────────────────────┤
│                                                 │
│       インタラクティブなデモを、                │
│       動画から簡単に作成。                      │
│                                                 │
│   ┌────────────────┐  ┌────────────────┐      │
│   │  + 新規作成    │  │  プロジェクト  │      │
│   │                │  │  一覧を見る    │      │
│   └────────────────┘  └────────────────┘      │
│                                                 │
│   ── 最近のプロジェクト ─────────────          │
│                                                 │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│   │thumbnail│ │thumbnail│ │thumbnail│       │
│   │ Title 1 │ │ Title 2 │ │ Title 3 │       │
│   │ 更新日  │ │ 更新日  │ │ 更新日  │       │
│   │ ▶ 再生  │ │ ▶ 再生  │ │ ▶ 再生  │       │
│   └─────────┘ └─────────┘ └─────────┘       │
│                                                 │
│   プロジェクトが無い場合:                      │
│   ┌───────────────────────────────────┐       │
│   │  まだデモがありません。           │       │
│   │  「新規作成」から始めましょう。   │       │
│   └───────────────────────────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**状態**
- **通常**: 最近のプロジェクトカード（最大6件、更新日降順）
- **空**: 空状態イラスト + 「新規作成」誘導メッセージ
- **読込中**: スケルトンカード × 3

#### 5.2.2 デモデザイナー画面 (`/designer/:projectId?`)

```
┌─────────────────────────────────────────────────────┐
│ ← 戻る │ [プロジェクト名]  │ プレビュー │ 保存 │ ⋯ │
├────────┬────────────────────────────────────────────┤
│        │                                            │
│ TOOLS  │          動画プレビュー                    │
│        │  ┌──────────────────────────────────────┐ │
│ ┌────┐ │  │                                      │ │
│ │ 📹 │ │  │       [動画 + オーバーレイ]          │ │
│ │動画│ │  │       (クリックポイント・注釈)        │ │
│ └────┘ │  │                                      │ │
│ ┌────┐ │  └──────────────────────────────────────┘ │
│ │ 🎯 │ │                                            │
│ │CP  │ │  ▶ ■ 00:12.5 / 02:30.0   0.5x 1x 2x     │
│ └────┘ │                                            │
│ ┌────┐ │  ┌────────────────────────────────────────┐│
│ │ 📝 │ │  │ タイムライン                           ││
│ │注釈│ │  │ ──●──────●───●─────────────           ││
│ └────┘ │  │   CP1    CP2 A1                        ││
│ ┌────┐ │  └────────────────────────────────────────┘│
│ │ ⚙️ │ │                                            │
│ │設定│ ├────────────────────────────────────────────┤
│ └────┘ │         プロパティパネル                    │
│        │  [選択された要素のプロパティ編集]           │
│ クリッ │  位置: X [52.3]%  Y [34.1]%                │
│ クポイ │  説明: [ここをクリック___________]          │
│ ント   │  形状: ◉ 円形  ○ 矩形  半径: [30]px      │
│ 一覧   │                                            │
│ ┌────┐ │                                            │
│ │ 1  │ │                                            │
│ │ 2  │ │                                            │
│ │ 3  │ │                                            │
│ └────┘ │                                            │
└────────┴────────────────────────────────────────────┘
```

**主要インタラクション**
- **動画未設定**: 中央に大きなドロップゾーン表示
- **クリックポイント追加**: ツール選択 → 動画上クリック → 即座にプロパティパネル表示
- **要素選択**: 動画上の要素クリック or サイドバーリスト選択 → プロパティパネルに詳細表示
- **ドラッグ**: 動画上の要素をドラッグして位置変更
- **タイムライン**: マーカーのドラッグでタイムスタンプ変更

#### 5.2.3 デモプレーヤー画面 (`/player/:projectId`)

```
┌─────────────────────────────────────────────────┐
│                                           ✕     │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │                                           │ │
│  │         動画                               │ │
│  │                                           │ │
│  │         ┌─────────────────┐               │ │
│  │         │ ここをクリック  │               │ │
│  │         └────────┬────────┘               │ │
│  │              ◯◯◯ ← 薄い黄色パルス        │ │
│  │                                           │ │
│  │  ┌───────────────────┐                    │ │
│  │  │ 📝 この画面では...│  ← 注釈           │ │
│  │  └───────────────────┘                    │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ━━━━━━━━━━━━━━━━━████━━━━━━━━━━━━━━━━━━━  │
│  ステップ 2 / 5                                 │
│                                                 │
└─────────────────────────────────────────────────┘

完了モーダル:
┌─────────────────────────────────────────────────┐
│                                                 │
│     ┌─────────────────────────────────────┐    │
│     │                                     │    │
│     │        🎉 デモ完了！                │    │
│     │                                     │    │
│     │   お疲れ様でした！                  │    │
│     │   すべてのステップを完了しました。  │    │
│     │                                     │    │
│     │   [もう一度]   [ホームに戻る]       │    │
│     │                                     │    │
│     └─────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

**フルスクリーン**: `F11` またはボタンで全画面切り替え

#### 5.2.4 プロジェクト一覧画面 (`/projects`)

```
┌──────────────────────────────────────────────────┐
│ ← ホーム │ プロジェクト一覧        [+ 新規作成]  │
├──────────────────────────────────────────────────┤
│ 🔍 検索...   並び替え: [更新日 ▼]               │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ [thumbnail]  │  │ [thumbnail]  │             │
│  │  Demo Title  │  │  Demo Title  │             │
│  │  5 ステップ  │  │  3 ステップ  │             │
│  │  更新: 2/17  │  │  更新: 2/15  │             │
│  ├──────────────┤  ├──────────────┤             │
│  │ ▶再生 ✏編集 │  │ ▶再生 ✏編集 │             │
│  │ 📋複製 🗑削除│  │ 📋複製 🗑削除│             │
│  └──────────────┘  └──────────────┘             │
│                                                  │
│  空の場合:                                       │
│  ┌──────────────────────────────────────┐       │
│  │  プロジェクトがありません。          │       │
│  │  [新規デモを作成する]                │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└──────────────────────────────────────────────────┘
```

**機能**
- グリッドレイアウト（レスポンシブ: 1-3列）
- 検索: タイトル・説明文のインクリメンタル検索
- グループフィルター: 全体/未設定/グループ別絞り込み
- グループマスター管理: 作成・更新・削除
- 並び替え: 更新日（降順/昇順）、作成日、タイトル
- 削除時: 確認ダイアログを表示

---

## 6. UI/UX デザイン

### 6.1 デザイン原則

1. **明確性**: 操作可能な要素を視覚的に明確にする
2. **一貫性**: Fluent UI v9のデザイントークンを全面的に採用
3. **フィードバック**: ユーザー操作に対して即座の視覚的反応
4. **段階的開示**: 必要な情報だけを表示し、詳細はプロパティパネルに集約

### 6.2 デザインシステム

#### カラーパレット（Fluent UI v9 トークン活用）

```typescript
// Fluent UI v9 のトークンをそのまま使用
import { tokens } from '@fluentui/react-components';

// アプリ固有のカスタムトークン
const appTokens = {
  // クリックポイント表示色
  clickHighlight: '#FFEB3B',          // 黄色ベース
  clickHighlightAlpha30: '#FFEB3B4D', // 30% 不透明度
  clickHighlightAlpha70: '#FFEB3BB3', // 70% 不透明度
  clickHighlightHover: '#FDD835',     // ホバー時

  // タイムライン
  timelineBg: '#F5F5F5',
  timelineMarkerCP: '#0078D4',        // クリックポイントマーカー
  timelineMarkerAnnotation: '#8764B8', // 注釈マーカー

  // アプリ背景（サーフェス階層）
  surfaceBase: '#FAFAFA',
  surfaceCard: '#FFFFFF',
  surfaceOverlay: 'rgba(0, 0, 0, 0.4)',
};
```

#### タイポグラフィ
Fluent UI v9 の `typographyStyles` をそのまま使用:
- `title1` (28px/36 semibold) - ページタイトル
- `subtitle1` (20px/28 semibold) - セクション見出し
- `body1` (14px/20 regular) - 本文
- `caption1` (12px/16 regular) - 補足テキスト

#### スペーシング・角丸
Fluent UI v9 のトークンを使用:
- `borderRadiusMedium` (4px) - 入力フィールド
- `borderRadiusLarge` (8px) - カード
- `borderRadiusXLarge` (12px) - モーダル、大きなカード

#### シャドウ
Fluent UI v9 の `shadow4`, `shadow8`, `shadow16` を使用

### 6.3 テーマ

- **v1ではライトモードのみ**
- Fluent UI v9 の `webLightTheme` を使用
- ダークモード対応は将来バージョンで検討

### 6.4 UIテキストの言語

- **全UIテキストは日本語**（ボタン、ラベル、メッセージ、プレースホルダー等）
- 将来のi18n対応に備え、UIテキストは定数ファイル (`src/constants/messages.ts`) に集約

### 6.5 レスポンシブデザイン

| ブレークポイント | 幅 | レイアウト変更 |
|-----------------|-----|---------------|
| Mobile | < 768px | デザイナーは非対応（プレーヤーのみ対応）、カード1列 |
| Tablet | 768-1024px | デザイナーのサイドバー折りたたみ、カード2列 |
| Desktop | 1024-1440px | 標準レイアウト、カード3列 |
| Wide | > 1440px | 最大幅1440pxで中央配置 |

> **注**: デザイナーはポインターデバイスでの精密操作が前提のため、モバイルではプレーヤーのみ対応。

### 6.6 アニメーション仕様

#### クリックポイントの点滅（パルス）
```css
@keyframes clickPointPulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 235, 59, 0.4);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.15);
    box-shadow: 0 0 0 12px rgba(255, 235, 59, 0);
  }
}
/* 速度3 (デフォルト) の場合: animation: clickPointPulse 1.2s ease-in-out infinite; */
```

#### 注釈の出現
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* animation: fadeIn 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards; */

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

#### トランジション
- ページ遷移: Framer Motion `AnimatePresence` (200ms フェード)
- パネル展開/折りたたみ: 200ms ease-out
- ツールチップ: 150ms フェード

### 6.7 ローディング状態

| 画面 | ローディング表示 |
|------|----------------|
| ホーム | プロジェクトカードのスケルトン（パルスアニメーション） |
| デザイナー | 動画読み込み中は中央にスピナー + 「動画を読み込んでいます...」 |
| プレーヤー | 全画面スピナー + デモタイトル表示 |
| プロジェクト一覧 | カードのスケルトン × 6 |

---

## 7. コンポーネント設計

### 7.1 ディレクトリ構成

```
src/
├── App.tsx / main.tsx
├── components/
│   ├── auth/                  # Viewer/Admin ログイン, AuthGuard
│   ├── common/                # AppLayout, Navigation, AppSymbol など
│   ├── designer/              # Canvas, Controls, Timeline, PropertyPanel など
│   └── viewer/                # ViewerDemosPage
├── pages/                     # Home / Projects / Designer / Player
├── services/                  # apiClient, project/group/video/export/usage
├── stores/                    # authStore, projectStore, designerStore
├── types/                     # index.ts（統合型定義）
├── constants/messages.ts
├── utils/                     # coordinates, time, validation, id
└── styles/                    # global.css, animations.css

api/src/
├── functions/                 # auth, projects, groups, videos, usage
├── middleware/auth.ts
├── services/                  # blobService, projectService, groupService, usageLogService
└── shared/types.ts
```

### 7.2 主要コンポーネントの責務と Props

#### DesignerCanvas
```typescript
interface DesignerCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  currentTime: number;
  onTimeUpdate: () => void;
}
```
- 動画の `<video>` 要素と透明オーバーレイ `<div>` を重ねて配置
- オーバーレイ上でクリックポイントをレンダリング
- 追加ツール有効時のクリックポイント追加イベントを処理

#### PlayerPage
```typescript
interface PlayerPageRuntime {
  project: DemoProject;
  playerState: 'INIT' | 'PLAYING' | 'WAITING' | 'COMPLETE';
  currentStepIndex: number;
}
```
- 状態マシン (INIT → PLAYING → WAITING → PLAYING → ... → COMPLETE) を管理
- `requestAnimationFrame` で再生時間を監視しクリックポイント到達を検出
- view_start / view_complete の利用ログ送信

#### Timeline
```typescript
interface TimelineProps {
  duration: number;
  currentTime: number;
  clickPoints: ClickPoint[];
  onSeek: (time: number) => void;
}
```
- 横軸が時間のバー表示
- クリックポイントをマーカーとして表示
- クリックでシーク、ドラッグでタイムスタンプ変更

---

## 8. 状態管理設計

### 8.1 projectStore (Zustand)

```typescript
interface ProjectStoreState {
  projects: DemoProject[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectStoreActions {
  loadProjects: () => Promise<void>;
  getProject: (id: string) => Promise<DemoProject | undefined>;
  createProject: (project: Omit<DemoProject, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => Promise<string>;
  updateProject: (id: string, updates: Partial<DemoProject>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<string>;
}
```

### 8.2 designerStore (Zustand)

```typescript
interface DesignerStoreState {
  currentProject: DemoProject | null;
  selectedElementId: string | null;
  selectedElementType: 'clickPoint' | 'annotation' | null;
  activeTool: 'select' | 'addClickPoint' | 'addAnnotation' | null;
  annotationSubType: AnnotationType | null;
  isDirty: boolean;                    // 未保存の変更あり
  undoStack: DemoProject[];            // Undo 用スナップショット
  redoStack: DemoProject[];            // Redo 用スナップショット
}

interface DesignerStoreActions {
  setProject: (project: DemoProject) => void;
  selectElement: (id: string | null, type?: 'clickPoint' | 'annotation') => void;
  setActiveTool: (tool: DesignerStoreState['activeTool']) => void;

  // クリックポイント操作
  addClickPoint: (cp: Omit<ClickPoint, 'id'>) => void;
  updateClickPoint: (id: string, updates: Partial<ClickPoint>) => void;
  removeClickPoint: (id: string) => void;
  reorderClickPoints: (orderedIds: string[]) => void;

  // 注釈操作
  addAnnotation: (ann: Omit<Annotation, 'id'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;

  // 保存
  markSaved: () => void;
}
```

---

## 9. 座標系の設計

### 9.1 相対座標の仕組み

動画のアスペクト比やウィンドウサイズに依存しないよう、すべての座標を **動画領域に対する百分率 (%)** で保持する。

```
動画表示領域
┌────────────────────────┐ (0, 0)
│                        │
│        ● CP            │  → position: { x: 35.5, y: 42.0 }
│                        │    = 左から35.5%, 上から42.0%
│                        │
└────────────────────────┘ (100, 100)
```

### 9.2 座標変換

```typescript
// % → px（表示時）
function toPixel(percent: number, containerSize: number): number {
  return (percent / 100) * containerSize;
}

// px → %（配置時）
function toPercent(pixel: number, containerSize: number): number {
  return (pixel / containerSize) * 100;
}
```

### 9.3 クリック範囲のサイズ

`area.radius` や `area.width/height` は **px 値** で保持する。ただし、動画の表示倍率に応じてスケーリングして描画する。

```typescript
// 表示スケーリング係数
const scale = displayedVideoWidth / video.width;
const displayRadius = clickPoint.area.radius * scale;
```

---

## 10. 実装ステータス（2026-02-18時点）

### 完了済み
- React + TypeScript + Fluent UI v9 + React Router 構成
- Viewer/Designer の認証分離（Cookie/JWT）
- デザイナー（動画管理、クリックポイント編集、Undo/Redo、自動保存）
- プレーヤー（状態遷移、WAITINGクリック、進捗表示、完了モーダル）
- プロジェクト一覧（検索、ソート、複製、削除、エクスポート）
- グループマスター管理（作成/更新/削除）
- グループ割当・グループフィルター
- 利用ログ（view_start/view_complete、デモ名・グループ名・IP・拠点推定）
- Azure Static Web Apps + Functions + Blob Storage デプロイ

### 未実装 / 今後対応
- 注釈（Annotation）専用データモデルと編集UI
- 利用ログの集計ダッシュボード（ランキング/期間集計）
- E2E 自動テスト整備

---

## 11. 技術的考慮事項

### 11.1 パフォーマンス

| 対策 | 詳細 |
|------|------|
| コード分割 | `React.lazy` でページ単位を遅延読み込み |
| 動画メモリ | `URL.createObjectURL` で Blob を表示、不要時に `URL.revokeObjectURL` |
| メモ化 | 座標変換やフィルタリングなど頻繁に呼ばれる計算を `useMemo` で最適化 |
| `timeupdate` 最適化 | `requestAnimationFrame` でスロットリング（60fps上限） |
| 仮想化 | プロジェクト一覧が50件超の場合は `react-window` で仮想スクロール |

### 11.2 アクセシビリティ

- Fluent UI v9 コンポーネントの ARIA 対応をそのまま活用
- プレーヤーのクリックポイントに `role="button"`, `aria-label` を設定
- キーボード操作: Tab でクリックポイント間移動、Enter/Space でクリック
- 色だけに依存しない表示: 点滅 + リプルのビジュアル + テキストラベル
- コントラスト比: WCAG 2.1 AA 準拠（Fluent UI トークンで保証）

### 11.3 セキュリティ

| 対策 | 詳細 |
|------|------|
| ファイル検証 | アップロード時に MIME タイプ + マジックバイト検証 |
| XSS 防止 | React の自動エスケープ + 注釈テキストの `DOMPurify` サニタイズ |
| インポート検証 | JSON スキーマバリデーション（インポート時） |

### 11.4 ブラウザ互換性

- **対象**: Chrome, Edge, Firefox, Safari (各最新2バージョン)
- **必須API**: IndexedDB, HTML5 Video, CSS Animations, `crypto.randomUUID`
- **フォールバック**: `crypto.randomUUID` 非対応ブラウザでは `uuid` ライブラリ使用

### 11.5 デプロイメント (v1)

現行は Azure Static Web Apps + Azure Functions (Managed) で運用する。

```bash
# ローカル開発
npm run dev

# フロント + API ビルド
npm run build
cd api && npm run build
```

- 本番配信: Azure Static Web Apps
- API: Azure Functions
- データ: Azure Blob Storage（projects/videos/masters/usage-logs）
- CI/CD: GitHub Actions（`.github/workflows/deploy.yml`）

---

## 12. 将来の拡張機能

### 短期 (v1.1 - v1.3)
- JSON/Zipファイルによるデモのエクスポート・インポート共有
- 音声ナレーション機能（クリックポイントごとに音声再生）
- テーマカスタマイズ（ブランドカラー、クリックポイントの色変更）
- ダークモード対応

### 中期 (v2.0)
- ユーザー認証（Microsoft Entra ID）
- 分岐シナリオ（クリック位置に応じて異なるパスへ）
- アナリティクス強化（集計API、ランキング画面、期間比較）
- 同一タイムスタンプ複数CP対応

### 長期 (v3.0)
- AI自動検出（動画からUIコンポーネントを検出しクリックポイントを自動提案）
- 多言語対応（i18n）
- iframe埋め込み対応（ドキュメントやWebサイトへの組み込み）
- 静的ホスティング（GitHub Pages / Vercel / Azure SWA）への公開対応

---

## 13. 成功指標

### 技術的指標
| 指標 | 目標値 |
|------|--------|
| 初期ロード (LCP) | < 2秒 |
| 動画再生開始 | < 1秒 (IndexedDB からの読み込み) |
| Lighthouse Performance | > 90 |
| TypeScript strict mode | エラー0件 |
| テストカバレッジ (ユーティリティ・ストア) | > 80% |

### ユーザビリティ指標
| 指標 | 目標値 |
|------|--------|
| 5ステップのデモ作成時間 | < 10分 |
| デモ完了率（視聴者） | > 85% |
| デザイナーの主要操作回数 | 目的達成まで5クリック以内 |

---

## 14. まとめ

Click Through Demo Builder は、動画からインタラクティブなクリックスルーデモを直感的に作成・共有できるツールである。Fluent UI v9 の角丸・モダンなデザインシステムを全面採用し、デザイナーでの精密な編集操作とプレーヤーでの没入的な体験を両立する。

現行バージョンは Azure 上で動作し、認証・グループ管理・利用ログ収集まで含む実運用構成を備えている。

**次のステップ**: 利用ログの可視化（ランキング/分析画面）と注釈機能の再設計を進める。
