export default function ValidationsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Validations</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Email and phone verification results for your leads.
        </p>
      </div>
      <div className="rounded-xl border-0 bg-slate-50 p-12 text-center dark:bg-slate-900 shadow-none">
        <p className="text-slate-400 dark:text-slate-500">No validations run yet. Purchase a state pack to verify leads.</p>
      </div>
    </div>
  );
}