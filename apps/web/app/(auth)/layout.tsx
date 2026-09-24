export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full bg-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[400px]">
        {children}
      </div>
    </main>
  );
}
