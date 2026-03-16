'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Props {
    latestRecordedAt: string | null;
}

export default function ReminderBanner({ latestRecordedAt }: Props) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const enabled = localStorage.getItem('reminderEnabled') === 'true';
        if (!enabled) { return; }

        const hasRecordedToday = latestRecordedAt !== null &&
            new Date(latestRecordedAt).toDateString() === new Date().toDateString();
        if (hasRecordedToday) { return; }

        const reminderTime = localStorage.getItem('reminderTime') ?? '20:00';
        const [h, m] = reminderTime.split(':').map(Number);
        const now = new Date();
        const isPast = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
        if (!isPast) { return; }

        setShow(true);

        // ブラウザ通知（許可済みの場合、本日1回のみ）
        if (Notification.permission === 'granted') {
            const today = new Date().toDateString();
            const lastNotified = localStorage.getItem('lastNotifiedDate');
            if (lastNotified !== today) {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification('痛み記録リマインダー', {
                        body: 'まだ今日の痛みを記録していません。',
                        icon: '/icon.svg',
                    });
                });
                localStorage.setItem('lastNotifiedDate', today);
            }
        }
    }, [latestRecordedAt]);

    if (!show) { return null; }

    return (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div>
                <p className="text-sm font-medium text-amber-800">まだ今日の記録がありません</p>
                <p className="text-xs text-amber-600 mt-0.5">体調を記録しておきましょう</p>
            </div>
            <div className="flex items-center gap-2">
                <Link
                    href="/record"
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                    記録する
                </Link>
                <button
                    type="button"
                    onClick={() => setShow(false)}
                    className="text-amber-400 hover:text-amber-600 text-lg leading-none"
                >
                    ×
                </button>
            </div>
        </div>
    );
}
