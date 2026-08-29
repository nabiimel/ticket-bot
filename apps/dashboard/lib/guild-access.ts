import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, repos } from "./db";
import { userCanManageGuild } from "./discord";

export interface GuildSession {
  guildId: string;
  userId: string;
  accessToken: string;
}

/**
 * Guard for every `/dashboard/[guildId]` route: the visitor must be signed in,
 * still have Manage Server on that guild, and the bot must be present.
 */
export async function requireGuildAccess(
  guildId: string,
): Promise<GuildSession> {
  const session = await auth();
  if (!session?.accessToken || !session.user?.discordId || session.error) {
    redirect("/?error=session-expired");
  }
  if (!repos.guilds.isGuildPresent(db(), guildId)) {
    redirect("/dashboard?error=bot-not-in-guild");
  }
  let ok: boolean;
  try {
    ok = await userCanManageGuild(
      session.accessToken,
      guildId,
      session.user.discordId,
    );
  } catch {
    // Couldn't reach Discord to verify — don't imply the user lost access.
    redirect("/dashboard?error=discord-unavailable");
  }
  if (!ok) {
    redirect("/dashboard?error=no-access");
  }
  return {
    guildId,
    userId: session.user.discordId,
    accessToken: session.accessToken,
  };
}

/**
 * Non-redirecting variant for route handlers (uploads, file serving): returns
 * the session on success or null on any failure.
 */
export async function checkGuildAccess(
  guildId: string,
): Promise<GuildSession | null> {
  const session = await auth();
  if (!session?.accessToken || !session.user?.discordId || session.error) {
    return null;
  }
  if (!repos.guilds.isGuildPresent(db(), guildId)) return null;
  try {
    if (
      !(await userCanManageGuild(
        session.accessToken,
        guildId,
        session.user.discordId,
      ))
    )
      return null;
  } catch {
    return null;
  }
  return {
    guildId,
    userId: session.user.discordId,
    accessToken: session.accessToken,
  };
}

export async function requireSession() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.discordId || session.error) {
    redirect("/?error=session-expired");
  }
  return session;
}
