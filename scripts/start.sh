#!/bin/sh
set -e

if [ "$NODE_ENV" = "production" ]; then
    echo "アプリを起動中（本番モード）..."
    exec node .next/standalone/server.js
else
    echo "データベーススキーマを同期中..."
    npx prisma db push
    echo "アプリを起動中（開発モード）..."
    exec npm run dev
fi
