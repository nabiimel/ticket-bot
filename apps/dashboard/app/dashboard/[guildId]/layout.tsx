import Link from "next/link";
import { cookies } from "next/headers";
import { levelAtLeast, type DashboardLevel } from "@ticketbot/shared";
import { auth, signOut } from "@/auth";
import { requireGuildAccess } from "@/lib/guild-access";
import { db, repos } from "@/lib/db";
import { getNotificationFeed } from "@/lib/notifications";
import { Icon } from "@/components/icons";
import { SideNav, type NavItem } from "@/components/SideNav";
import { MobileNav } from "@/components/MobileNav";
import { NotificationBell } from "@/components/NotificationBell";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavigationGuard } from "@/components/NavigationGuard";

export const dynamic = "force-dynamic";

const NAV: {
  href: string;
  label: string;
  icon: JSX.Element;
  min: DashboardLevel;
}[] = [
  { href: "", label: "Overview", icon: Icon.overview, min: "console" },
  { href: "/tickets", label: "Tickets", icon: Icon.tickets, min: "console" },
  {
    href: "/applications",
    label: "Applications",
    icon: Icon.applications,
    min: "console",
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: Icon.bell,
    min: "console",
  },
  { href: "/general", label: "General", icon: Icon.general, min: "editor" },
  {
    href: "/categories",
    label: "Categories",
    icon: Icon.categories,
    min: "editor",
  },
  { href: "/panels", label: "Panels", icon: Icon.panels, min: "editor" },
  { href: "/messages", label: "Messages", icon: Icon.messages, min: "editor" },
  { href: "/snippets", label: "Snippets", icon: Icon.snippets, min: "editor" },
  {
    href: "/blacklist",
    label: "Blacklist",
    icon: Icon.blacklist,
    min: "admin",
  },
  {
    href: "/transcripts",
    label: "Transcripts",
    icon: Icon.transcripts,
    min: "console",
  },
  { href: "/stats", label: "Stats", icon: Icon.stats, min: "console" },
  { href: "/audit", label: "Audit log", icon: Icon.audit, min: "admin" },
  {
    href: "/permissions",
    label: "Permissions",
    icon: Icon.permissions,
    min: "admin",
  },
];

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { guildId: string };
}) {
  const { level } = await requireGuildAccess(params.guildId);
  const { guildId } = params;
  const visibleNav = NAV.filter((i) => levelAtLeast(level, i.min));
  const session = await auth();
  const me = session?.user;
  const guild = repos.guilds.getGuild(db(), guildId);
  const cfg = repos.guildConfig.getGuildConfig(db(), guildId);
  const suspended = cfg.suspended;

  // --- Sidebar attention badges (DB-only, no Discord calls) ---
  const cats = repos.categories.listCategories(db(), guildId);
  const panels = repos.panels.listPanels(db(), guildId);
  const openTickets = repos.tickets.listOpenTickets(db(), guildId);
  const nowS = Date.now() / 1000;
  const slaUnclaimedS = cfg.slaUnclaimedMins * 60;
  const slaNoReplyS = cfg.slaNoReplyMins * 60;
  const flaggedCount = openTickets.filter(
    (t) =>
      (cfg.claimingEnabled &&
        !t.claimedBy &&
        nowS - t.createdAt > slaUnclaimedS) ||
      (!t.firstStaffMsgAt && nowS - t.createdAt > slaNoReplyS),
  ).length;
  const overviewAlert =
    flaggedCount > 0 ||
    cats.length === 0 ||
    panels.filter((p) => p.status === "published").length === 0 ||
    cats.some((c) => c.staffRoleIds.length === 0 && !cfg.defaultStaffRoleId) ||
    panels.some((p) => p.status === "published" && !p.channelId);

  const seenRaw = cookies().get(`tx_seen_${guildId}`)?.value;
  const seenMs = seenRaw ? Number(seenRaw) : NaN;
  const newTranscripts = Number.isFinite(seenMs)
    ? repos.tickets
        .listClosedTickets(db(), guildId, 100)
        .filter((t) => t.closedAt && t.closedAt * 1000 > seenMs).length
    : 0;
  // `guild.icon` may be a bare hash or (from older bot builds) a full CDN URL.
  const iconUrl = !guild?.icon
    ? null
    : guild.icon.startsWith("http")
      ? guild.icon
      : `https://cdn.discordapp.com/icons/${params.guildId}/${guild.icon}.png?size=64`;
  const initials = (guild?.name ?? "S").slice(0, 2).toUpperCase();

  const notif = me?.discordId
    ? getNotificationFeed(guildId, me.discordId, 30)
    : { items: [], unread: 0, lastSeen: 0 };

  const navItems: NavItem[] = visibleNav.map((item) => ({
    href: `/dashboard/${guildId}${item.href}`,
    label: item.label,
    icon: item.icon,
    exact: item.href === "",
    dot: item.href === "" && overviewAlert,
    badge:
      item.href === "/transcripts"
        ? newTranscripts
        : item.href === "/tickets"
          ? flaggedCount
          : item.href === "/notifications"
            ? notif.unread
            : undefined,
  }));

  return (
    <div className="relative z-10 min-h-screen">
      <NavigationGuard />
      <header className="sticky top-0 z-20 border-b border-line bg-[var(--bg-glass)] shadow-sm backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
            <MobileNav items={navItems} />
            <Link
              href="/dashboard"
              className="btn-ghost !rounded-full !px-3 !py-1.5 text-xs"
            >
              ← Servers
            </Link>
            <div className="h-6 w-px bg-line" />
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[11px] font-bold text-dim ring-1 ring-line">
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl} alt="" className="h-full w-full" />
                ) : (
                  initials
                )}
              </div>
              <span className="truncate text-sm font-semibold">
                {guild?.name ?? "Server"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {me && (
              <div
                className="hidden items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 sm:flex"
                title={`Signed in as ${me.name ?? "you"}`}
              >
                <div className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 text-[10px] font-bold text-dim">
                  {me.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.image} alt="" className="h-full w-full" />
                  ) : (
                    (me.name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <span className="max-w-[9rem] truncate text-xs text-dim">
                  {me.name}
                </span>
              </div>
            )}
            <NotificationBell
              guildId={guildId}
              items={notif.items}
              unread={notif.unread}
            />
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                className="btn-ghost !rounded-full text-xs"
                type="submit"
                title="Not you? Sign out"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex w-full gap-8 px-4 py-8 sm:px-6 lg:gap-9 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
          <div className="sticky top-[4.75rem] rounded-card border border-line bg-surface p-2 shadow-sm">
            <SideNav items={navItems} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-16">
          {suspended && (
            <div className="note note-danger mb-6">
              <strong className="font-semibold">
                This server is suspended.
              </strong>{" "}
              The bot host has frozen ticketing and configuration changes for
              this server. Settings are read-only until it is lifted.
            </div>
          )}
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </main>
      </div>
    </div>
  );
}
