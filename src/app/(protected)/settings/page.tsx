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

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    setReminderEnabled(localStorage.getItem('reminderEnabled') === 'true');
    setReminderTime(localStorage.getItem('reminderTime') ?? '20:00');
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

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

      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">記録リマインダー</h2>

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700">リマインダーを有効にする</label>
          <button
            type="button"
            onClick={() => {
              const next = !reminderEnabled;
              setReminderEnabled(next);
              localStorage.setItem('reminderEnabled', String(next));
            }}
            className={`w-11 h-6 rounded-full transition-colors relative ${reminderEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform ${reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {reminderEnabled && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">通知時刻</label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => {
                setReminderTime(e.target.value);
                localStorage.setItem('reminderTime', e.target.value);
              }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {reminderEnabled && notifPermission !== 'granted' && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              {notifPermission === 'denied'
                ? 'ブラウザの設定で通知を許可してください'
                : '通知を受け取るには許可が必要です'}
            </p>
            {notifPermission !== 'denied' && (
              <button
                type="button"
                onClick={() => {
                  Notification.requestPermission().then((p) => setNotifPermission(p));
                }}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
              >
                通知を許可する
              </button>
            )}
          </div>
        )}

        {reminderEnabled && notifPermission === 'granted' && (
          <p className="text-xs text-green-600">通知が有効です</p>
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
