'use client';

import { useState, useEffect } from 'react';
import { ACTIVITY_LEVELS } from '@/lib/constants';

interface PainType {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [painTypes, setPainTypes] = useState<PainType[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchPainTypes() {
    const res = await fetch('/api/pain-types');
    const data = await res.json();
    setPainTypes(data);
  }

  useEffect(() => { fetchPainTypes(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/pain-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? '追加に失敗しました');
        return;
      }
      setNewName('');
      await fetchPainTypes();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('この痛みの種類を削除しますか？関連する記録データも削除されます。')) return;
    await fetch(`/api/pain-types/${id}`, { method: 'DELETE' });
    await fetchPainTypes();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">設定</h1>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4">痛みの種類を管理</h2>

        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例: 指の曲がりにくさ"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            追加
          </button>
        </form>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {painTypes.length === 0 ? (
          <p className="text-gray-400 text-sm">
            痛みの種類がまだ登録されていません。上のフォームから追加してください。
          </p>
        ) : (
          <ul className="space-y-2">
            {painTypes.map((pt) => (
              <li
                key={pt.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <span className="text-gray-800">{pt.name}</span>
                <button
                  onClick={() => handleDelete(pt.id)}
                  className="text-red-400 hover:text-red-600 text-sm transition-colors"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-2">活動量の目安</h2>
        <div className="space-y-1 text-sm text-gray-600">
          {ACTIVITY_LEVELS.map((a) => (
            <div key={a.value} className="flex gap-3">
              <span className="font-mono font-bold text-blue-500 w-4">{a.value}</span>
              <span>{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
