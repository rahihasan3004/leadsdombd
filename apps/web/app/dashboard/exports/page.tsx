export default function ExportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lead Exports</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Download your exported agent lists.
        </p>
      </div>
      <div className="rounded-xl border-0 bg-slate-50 p-12 text-center dark:bg-slate-900 shadow-none">
        <p className="text-slate-400 dark:text-slate-500">No exports yet. Search for agents and export a list.</p>
      </div>
    </div>
  );
}