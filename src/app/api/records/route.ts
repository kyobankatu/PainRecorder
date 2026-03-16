import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') ?? '7d';
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  let startDate: Date | undefined;
  let endDate: Date | undefined;
  const now = new Date();

  if (startDateParam) {
    startDate = new Date(startDateParam);
  } else if (range === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (endDateParam) {
    endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);
  }

  const records = await prisma.painRecord.findMany({
    where: {
      userId: session.user.id,
      recordedAt: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      },
    },
    include: {
      painEntries: {
        include: { painType: true },
      },
    },
    orderBy: { recordedAt: 'asc' },
  });

  const painTypes = await prisma.painType.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ records, painTypes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const { activityLevel, comment, recordedAt, painEntries, temperature, humidity, pressure } = await req.json();

  if (activityLevel === undefined || activityLevel < 0 || activityLevel > 6) {
    return NextResponse.json({ error: '活動量は0〜6で入力してください' }, { status: 400 });
  }
  if (!Array.isArray(painEntries) || painEntries.length === 0) {
    return NextResponse.json({ error: '少なくとも1つの痛みレベルを入力してください' }, { status: 400 });
  }

  const record = await prisma.painRecord.create({
    data: {
      userId: session.user.id,
      activityLevel,
      comment: comment ?? '',
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      temperature: temperature ?? null,
      humidity: humidity ?? null,
      pressure: pressure ?? null,
      painEntries: {
        create: painEntries.map((e: { painTypeId: string; level: number }) => ({
          painTypeId: e.painTypeId,
          level: e.level,
        })),
      },
    },
    include: {
      painEntries: { include: { painType: true } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
