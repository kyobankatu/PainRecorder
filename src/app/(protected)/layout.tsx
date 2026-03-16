import Navigation from '@/components/Navigation';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl pb-24 md:pb-6">{children}</main>
      <footer className="hidden md:block text-center py-3 text-xs text-gray-300 border-t border-gray-100">
        © {new Date().getFullYear()} PainRecorder — 個人利用専用・商業目的での利用・紹介禁止
      </footer>
    </div>
  );
}
