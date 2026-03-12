import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
