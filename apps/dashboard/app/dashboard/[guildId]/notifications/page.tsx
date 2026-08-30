import { auth } from "@/auth";
import { getNotificationFeed } from "@/lib/notifications";
import { PageHeader } from "@/components/PageHeader";
import { NotificationList } from "@/components/NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  const session = await auth();
  const userId = session?.user?.discordId ?? "";
  const { items } = getNotificationFeed(guildId, userId, 100);

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        description="Stale tickets, low ratings, failed tasks and config changes — newest first."
      />
      <NotificationList guildId={guildId} items={items} />
    </div>
  );
}
