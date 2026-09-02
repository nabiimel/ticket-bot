import { notFound } from "next/navigation";
import { requireGuildAccess } from "@/lib/guild-access";
import { db, repos } from "@/lib/db";
import { SnippetEditor } from "@/components/SnippetEditor";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function SnippetEditPage({
  params,
}: {
  params: { guildId: string; snippetId: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "editor");
  const snippet = repos.snippets.getSnippet(db(), Number(params.snippetId));
  if (!snippet || snippet.guildId !== guildId) notFound();

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Snippets", href: `/dashboard/${guildId}/snippets` },
          { label: snippet.name },
        ]}
      />
      <h1 className="text-2xl font-bold">{snippet.name}</h1>
      <SnippetEditor guildId={guildId} snippet={snippet} />
    </div>
  );
}
