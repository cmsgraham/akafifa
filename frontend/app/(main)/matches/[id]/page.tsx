export default function MatchDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Match Detail</h1>
      <p className="text-gray-500 mt-2">Match {params.id} detail and prediction form coming soon</p>
    </main>
  );
}
