"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-surface-900">Something went wrong</h1>
            <p className="mt-4 text-surface-500">
              A critical error occurred. Our team has been notified.
            </p>
            <button
              onClick={reset}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand-600 px-6 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}