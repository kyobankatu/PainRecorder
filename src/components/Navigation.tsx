'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const navItems = [
  { href: '/dashboard', label: 'ホーム' },
  { href: '/record', label: '記録する' },
  { href: '/graph', label: 'グラフ' },
  { href: '/settings', label: '設定' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="container mx-auto px-4 max-w-3xl flex items-center justify-between h-14">
        <span className="font-bold text-gray-800">痛み記録</span>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="ml-2 px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              ログアウト
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
