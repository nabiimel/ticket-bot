import Link from "next/link";
import { signOut } from "@/auth";
import { requireSession } from "@/lib/guild-access";
import { getManageableGuilds } from "@/lib/discord";
import { db, repos } from "@/lib/db";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

function iconUrl(id: string, icon: string | null) {
  return icon
    ? `https://cdn.discordapp.com/icons/${id}/${icon}.png?size=64`
    : null;
}

export default async function GuildPicker({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await requireSession();
  let guilds: Awaited<ReturnType<typeof getManageableGuilds>> = [];
  let discordDown = false;
  try {
    guilds = await getManageableGuilds(
      session.accessToken!,
      session.user?.discordId,
    );
  } catch {
    discordDown = true;
  }
  const present = new Set(
    repos.guilds.listPresentGuilds(db()).map((g) => g.guildId),
  );

  const inviteBase =
    `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}` +
    `&permissions=268553232&scope=bot%20applications.commands`;

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Your servers</h1>
          <p className="mt-1 text-sm text-dim">
            Pick a server to configure its ticket system.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {session.user && (
            <div
              className="flex items-center gap-2"
              title={`Signed in as ${session.user.name ?? "you"}`}
            >
              <div className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[10px] font-bold text-dim">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-full w-full"
                  />
                ) : (
                  (session.user.name ?? "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <span className="hidden max-w-[10rem] truncate text-xs text-dim sm:block">
                {session.user.name}
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

      {searchParams.error === "no-access" && (
        <p className="mb-4 rounded-md bg-discord-red/20 px-4 py-2 text-sm text-red-300">
          You don&apos;t have Manage Server permission on that guild.
        </p>
      )}
      {(searchParams.error === "discord-unavailable" || discordDown) && (
        <p className="mb-4 rounded-md bg-amber-500/20 px-4 py-2 text-sm text-amber-200">
          Couldn&apos;t reach Discord to check your servers (it may be
          rate-limiting). Wait a minute and refresh — you haven&apos;t lost
          access.
        </p>
      )}
      {searchParams.error === "bot-not-in-guild" && (
        <p className="mb-4 rounded-md bg-amber-500/20 px-4 py-2 text-sm text-amber-200">
          The bot isn&apos;t in that server yet. Add it first.
        </p>
      )}

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {guilds.length === 0 && (
          <li className="text-dim">No servers where you can Manage Server.</li>
        )}
        {guilds.map((g) => {
          const img = iconUrl(g.id, g.icon);
          const botIn = present.has(g.id);
          return (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-sm font-bold text-dim">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full" />
                  ) : (
                    g.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <span className="truncate font-medium">{g.name}</span>
              </div>
              {botIn ? (
                <Link className="btn-primary" href={`/dashboard/${g.id}`}>
                  Manage
                </Link>
              ) : (
                <a
                  className="btn-secondary"
                  href={`${inviteBase}&guild_id=${g.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Add bot
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
