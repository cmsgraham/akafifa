"use client";

import Link from "next/link";

export default function AdminChallengesPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Flash Challenge Management</h1>
        <Link href="/admin" className="text-sm text-green-600 hover:underline">← Admin</Link>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center text-gray-500">
        <p className="text-4xl mb-4">⚡</p>
        <p>Challenge management interface coming soon.</p>
      </div>
    </div>
  );
}
