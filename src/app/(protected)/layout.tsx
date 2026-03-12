import Navigation from '@/components/Navigation';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">{children}</main>
    </div>
  );
}
