import Link from "next/link";
import { cookies } from "next/headers";
import { auth, signOut } from "@/auth";
import { requireGuildAccess } from "@/lib/guild-access";
import { db, repos } from "@/lib/db";
import { NavLink } from "@/components/NavLink";
import { Icon } from "@/components/icons";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ThemeToggle } from "@/components/ThemeToggle";

const SLA_UNCLAIMED_S = 30 * 60;
const SLA_NO_REPLY_S = 60 * 60;

export const dynamic = "force-dynamic";

const NAV = [
  { href: "", label: "Overview", icon: Icon.overview },
  { href: "/tickets", label: "Tickets", icon: Icon.tickets },
  { href: "/general", label: "General", icon: Icon.general },
  { href: "/categories", label: "Categories", icon: Icon.categories },
  { href: "/panels", label: "Panels", icon: Icon.panels },
  { href: "/messages", label: "Messages", icon: Icon.messages },
  { href: "/snippets", label: "Snippets", icon: Icon.snippets },
  { href: "/blacklist", label: "Blacklist", icon: Icon.blacklist },
  { href: "/transcripts", label: "Transcripts", icon: Icon.transcripts },
  { href: "/stats", label: "Stats", icon: Icon.stats },
  { href: "/audit", label: "Audit log", icon: Icon.audit },
];

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { guildId: string };
}) {
  await requireGuildAccess(params.guildId);
  const { guildId } = params;
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
  const flaggedCount = openTickets.filter(
    (t) =>
      (cfg.claimingEnabled &&
        !t.claimedBy &&
        nowS - t.createdAt > SLA_UNCLAIMED_S) ||
      (!t.firstStaffMsgAt && nowS - t.createdAt > SLA_NO_REPLY_S),
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

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-[var(--bg-glass)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="btn-ghost !px-2 !py-1 text-xs">
              ← Servers
            </Link>
            <div className="h-5 w-px bg-line" />
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[11px] font-bold text-dim">
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
          <div className="flex items-center gap-2.5">
            {me && (
              <div
                className="flex items-center gap-2"
                title={`Signed in as ${me.name ?? "you"}`}
              >
                <div className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[10px] font-bold text-dim">
                  {me.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.image} alt="" className="h-full w-full" />
                  ) : (
                    (me.name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <span className="hidden max-w-[10rem] truncate text-xs text-dim sm:block">
                  {me.name}
                </span>
              </div>
            )}
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                className="btn-ghost text-xs"
                type="submit"
                title="Not you? Sign out"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="w-56 shrink-0">
          <nav className="sticky top-20 space-y-0.5">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                href={`/dashboard/${guildId}${item.href}`}
                exact={item.href === ""}
                icon={item.icon}
                dot={item.href === "" && overviewAlert}
                badge={
                  item.href === "/transcripts"
                    ? newTranscripts
                    : item.href === "/tickets"
                      ? flaggedCount
                      : undefined
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-16">
          {suspended && (
            <div className="mb-6 rounded-xl border border-[rgba(237,66,69,.4)] bg-[rgba(237,66,69,.14)] px-4 py-3 text-sm text-red-200">
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
