'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PainLevelPicker from './PainLevelPicker';
import ActivityPicker from './ActivityPicker';

interface PainType {
  id: string;
  name: string;
}

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function RecordForm() {
  const router = useRouter();
  const [painTypes, setPainTypes] = useState<PainType[]>([]);
  const [activityLevel, setActivityLevel] = useState(3);
  const [painLevels, setPainLevels] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [recordedAt, setRecordedAt] = useState(toLocalDateTimeString(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/pain-types')
      .then((r) => r.json())
      .then((data: PainType[]) => {
        setPainTypes(data);
        const initial: Record<string, number> = {};
        data.forEach((pt) => { initial[pt.id] = 0; });
        setPainLevels(initial);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const painEntries = Object.entries(painLevels).map(([painTypeId, level]) => ({
      painTypeId,
      level,
    }));

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityLevel, comment, recordedAt, painEntries }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? '記録に失敗しました');
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        router.push('/dashboard');
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  }

  if (painTypes.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <p className="text-yellow-800 font-medium">痛みの種類が登録されていません</p>
        <p className="text-yellow-600 text-sm mt-1">
          設定ページで痛みの種類を追加してください
        </p>
        <a
          href="/settings"
          className="mt-4 inline-block bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          設定へ
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">記録日時</label>
          <input
            type="datetime-local"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <ActivityPicker value={activityLevel} onChange={setActivityLevel} />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 space-y-5">
        <h2 className="font-semibold text-gray-800">痛みレベル</h2>
        {painTypes.map((pt) => (
          <PainLevelPicker
            key={pt.id}
            label={pt.name}
            value={painLevels[pt.id] ?? 0}
            onChange={(v) => setPainLevels((prev) => ({ ...prev, [pt.id]: v }))}
          />
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">コメント（任意）</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="体調や状況のメモ..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && (
        <p className="text-green-600 text-sm font-medium">記録しました！</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors text-lg"
      >
        {submitting ? '記録中...' : '記録する'}
      </button>
    </form>
  );
}
