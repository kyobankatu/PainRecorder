#!/bin/sh
set -e

echo "Prismaクライアントを生成中..."
npx prisma generate

echo "データベーススキーマを同期中..."
npx prisma db push

echo "アプリを起動中..."
exec npm run dev
