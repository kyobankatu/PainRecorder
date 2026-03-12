import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ACTIVITY_LEVELS } from '@/lib/constants';

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
        {records.length === 0 ? (
          <p className="text-gray-400 text-sm">まだ記録がありません</p>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => {
              const activity = ACTIVITY_LEVELS[rec.activityLevel];
              const date = new Date(rec.recordedAt);
              return (
                <div key={rec.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-start">
                    <div className="text-sm text-gray-500">
                      {date.getFullYear()}/{date.getMonth() + 1}/{date.getDate()}{' '}
                      {String(date.getHours()).padStart(2, '0')}:
                      {String(date.getMinutes()).padStart(2, '0')}
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      活動量 {rec.activityLevel}: {activity?.label}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rec.painEntries.map((entry) => (
                      <span
                        key={entry.id}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg"
                      >
                        {entry.painType.name}: <strong>{entry.level}</strong>
                      </span>
                    ))}
                  </div>
                  {rec.comment && (
                    <p className="text-sm text-gray-500 mt-2 italic">"{rec.comment}"</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
