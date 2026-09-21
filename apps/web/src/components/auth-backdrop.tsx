export function AuthBackdrop() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] dark:opacity-[0.03] select-none">
        <div className="mx-auto flex h-full max-w-7xl">
          <div className="flex w-52 flex-col gap-2 border-r border-slate-400 p-5 dark:border-slate-600">
            <div className="mb-1 h-4 w-20 rounded-sm bg-slate-900 dark:bg-white" />
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="h-3 rounded-sm bg-slate-900 dark:bg-white"
                style={{ width: `${60 + Math.random() * 35}%`, opacity: i === 0 ? 0.9 : 0.25 }}
              />
            ))}
          </div>

          <div className="flex flex-1 flex-col p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="h-5 w-36 rounded-sm bg-slate-900 dark:bg-white" />
                <div className="mt-1 h-3 w-24 rounded-sm bg-slate-900 dark:bg-white" style={{ opacity: 0.35 }} />
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-20 rounded-md border border-slate-400 dark:border-slate-600" />
                <div className="h-8 w-20 rounded-md border border-slate-400 dark:border-slate-600" />
                <div className="h-8 w-16 rounded-md bg-slate-900 dark:bg-white" style={{ opacity: 0.7 }} />
              </div>
            </div>

            <div className="mb-5 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-slate-400 p-3 dark:border-slate-600">
                  <div className="mb-1.5 h-3 w-14 rounded-sm bg-slate-900 dark:bg-white" style={{ opacity: 0.35 }} />
                  <div className="h-6 w-16 rounded-sm bg-slate-900 dark:bg-white" />
                  <div className="mt-1 h-3 w-20 rounded-sm bg-slate-900 dark:bg-white" style={{ opacity: 0.25 }} />
                </div>
              ))}
            </div>

            <div className="mb-4 flex gap-3">
              <div className="h-8 w-20 rounded-md bg-slate-900 dark:bg-white" style={{ opacity: 0.55 }} />
              <div className="h-8 w-20 rounded-md border border-slate-400 dark:border-slate-600" />
              <div className="h-8 w-20 rounded-md border border-slate-400 dark:border-slate-600" />
            </div>

            <div className="flex-1 rounded-lg border border-slate-400 dark:border-slate-600">
              <div className="border-b border-slate-400 p-2.5 dark:border-slate-600">
                <div className="flex gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-3 rounded-sm bg-slate-900 dark:bg-white"
                      style={{ opacity: 0.35, width: `${50 + Math.random() * 40}px` }}
                    />
                  ))}
                </div>
              </div>
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-6 border-b border-slate-400 px-2.5 py-2 dark:border-slate-600"
                  style={{ opacity: 0.15 + (i === 0 ? 0.1 : 0) }}
                >
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-3 rounded-sm bg-slate-900 dark:bg-white"
                      style={{ width: `${35 + Math.random() * 70}px` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="fixed inset-0 bg-black/20 dark:bg-black/50" />
    </>
  );
}