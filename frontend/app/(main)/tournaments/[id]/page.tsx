export default function TournamentPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Tournament {params.id}</h1>
      <p className="text-gray-500 mt-2">Tournament overview coming soon</p>
    </main>
  );
}
