'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ACTIVITY_LEVELS } from '@/lib/constants';

interface PainEntry {
    id: string;
    level: number;
    painType: { id: string; name: string };
}

interface PainRecord {
    id: string;
    recordedAt: string;
    activityLevel: number;
    comment: string;
    painEntries: PainEntry[];
}

interface Props {
    initialRecords: PainRecord[];
}

export default function RecordList({ initialRecords }: Props) {
    const [records, setRecords] = useState(initialRecords);

    async function handleDelete(id: string) {
        if (!confirm('この記録を削除しますか？')) { return; }
        const res = await fetch(`/api/records/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setRecords((prev) => prev.filter((r) => r.id !== id));
        }
    }

    if (records.length === 0) {
        return <p className="text-gray-400 text-sm">まだ記録がありません</p>;
    }

    return (
        <div className="space-y-3">
            {records.map((rec) => {
                const activity = ACTIVITY_LEVELS[rec.activityLevel];
                const date = new Date(rec.recordedAt);
                return (
                    <div key={rec.id} className="bg-white rounded-xl shadow-sm p-4">
                        <div className="flex justify-between items-start">
                            <div className="text-sm text-gray-500" suppressHydrationWarning>
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
                        <div className="flex gap-3 mt-3">
                            <Link
                                href={`/record/${rec.id}/edit`}
                                className="text-xs text-blue-500 hover:text-blue-700"
                            >
                                編集
                            </Link>
                            <button
                                onClick={() => handleDelete(rec.id)}
                                className="text-xs text-red-400 hover:text-red-600"
                            >
                                削除
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
