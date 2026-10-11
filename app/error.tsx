"use client";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#F7F9FC] px-6 py-16 text-[#17254A]">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#E5EAF3] bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">This page could not load</h1>
        <p className="mt-3 text-sm text-[#52617A]">
          Your saved information is still available. Try loading this step again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-[#1856D8] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
