# Click Through Demo Builder — 設計書 v2

> **⚠️ このドキュメントは v2 設計提案書です（未実装の機能を含みます）**
> いいね、コメント、お気に入り、フィード等のソーシャル機能は現バージョンでは実装されていません。
> 現在の実装仕様については [DESIGN.md](../DESIGN.md) を参照してください。

---
## 1. 権限モデル

### 1.1 ロール定義

| ロール | 付与タイミング | 説明 |
|--------|--------------|------|
| `viewer` | アカウント作成時に自動付与 | すべてのデモの閲覧・実行が可能 |
| `designer` | 管理者による承認後に付与 | 自分が作成したデモの編集・削除が可能 |

### 1.2 権限マトリクス

| 操作 | viewer | designer |
|------|--------|----------|
| デモ一覧・閲覧 | ✅ | ✅ |
| デモ再生 | ✅ | ✅ |
| デモに「いいね」 | ✅ | ✅ |
| デモにコメント | ✅ | ✅ |
| デモをお気に入り保存 | ✅ | ✅ |
| 自分のプロフィール編集 | ✅ | ✅ |
| **自分のデモ** 作成 | ❌ | ✅ |
| **自分のデモ** 編集・削除 | ❌ | ✅ |
| **他人のデモ** 編集・削除 | ❌ | ❌ |
| デザイナー申請 | ✅ (viewer のみ) | — |

---

## 2. デザイナー権限申請フロー

### 2.1 申請（ユーザー側）

1. ヘッダーのプロフィールメニューから「デザイナー権限を申請」をクリック
2. 申請フォームで申請理由を入力して送信
3. 送信後「審査中」ステータスが表示される

### 2.2 通知（システム側）

- 申請内容をメール通知先（環境変数 `APPROVAL_EMAIL` に設定、Web 上には非公開）へ送信
- メール内容：
  - 申請者名・メールアドレス
  - 申請理由
  - 承認用リンク: `POST /api/creators/{id}/verify` をトリガーする管理用 URL

### 2.3 承認（管理者側）

- 管理者がメール内の「承認リンク」をクリック
- API `POST /api/creators/{id}/verify` にて当該ユーザーのロールを `designer` に昇格
- 申請者へ「デザイナー権限が付与されました」のメール通知

### 2.4 実装詳細

```
環境変数 (App Settings):
  APPROVAL_EMAIL=<管理者メールアドレス> ← Web・コードに公開しない
  APPROVAL_SECRET=<承認リンク用署名シークレット>
```

承認リンク形式:
```
https://<domain>/api/creators/{creatorId}/verify?token=<HMAC-signed-token>
```

---

## 3. ナビゲーション構成

### 3.1 ヘッダーメニュー

```
[ロゴ]  ホーム  デモ  フィード  お気に入り        [検索] [通知] [プロフィール▼]
```

| メニュー | パス | 説明 |
|----------|------|------|
| ホーム | `/` | ランキング・更新情報ダッシュボード |
| デモ | `/projects` | デモ一覧・作成 (旧「プロジェクト」) |
| フィード | `/feed` | ソーシャルアクティビティフィード |
| お気に入り | `/favorites` | お気に入りデモ管理 |

> **注**: 旧「プロジェクト」メニューは「デモ」に変更する。

### 3.2 プロフィールドロップダウン

- マイプロフィール → `/profile`
- デザイナー権限を申請 → `/apply-designer` (viewer のみ表示)
- ログアウト

---

## 4. 画面定義

### 4.1 ホーム画面 (`/`)

ログイン後のデフォルト画面。以下のセクションを表示する。

| セクション | 表示内容 | ソート基準 |
|-----------|---------|-----------|
| 人気のデモ 🏆 | いいね数が多いデモ | `likeCount` DESC |
| 最近追加されたデモ 🆕 | 新着デモ | `createdAt` DESC |
| 再生数が多いデモ ▶️ | よく再生されるデモ | `playCount` DESC |
| 最近のコメント 💬 | 最新コメントとそのデモ | `createdAt` DESC |
| 総再生時間が長いデモ ⏱️ | 累計再生時間の長いデモ | `totalPlayDuration` DESC |
| 人気のデモ作成者 ⭐ | いいね合計が多い作成者 | `totalLikes` DESC |
| デモ数が多い作成者 📦 | 作成デモ数が多い作成者 | `demoCount` DESC |

### 4.2 フィード画面 (`/feed`)

タイムライン形式で以下のアクティビティを表示する。

- 誰かがデモに「いいね」をつけた
- 誰かがデモにコメントをつけた
- 新しいデモが登録された
- 誰かがデザイナーになった

フィードエントリのフォーマット:
```
[アバター] [ユーザー名] が [デモ名] に いいね/コメントしました   [時刻]
           [デモのサムネイル + 名前]
```

### 4.3 お気に入り画面 (`/favorites`)

タブ構成:

| タブ | 内容 |
|------|------|
| 保存済み | 自分がお気に入り登録したデモ |
| 人気 | いいね数Top デモ（全ユーザー共通） |

### 4.4 デモ一覧画面 (`/projects` → 表示名「デモ」)

- 全デモを表示
- designer は「新規作成」ボタンを表示
- 各カードに「いいね」「お気に入り」ボタン
- 自分のデモカードのみ「編集」「削除」ボタンを表示

### 4.5 デザイナー申請画面 (`/apply-designer`)

- viewer ロールのみアクセス可
- フォーム:
  - 申請理由（テキストエリア、必須）
- 送信後: 「申請を受け付けました。承認されるとメールでお知らせします。」

---

## 5. データモデル追加項目

### 5.1 Demo (Project) に追加

```typescript
interface Demo {
  // 既存フィールド
  id: string;
  title: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;

  // 新規追加
  likeCount: number;           // いいね数
  playCount: number;           // 再生回数
  totalPlayDuration: number;   // 累計再生時間(秒)
  commentCount: number;        // コメント数
}
```

### 5.2 Like（いいね）

```typescript
interface Like {
  id: string;
  demoId: string;
  creatorId: string;
  createdAt: string;
}
```

### 5.3 Comment（コメント）

```typescript
interface Comment {
  id: string;
  demoId: string;
  creatorId: string;
  creatorName: string;
  body: string;
  createdAt: string;
}
```

### 5.4 Favorite（お気に入り）

```typescript
interface Favorite {
  id: string;
  demoId: string;
  creatorId: string;
  createdAt: string;
}
```

### 5.5 FeedEntry（フィード）

```typescript
type FeedEventType = 'like' | 'comment' | 'new_demo' | 'new_designer';

interface FeedEntry {
  id: string;
  eventType: FeedEventType;
  actorId: string;       // 誰が
  actorName: string;
  demoId?: string;       // 対象デモ
  demoTitle?: string;
  commentBody?: string;  // コメント内容(eventType=comment 時)
  createdAt: string;
}
```

### 5.6 Creator に追加

```typescript
interface DemoCreator {
  // 既存フィールド
  id: string;
  name: string;
  email: string;
  role: 'viewer' | 'designer';
  language: 'ja' | 'en';
  groupId?: string;

  // 新規追加
  designerApplicationStatus?: 'pending' | 'approved' | 'rejected';
  designerApplicationReason?: string;
  designerApplicationDate?: string;
  bio?: string;          // 自己紹介
  avatarUrl?: string;    // アバター画像URL
}
```

---

## 6. API エンドポイント追加

### 6.1 いいね

| Method | Path | 説明 | 権限 |
|--------|------|------|------|
| POST | `/api/demos/{id}/like` | いいね追加 | viewer+ |
| DELETE | `/api/demos/{id}/like` | いいね取り消し | viewer+ |

### 6.2 コメント

| Method | Path | 説明 | 権限 |
|--------|------|------|------|
| GET | `/api/demos/{id}/comments` | コメント一覧 | viewer+ |
| POST | `/api/demos/{id}/comments` | コメント追加 | viewer+ |
| DELETE | `/api/demos/{id}/comments/{commentId}` | コメント削除（自分のみ） | viewer+ |

### 6.3 お気に入り

| Method | Path | 説明 | 権限 |
|--------|------|------|------|
| GET | `/api/favorites` | お気に入り一覧（自分） | viewer+ |
| POST | `/api/favorites` | お気に入り追加 `{demoId}` | viewer+ |
| DELETE | `/api/favorites/{demoId}` | お気に入り削除 | viewer+ |

### 6.4 フィード

| Method | Path | 説明 | 権限 |
|--------|------|------|------|
| GET | `/api/feed` | フィード一覧 `?limit=20&before=<cursor>` | viewer+ |

### 6.5 ホーム（ランキング）

| Method | Path | 説明 | 権限 |
|--------|------|------|------|
| GET | `/api/home/rankings` | ホーム画面用ランキングデータ | viewer+ |

### 6.6 デザイナー申請

| Method | Path | 説明 | 権限 |
|--------|------|------|------|
| POST | `/api/auth/apply-designer` | デザイナー権限申請 `{reason}` | viewer |
| POST | `/api/creators/{id}/verify?token=` | 承認処理（管理者用リンク） | token検証 |

---

## 7. セキュリティ

### 7.1 承認メールアドレスの秘匿

- 管理者メールアドレスは `APPROVAL_EMAIL` 環境変数にのみ保存
- コードに直接記述しない
- API レスポンスに含めない
- フロントエンドのバンドルに含めない

### 7.2 承認リンクの改ざん防止

- 承認リンクには HMAC-SHA256 署名付きトークンを使用
- トークン形式: `base64url(creatorId + ':' + expiry + ':' + hmac)`
- 有効期限: 7日間
- 使い捨て（承認後は無効化）

---

## 8. 実装優先度

| フェーズ | 対象 | 優先度 |
|---------|------|--------|
| P0 | デザイナー申請・承認フロー | 最高 |
| P0 | ナビゲーション変更（プロジェクト→デモ、ホーム・フィード・お気に入り追加） | 最高 |
| P1 | いいね機能 | 高 |
| P1 | お気に入り機能 | 高 |
| P1 | ホーム画面ランキング | 高 |
| P2 | コメント機能 | 中 |
| P2 | フィード画面 | 中 |
| P3 | 再生数・再生時間トラッキング | 低 |
