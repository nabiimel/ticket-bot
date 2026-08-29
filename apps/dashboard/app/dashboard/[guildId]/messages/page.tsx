import { db, repos } from "@/lib/db";
import { MessagesEditor } from "@/components/MessagesEditor";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default function MessagesPage({
  params,
}: {
  params: { guildId: string };
}) {
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
