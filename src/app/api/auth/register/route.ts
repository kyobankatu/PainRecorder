import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_COST = 12;

export async function POST(req: NextRequest) {
  const { username, password, inviteCode } = await req.json();
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';

  if (!process.env.REGISTRATION_INVITE_CODE) {
    return NextResponse.json({ error: '新規登録は現在停止されています' }, { status: 403 });
  }
  if (inviteCode !== process.env.REGISTRATION_INVITE_CODE) {
    return NextResponse.json({ error: '招待コードが正しくありません' }, { status: 403 });
  }
  if (!normalizedUsername || !password) {
    return NextResponse.json({ error: 'ユーザー名とパスワードは必須です' }, { status: 400 });
  }
  if (normalizedUsername.length < 3) {
    return NextResponse.json({ error: 'ユーザー名は3文字以上にしてください' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください` }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: normalizedUsername } });
  if (existing) {
    return NextResponse.json({ error: 'このユーザー名は既に使用されています' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.user.create({ data: { username: normalizedUsername, passwordHash } });

  return NextResponse.json({ id: user.id, username: user.username });
}
