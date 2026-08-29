import {
  DEFAULT_NAMING_SCHEME,
  type CloseBehaviour,
  type EmbedConfig,
  type GuildConfig,
} from "@ticketbot/shared";
import type { DB } from "../index.js";

function parseEmbed(json: string | null): EmbedConfig | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as EmbedConfig;
  } catch {
    return null;
  }
}

function map(r: any): GuildConfig {
  return {
    guildId: r.guild_id,
    logChannelId: r.log_channel_id,
    transcriptChannelId: r.transcript_channel_id,
    defaultStaffRoleId: r.default_staff_role_id,
    language: r.language ?? "en",
    namingScheme: r.naming_scheme ?? DEFAULT_NAMING_SCHEME,
    maxOpenPerUser: r.max_open_per_user ?? 1,
    closeBehaviour: (r.close_behaviour ?? "delete") as CloseBehaviour,
    archiveCategoryId: r.archive_category_id,
    feedbackEnabled: !!r.feedback_enabled,
    feedbackPromptEmbed: parseEmbed(r.feedback_prompt_json),
    welcomeEmbed: parseEmbed(r.welcome_embed_json),
    closeEmbed: parseEmbed(r.close_embed_json),
    inactivityHours: r.inactivity_hours ?? 0,
    transcriptRetentionDays: r.transcript_retention_days ?? 0,
    claimingEnabled: r.claiming_enabled == null ? true : !!r.claiming_enabled,
    suspended: !!r.suspended,
  };
}

function defaults(guildId: string): GuildConfig {
  return {
    guildId,
    logChannelId: null,
    transcriptChannelId: null,
    defaultStaffRoleId: null,
    language: "en",
    namingScheme: DEFAULT_NAMING_SCHEME,
    maxOpenPerUser: 1,
    closeBehaviour: "delete",
    archiveCategoryId: null,
    feedbackEnabled: true,
    feedbackPromptEmbed: null,
    welcomeEmbed: null,
    closeEmbed: null,
    inactivityHours: 0,
    transcriptRetentionDays: 0,
    claimingEnabled: true,
    suspended: false,
  };
}

/** Ensure a row exists so the dashboard has something to edit. */
export function ensureGuildConfig(db: DB, guildId: string): GuildConfig {
  db.prepare(
    `INSERT INTO guild_config (guild_id, updated_at) VALUES (?, ?)
     ON CONFLICT(guild_id) DO NOTHING`,
  ).run(guildId, Math.floor(Date.now() / 1000));
  return getGuildConfig(db, guildId);
}

export function getGuildConfig(db: DB, guildId: string): GuildConfig {
  const row = db
    .prepare(`SELECT * FROM guild_config WHERE guild_id = ?`)
    .get(guildId);
  return row ? map(row) : defaults(guildId);
}

const COLUMN_MAP: Record<string, string> = {
  logChannelId: "log_channel_id",
  transcriptChannelId: "transcript_channel_id",
  defaultStaffRoleId: "default_staff_role_id",
  language: "language",
  namingScheme: "naming_scheme",
  maxOpenPerUser: "max_open_per_user",
  closeBehaviour: "close_behaviour",
  archiveCategoryId: "archive_category_id",
  feedbackEnabled: "feedback_enabled",
  feedbackPromptEmbed: "feedback_prompt_json",
  welcomeEmbed: "welcome_embed_json",
  closeEmbed: "close_embed_json",
  inactivityHours: "inactivity_hours",
  transcriptRetentionDays: "transcript_retention_days",
  claimingEnabled: "claiming_enabled",
  suspended: "suspended",
};

type Patch = Partial<Omit<GuildConfig, "guildId">>;

export function updateGuildConfig(
  db: DB,
  guildId: string,
  patch: Patch,
): GuildConfig {
  ensureGuildConfig(db, guildId);

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    if (!(key in patch)) continue;
    const raw = (patch as Record<string, unknown>)[key];
    let value: unknown = raw;
    if (
      key === "feedbackEnabled" ||
      key === "claimingEnabled" ||
      key === "suspended"
    )
      value = raw ? 1 : 0;
    else if (
      key === "feedbackPromptEmbed" ||
      key === "welcomeEmbed" ||
      key === "closeEmbed"
    ) {
      value = raw == null ? null : JSON.stringify(raw);
    }
    sets.push(`${col} = ?`);
    values.push(value ?? null);
  }

  if (sets.length > 0) {
    sets.push("updated_at = ?");
    values.push(Math.floor(Date.now() / 1000));
    values.push(guildId);
    db.prepare(
      `UPDATE guild_config SET ${sets.join(", ")} WHERE guild_id = ?`,
    ).run(...values);
  }

  return getGuildConfig(db, guildId);
}
