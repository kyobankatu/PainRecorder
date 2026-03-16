import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const record = await prisma.painRecord.findFirst({
        where: { userId: session.user.id },
        orderBy: { recordedAt: 'desc' },
        include: { painEntries: { include: { painType: true } } },
    });

    return NextResponse.json(record);
}
