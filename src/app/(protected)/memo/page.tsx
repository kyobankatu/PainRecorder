'use client';

import { useState, useEffect } from 'react';

export default function MemoPage() {
    const [memo, setMemo] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/memo')
            .then((r) => r.json())
            .then(({ memo: m }: { memo: string }) => {
                setMemo(m);
            })
            .finally(() => setLoading(false));
    }, []);

    async function handleSave() {
        setSaving(true);
        setSaved(false);
        await fetch('/api/memo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memo }),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold text-gray-800">症状メモ</h1>
            <p className="text-sm text-gray-500">
                症状の特徴や経過など、記録に残しておきたい情報を自由に書いてください。
            </p>
            {loading ? (
                <div className="h-48 flex items-center justify-center text-gray-400">読み込み中...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={12}
                        placeholder="例：朝起きた直後に痛みが強くなる傾向がある。雨の日は特に指の曲がりにくさが増す..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
                        >
                            {saving ? '保存中...' : '保存する'}
                        </button>
                        {saved && (
                            <span className="text-green-600 text-sm font-medium">保存しました</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
