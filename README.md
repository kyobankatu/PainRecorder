# PainRecorder

慢性疼痛患者が痛みの強さを記録・可視化するための日本語Webアプリです。

> **利用規約:** 本サービスは個人利用専用です。医療機関・事業者による患者・第三者への紹介・案内・転用など、商業目的・業務目的での利用は禁止しています。

## 技術スタック

- **フロントエンド:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts
- **バックエンド:** Next.js API Routes, NextAuth.js v4 (JWT戦略)
- **データベース:** PostgreSQL 16 + Prisma ORM
- **認証:** bcryptjs によるパスワードハッシュ化
- **インフラ:** Docker Compose (開発) / Google Cloud Run (本番)
- **PWA:** Web App Manifest + Service Worker

## 機能

### 記録
- ユーザー登録・ログイン
- 痛みの種類をユーザーごとに定義・管理
- 痛みレベル (0〜9) と活動量 (0〜6) の記録
- 気象データ（気温・湿度・気圧）の自動取得または手動入力（項目ごとに選択可能）
- 前回の記録をコピーしてすばやく入力
- メモ機能（症状に関する自由記述）

### グラフ・分析
- 今日 / 7日間 / 30日間 / 全期間 / 期間指定 でのフィルター
- 痛みレベル・活動量グラフ（複合グラフ）
- 気温・湿度グラフ（独立スケール）
- 気圧グラフ
- 傾向レポート（折りたたみ表示）
  - 期間サマリー（総記録数・記録日数・平均記録/日）
  - 痛みタイプ別統計（平均・最小・最大・件数）
  - 最も痛みが強かった日 / 最も楽だった日
  - 痛みタイプ別推移（日別平均に対する線形回帰：傾き・R²）
  - 活動量の分布
  - 活動量との相関（ピアソン相関係数）
  - 気象との相関（気温・湿度・気圧）

### エクスポート・印刷
- CSV ダウンロード（統計サマリー + 記録一覧）
- 印刷・PDF 保存（グラフ・統計・記録一覧を含む横向きレイアウト）

### その他
- PWA 対応（ホーム画面に追加可能）
- 記録リマインダー通知（時刻設定・ブラウザ通知）
- モバイルフレンドリーなUI（ボトムナビゲーション）
- 記録の編集・削除

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

# 依存関係変更後に再ビルド
docker-compose up --build

# DB Studio を開く (npm install 後にローカルで実行)
npm run db:studio
```

### スマートフォンでのローカル確認

同じ Wi-Fi ネットワーク上であれば、PCのローカルIPアドレス（例: `http://192.168.x.x:3000`）でスマートフォンからアクセスできます。

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

### 活動量

| レベル | 説明 |
|---|---|
| 0 | 寝たきり |
| 1 | リクライニングソファのみ |
| 2 | リクライニングソファ＋立つ |
| 3 | 家の中を動く（四つん這い掃除、立ったまま料理） |
| 4 | 通院（車＋少し歩く） |
| 5 | 杖、松葉杖で外出 |
| 6 | 歩行（外） |

## データベーススキーマ

```
User ─┬─< PainType
      └─< PainRecord ──< PainLevelEntry >── PainType
```

- `User` — ユーザー (username / passwordHash)
- `PainType` — ユーザー定義の痛みカテゴリ（例: 指の曲がりにくさ）
- `PainRecord` — 1回の記録セッション (activityLevel, comment, recordedAt, temperature, humidity, pressure)
- `PainLevelEntry` — PainRecord と PainType を結ぶ中間テーブル (level 0〜9)

## アーキテクチャ

```
src/
├── app/
│   ├── page.tsx                    # ログイン・新規登録
│   ├── layout.tsx                  # ルートレイアウト（PWAメタデータ）
│   ├── (protected)/                # 認証必須ページ
│   │   ├── dashboard/              # ダッシュボード
│   │   ├── record/                 # 記録入力・編集
│   │   ├── graph/                  # グラフ・分析
│   │   ├── memo/                   # メモ
│   │   └── settings/               # 設定
│   ├── (print)/
│   │   └── print-preview/          # 印刷・PDF プレビュー
│   └── api/
│       ├── auth/                   # 認証 (NextAuth + 登録)
│       ├── pain-types/             # 痛みタイプ CRUD
│       └── records/                # 記録 CRUD + latest
├── components/
│   ├── PainGraph.tsx               # グラフ・分析・CSV出力
│   ├── RecordForm.tsx              # 記録フォーム（気象取得含む）
│   ├── RecordList.tsx              # 記録一覧・削除
│   ├── Navigation.tsx              # ナビゲーション（PC上部・SP下部）
│   ├── ReminderBanner.tsx          # リマインダーバナー
│   ├── SessionWrapper.tsx          # NextAuth SessionProvider
│   └── ServiceWorkerRegistrar.tsx  # Service Worker 登録
├── lib/
│   ├── auth.ts                     # NextAuth 設定
│   ├── prisma.ts                   # Prisma クライアント
│   └── constants.ts                # 活動量ラベル・グラフ色
public/
├── sw.js                           # Service Worker
├── manifest.json                   # PWA マニフェスト
└── icon.svg                        # アプリアイコン
```

## © ライセンス・利用規約

© 2025 PainRecorder

本ソフトウェアおよびサービスは、個人が自身の症状管理のために提供しています。以下の利用を禁止します。

- 医療機関・事業者・第三者による患者への紹介・案内・推奨
- 商業目的・業務目的での利用・転用・再配布
- サービスを営利目的で利用するあらゆる行為
