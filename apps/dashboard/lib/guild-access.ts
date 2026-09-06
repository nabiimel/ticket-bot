import "server-only";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { levelAtLeast, type DashboardLevel } from "@ticketbot/shared";
import { auth } from "@/auth";
import { db, repos } from "./db";
import { getGuildMemberRoles, userCanManageGuild } from "./discord";

export interface GuildSession {
  guildId: string;
  userId: string;
  accessToken: string;
  /** Resolved dashboard tier for this user on this guild. */
  level: DashboardLevel;
  /** Signed in through the operator back-door rather than Discord. */
  dev: boolean;
}

type MaybeSession = Session | null;

/** A usable Discord session (has a token + a Discord id, no refresh error). */
function isDiscordSession(s: MaybeSession): s is Session & {
  accessToken: string;
  user: { discordId: string };
} {
  return (
    !!s &&
    !s.error &&
    !s.user?.dev &&
    typeof s.accessToken === "string" &&
    typeof s.user?.discordId === "string"
  );
}

function isDevSession(s: MaybeSession): boolean {
  return !!s && !s.error && !!s.user?.dev;
}

/**
 * Manage Server / owner → always `admin`. Otherwise the highest level any of
 * the member's roles is granted, or `null` if none. Throws on Discord being
 * unreachable so the caller can distinguish "no access" from "can't check".
 */
async function resolveLevel(
  accessToken: string,
  userId: string,
  guildId: string,
): Promise<DashboardLevel | null> {
  if (await userCanManageGuild(accessToken, guildId, userId)) return "admin";
  const roles = await getGuildMemberRoles(guildId, userId);
  return repos.dashboardGrants.resolveLevel(db(), guildId, roles);
}

/**
 * Guard for every `/dashboard/[guildId]` route: signed in, the bot is present,
 * and the user's resolved level is at least `min` (default `console`).
 */
export async function requireGuildAccess(
  guildId: string,
  min: DashboardLevel = "console",
): Promise<GuildSession> {
  const session = await auth();

  if (!isDevSession(session) && !isDiscordSession(session)) {
    redirect("/?error=session-expired");
  }
  if (!repos.guilds.isGuildPresent(db(), guildId)) {
    redirect("/dashboard?error=bot-not-in-guild");
  }

  // Operator back-door: admin on every server, no Discord round-trip.
  if (isDevSession(session)) {
    return {
      guildId,
      userId: "dev",
      accessToken: "",
      level: "admin",
      dev: true,
    };
  }
  if (!isDiscordSession(session)) redirect("/?error=session-expired");

  let level: DashboardLevel | null;
  try {
    level = await resolveLevel(
      session.accessToken,
      session.user.discordId,
      guildId,
    );
  } catch {
    redirect("/dashboard?error=discord-unavailable");
  }

  if (!level) redirect("/dashboard?error=no-access");
  if (!levelAtLeast(level, min)) {
    redirect(`/dashboard/${guildId}?error=insufficient-access`);
  }

  return {
    guildId,
    userId: session.user.discordId,
    accessToken: session.accessToken,
    level,
    dev: false,
  };
}

/** Non-redirecting variant for route handlers: session on success, else null. */
export async function checkGuildAccess(
  guildId: string,
  min: DashboardLevel = "console",
): Promise<GuildSession | null> {
  const session = await auth();

  if (isDevSession(session)) {
    if (!repos.guilds.isGuildPresent(db(), guildId)) return null;
    return {
      guildId,
      userId: "dev",
      accessToken: "",
      level: "admin",
      dev: true,
    };
  }
  if (!isDiscordSession(session)) return null;
  if (!repos.guilds.isGuildPresent(db(), guildId)) return null;
  try {
    const level = await resolveLevel(
      session.accessToken,
      session.user.discordId,
      guildId,
    );
    if (!level || !levelAtLeast(level, min)) return null;
    return {
      guildId,
      userId: session.user.discordId,
      accessToken: session.accessToken,
      level,
      dev: false,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await auth();
  if (!isDevSession(session) && !isDiscordSession(session)) {
    redirect("/?error=session-expired");
  }
  return session!;
}
