import Link from "next/link";
import { notFound } from "next/navigation";
import { db, repos } from "@/lib/db";
import { SnippetEditor } from "@/components/SnippetEditor";

export const dynamic = "force-dynamic";

export default function SnippetEditPage({
  params,
}: {
  params: { guildId: string; snippetId: string };
}) {
  const { guildId } = params;
  const snippet = repos.snippets.getSnippet(db(), Number(params.snippetId));
  if (!snippet || snippet.guildId !== guildId) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/dashboard/${guildId}/snippets`}
        className="text-xs text-faint hover:text-dim"
      >
        ← Snippets
      </Link>
      <h1 className="text-2xl font-bold">{snippet.name}</h1>
      <SnippetEditor guildId={guildId} snippet={snippet} />
    </div>
  );
}
