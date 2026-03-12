import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { memo: true },
    });

    return NextResponse.json({ memo: user?.memo ?? '' });
}

export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { memo } = await req.json();
    if (typeof memo !== 'string') {
        return NextResponse.json({ error: '無効な入力です' }, { status: 400 });
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data: { memo },
    });

    return NextResponse.json({ ok: true });
}
