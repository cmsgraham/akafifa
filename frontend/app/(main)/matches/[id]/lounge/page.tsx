"use client";

import Link from "next/link";

export default function LoungePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">💬 Match Lounge</h1>
        <Link
          href={`/matches/${params.id}`}
          className="text-sm text-green-600 hover:underline"
        >
          ← Back to match
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center">
        <p className="text-4xl mb-4">🏟️</p>
        <p className="text-lg text-gray-500 mb-2">Match Lounge</p>
        <p className="text-sm text-gray-400">
          The real-time comment stream for this match will be available here during live games.
        </p>
      </div>
    </div>
  );
}
