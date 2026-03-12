import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const record = await prisma.painRecord.findUnique({ where: { id: params.id } });
    if (!record || record.userId !== session.user.id) {
        return NextResponse.json({ error: '見つかりません' }, { status: 404 });
    }

    const { activityLevel, comment, recordedAt, painEntries } = await req.json();

    if (activityLevel === undefined || activityLevel < 0 || 6 < activityLevel) {
        return NextResponse.json({ error: '活動量は0〜6で入力してください' }, { status: 400 });
    }
    if (!Array.isArray(painEntries) || painEntries.length === 0) {
        return NextResponse.json({ error: '少なくとも1つの痛みレベルを入力してください' }, { status: 400 });
    }

    await prisma.painLevelEntry.deleteMany({ where: { recordId: params.id } });

    const updated = await prisma.painRecord.update({
        where: { id: params.id },
        data: {
            activityLevel,
            comment: comment ?? '',
            recordedAt: recordedAt ? new Date(recordedAt) : record.recordedAt,
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

    return NextResponse.json(updated);
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }
    const record = await prisma.painRecord.findUnique({ where: { id: params.id } });
    if (!record || record.userId !== session.user.id) {
        return NextResponse.json({ error: '見つかりません' }, { status: 404 });
    }
    await prisma.painRecord.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
}
