# PainRecorder

慢性疼痛患者が痛みの強さを記録・可視化するための日本語Webアプリです。

## 技術スタック

- **フロントエンド:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts
- **バックエンド:** Next.js API Routes, NextAuth.js v4 (JWT戦略)
- **データベース:** PostgreSQL + Prisma ORM
- **認証:** bcryptjs によるパスワードハッシュ化
- **インフラ:** Docker Compose

## 機能

- ユーザー登録・ログイン
- 痛みの種類をユーザーごとに定義
- 痛みレベル (0〜9) と活動レベル (0〜6) の記録
- 日付範囲フィルター付きグラフ表示
- 記録の削除

## ローカル開発

### 必要なもの

- Docker
- Docker Compose

### セットアップ

1. `.env` ファイルを作成する

```bash
cp .env.example .env
```

`.env` を編集して各値を設定してください。

```
DATABASE_URL=postgresql://painuser:painpass@db:5432/painrecorder
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

2. 起動する

```bash
docker-compose up --build
```

初回起動時に Prisma がスキーマを自動同期します。

3. ブラウザで開く

```
http://localhost:3000
```

### その他のコマンド

```bash
# 停止
docker-compose down

# DB Studio を開く (npm install 後にローカルで実行)
npm run db:studio
```

## 環境変数

| 変数名 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `NEXTAUTH_SECRET` | NextAuth.js の署名・暗号化に使うシークレット |
| `NEXTAUTH_URL` | アプリのベース URL |

## ドメイン仕様

### 痛みレベル

| レベル | 説明 |
|---|---|
| 0 | 痛みなし |
| 1〜3 | 軽度 |
| 4〜6 | 中程度 |
| 7〜9 | 重度 (9: 最大の痛み) |

### 活動レベル

| レベル | 説明 |
|---|---|
| 0 | 寝たきり |
| 1 | リクライニングソファのみ |
| 2 | リクライニングソファ＋立つ |
| 3 | 家の中を動く(四つん這い掃除、立ったまま料理) |
| 4 | 通院(車＋少し歩く) |
| 5 | 杖、松葉杖で外出 |
| 6 | 歩行(外) |

## データベーススキーマ

```
User         ─┬─< PainType
              └─< PainRecord ──< PainLevelEntry >── PainType
```

- `User` — ユーザー (username / passwordHash)
- `PainType` — ユーザー定義の痛みカテゴリ (例: 指の曲がりにくさ)
- `PainRecord` — 1回の記録セッション (activityLevel, comment, recordedAt)
- `PainLevelEntry` — PainRecord と PainType を結ぶ中間テーブル (level 0〜9)
