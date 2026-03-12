import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import RecordList from '@/components/RecordList';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/');

  const records = await prisma.painRecord.findMany({
    where: { userId: session.user.id },
    include: { painEntries: { include: { painType: true } } },
    orderBy: { recordedAt: 'desc' },
    take: 10,
  });

  const totalRecords = await prisma.painRecord.count({ where: { userId: session.user.id } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          こんにちは、{session.user.name}さん
        </h1>
        <p className="text-gray-500 text-sm mt-1">合計 {totalRecords} 件の記録</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/record"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl p-5 text-center transition-colors"
        >
          <span className="text-3xl">📝</span>
          <p className="font-semibold mt-2">今の状態を記録</p>
        </Link>
        <Link
          href="/graph"
          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl p-5 text-center transition-colors"
        >
          <span className="text-3xl">📈</span>
          <p className="font-semibold mt-2">グラフを見る</p>
        </Link>
      </div>

      <div>
        <h2 className="font-semibold text-gray-700 mb-3">最近の記録</h2>
        <RecordList
          initialRecords={records.map((rec) => ({
            ...rec,
            recordedAt: rec.recordedAt.toISOString(),
            painEntries: rec.painEntries.map((e) => ({
              id: e.id,
              level: e.level,
              painType: e.painType,
            })),
          }))}
        />
      </div>
    </div>
  );
}
