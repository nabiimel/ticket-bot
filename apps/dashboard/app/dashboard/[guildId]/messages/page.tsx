import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { MessagesEditor } from "@/components/MessagesEditor";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  params,
}: {
  params: { guildId: string };
}) {
  await requireGuildAccess(params.guildId, "editor");
  const cfg = repos.guildConfig.ensureGuildConfig(db(), params.guildId);
  return (
    <div className="page">
      <PageHeader
        title="Messages"
        description="Server-wide embeds. Categories can override the welcome embed individually."
      />
      <MessagesEditor
        guildId={params.guildId}
        welcome={cfg.welcomeEmbed}
        close={cfg.closeEmbed}
        feedback={cfg.feedbackPromptEmbed}
      />
    </div>
  );
}
