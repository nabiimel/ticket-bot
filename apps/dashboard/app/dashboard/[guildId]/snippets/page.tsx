import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { SnippetCreateForm } from "@/components/SnippetCreateForm";
import { SnippetList } from "@/components/SnippetList";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function SnippetsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "editor");
  const snippets = repos.snippets.listSnippets(db(), guildId);

  return (
    <div className="page max-w-2xl">
      <PageHeader
        title="Snippets"
        description="Canned replies staff post into a ticket with /snippet. Text supports the same {tokens} as messages, plus optional images."
      />
      <SnippetCreateForm guildId={guildId} />
      <SnippetList guildId={guildId} initial={snippets} />
    </div>
  );
}
