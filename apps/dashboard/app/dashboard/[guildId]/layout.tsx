import Link from "next/link";
import { signOut } from "@/auth";
import { requireGuildAccess } from "@/lib/guild-access";
import { db, repos } from "@/lib/db";
import { NavLink } from "@/components/NavLink";
import { Icon } from "@/components/icons";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "", label: "Overview", icon: Icon.overview },
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
  const guild = repos.guilds.getGuild(db(), params.guildId);
  const suspended = repos.guildConfig.getGuildConfig(
    db(),
    params.guildId,
  ).suspended;
  const iconUrl = guild?.icon
    ? `https://cdn.discordapp.com/icons/${params.guildId}/${guild.icon}.png?size=64`
    : null;
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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="btn-ghost text-xs" type="submit">
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
                href={`/dashboard/${params.guildId}${item.href}`}
                exact={item.href === ""}
                icon={item.icon}
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
