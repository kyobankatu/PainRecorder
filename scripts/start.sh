#!/bin/sh
set -e

echo "データベーススキーマを同期中..."
npx prisma db push

if [ "$NODE_ENV" = "production" ]; then
    echo "アプリを起動中（本番モード）..."
    exec node .next/standalone/server.js
else
    echo "アプリを起動中（開発モード）..."
    exec npm run dev
fi
