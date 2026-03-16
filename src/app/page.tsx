'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? '登録に失敗しました');
          return;
        }
      }

      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('ユーザー名またはパスワードが正しくありません');
      } else {
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">痛み記録</h1>
        <p className="text-center text-gray-500 text-sm mb-6">慢性疼痛トラッカー</p>

        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            ログイン
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ユーザー名を入力"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="パスワードを入力"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>
      </div>

      <div className="w-full max-w-sm text-center space-y-1">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} PainRecorder — 個人利用専用サービス
        </p>
        <p className="text-xs text-gray-400">
          本サービスは個人が自身の症状管理のために無償で提供しています。<br />
          医療機関・事業者による患者・第三者への紹介・案内・転用など、<br />
          商業目的・業務目的での利用は禁止しています。
        </p>
      </div>
    </div>
  );
}
