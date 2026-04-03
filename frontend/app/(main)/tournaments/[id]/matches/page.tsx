import { redirect } from "next/navigation";

export default function MatchesPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/tournaments/${params.id}`);
}
