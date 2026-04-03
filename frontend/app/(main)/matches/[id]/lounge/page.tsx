export default function LoungePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Match Lounge</h1>
      <p className="text-gray-500 mt-2">Comments for match {params.id} coming soon</p>
    </main>
  );
}
