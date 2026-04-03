export default function MatchesPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Matches</h1>
      <p className="text-gray-500 mt-2">Match list for tournament {params.id} coming soon</p>
    </main>
  );
}
