import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  const painTypes = await prisma.painType.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(painTypes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: '痛みの種類名を入力してください' }, { status: 400 });
  }
  try {
    const painType = await prisma.painType.create({
      data: { userId: session.user.id, name: name.trim() },
    });
    return NextResponse.json(painType, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'この名前は既に登録されています' }, { status: 400 });
  }
}
