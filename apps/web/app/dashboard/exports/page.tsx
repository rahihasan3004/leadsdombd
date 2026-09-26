export default function ExportsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Lead Exports</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Download your exported agent lists.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
        <p className="text-slate-400 dark:text-slate-500">No exports yet. Search for agents and export a list.</p>
      </div>
    </div>
  );
}