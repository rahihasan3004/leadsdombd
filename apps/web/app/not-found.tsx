import Link from "next/link";
import { Button } from "@fine-leads/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-brand-600">404</p>
        <h1 className="mt-4 text-2xl font-bold text-surface-900">Page not found</h1>
        <p className="mt-2 text-surface-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button asChild variant="outline">
            <Link href="/">Go Home</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}