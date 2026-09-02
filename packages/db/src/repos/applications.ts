import {
  DEFAULT_PANEL_EMBED,
  type ApplicationConfig,
  type ApplicationEligibility,
  type ApplicationStatus,
  type ApplicationSubmission,
  type EmbedConfig,
  type FormField,
  type SubmissionStatus,
} from "@ticketbot/shared";
import type { DB } from "../index.js";

function jparse<T>(json: unknown, fallback: T): T {
  if (typeof json !== "string") return fallback;
  try {
    const v = JSON.parse(json);
    return v == null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

function mapApp(r: any): ApplicationConfig {
  return {
    id: r.id,
    guildId: r.guild_id,
    name: r.name,
    channelId: r.channel_id,
    messageId: r.message_id,
    embed: jparse<EmbedConfig>(r.embed_json, DEFAULT_PANEL_EMBED),
    buttonLabel: r.button_label || "Apply",
    questions: jparse<FormField[]>(r.questions_json, []),
    reviewerRoleIds: jparse<string[]>(r.reviewer_role_ids_json, []),
    grantRoleIds: jparse<string[]>(r.grant_role_ids_json, []),
    logChannelId: r.log_channel_id,
    eligibility: jparse<ApplicationEligibility | null>(
      r.eligibility_json,
      null,
    ),
    maxOpenPerUser: r.max_open_per_user ?? 1,
    status: (r.status ?? "draft") as ApplicationStatus,
    createdBy: r.created_by,
  };
}

function mapSub(r: any): ApplicationSubmission {
  return {
    id: r.id,
    applicationId: r.application_id,
    guildId: r.guild_id,
    userId: r.user_id,
    answers: jparse(r.answers_json, []),
    status: (r.status ?? "pending") as SubmissionStatus,
    reviewerId: r.reviewer_id,
    reason: r.reason,
    cardChannelId: r.card_channel_id,
    cardMessageId: r.card_message_id,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
  };
}

export interface ApplicationInput {
  name?: string;
  channelId?: string | null;
  embed?: EmbedConfig;
  buttonLabel?: string;
  questions?: FormField[];
  reviewerRoleIds?: string[];
  grantRoleIds?: string[];
  logChannelId?: string | null;
  eligibility?: ApplicationEligibility | null;
  maxOpenPerUser?: number;
  status?: ApplicationStatus;
  createdBy?: string | null;
}

export function listApplications(db: DB, guildId: string): ApplicationConfig[] {
  return db
    .prepare(`SELECT * FROM applications WHERE guild_id = ? ORDER BY id`)
    .all(guildId)
    .map(mapApp);
}

export function getApplication(db: DB, id: number): ApplicationConfig | null {
  const r = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id);
  return r ? mapApp(r) : null;
}

export function createApplication(
  db: DB,
  guildId: string,
  input: ApplicationInput,
): ApplicationConfig {
  const now = Math.floor(Date.now() / 1000);
  const info = db
    .prepare(
      `INSERT INTO applications
        (guild_id, name, channel_id, embed_json, button_label, questions_json,
         reviewer_role_ids_json, grant_role_ids_json, log_channel_id,
         eligibility_json, max_open_per_user, status, created_by,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      guildId,
      input.name ?? "Staff application",
      input.channelId ?? null,
      JSON.stringify(input.embed ?? DEFAULT_PANEL_EMBED),
      input.buttonLabel ?? "Apply",
      JSON.stringify(input.questions ?? []),
      JSON.stringify(input.reviewerRoleIds ?? []),
      JSON.stringify(input.grantRoleIds ?? []),
      input.logChannelId ?? null,
      input.eligibility ? JSON.stringify(input.eligibility) : null,
      input.maxOpenPerUser ?? 1,
      input.status ?? "draft",
      input.createdBy ?? null,
      now,
      now,
    );
  return getApplication(db, Number(info.lastInsertRowid))!;
}

const COLS: Record<string, string> = {
  name: "name",
  channelId: "channel_id",
  embed: "embed_json",
  buttonLabel: "button_label",
  questions: "questions_json",
  reviewerRoleIds: "reviewer_role_ids_json",
  grantRoleIds: "grant_role_ids_json",
  logChannelId: "log_channel_id",
  eligibility: "eligibility_json",
  maxOpenPerUser: "max_open_per_user",
  status: "status",
};

export function updateApplication(
  db: DB,
  id: number,
  patch: ApplicationInput,
): ApplicationConfig | null {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(COLS)) {
    if (!(key in patch)) continue;
    let v: unknown = (patch as Record<string, unknown>)[key];
    if (
      key === "embed" ||
      key === "questions" ||
      key === "reviewerRoleIds" ||
      key === "grantRoleIds"
    )
      v = JSON.stringify(v ?? []);
    else if (key === "eligibility") v = v == null ? null : JSON.stringify(v);
    sets.push(`${col} = ?`);
    values.push(v ?? null);
  }
  if (sets.length) {
    sets.push("updated_at = ?");
    values.push(Math.floor(Date.now() / 1000), id);
    db.prepare(`UPDATE applications SET ${sets.join(", ")} WHERE id = ?`).run(
      ...values,
    );
  }
  return getApplication(db, id);
}

export function setApplicationMessage(
  db: DB,
  id: number,
  channelId: string,
  messageId: string,
): void {
  db.prepare(
    `UPDATE applications SET channel_id = ?, message_id = ?, updated_at = ? WHERE id = ?`,
  ).run(channelId, messageId, Math.floor(Date.now() / 1000), id);
}

export function deleteApplication(db: DB, id: number): void {
  db.prepare(`DELETE FROM applications WHERE id = ?`).run(id);
  db.prepare(
    `DELETE FROM application_submissions WHERE application_id = ?`,
  ).run(id);
}

// --- submissions ---

export function countOpenSubmissions(
  db: DB,
  applicationId: number,
  userId: string,
): number {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM application_submissions
       WHERE application_id = ? AND user_id = ? AND status = 'pending'`,
    )
    .get(applicationId, userId) as { n: number };
  return r.n;
}

export function createSubmission(
  db: DB,
  input: {
    applicationId: number;
    guildId: string;
    userId: string;
    answers: ApplicationSubmission["answers"];
  },
): ApplicationSubmission {
  const info = db
    .prepare(
      `INSERT INTO application_submissions
        (application_id, guild_id, user_id, answers_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.applicationId,
      input.guildId,
      input.userId,
      JSON.stringify(input.answers),
      Math.floor(Date.now() / 1000),
    );
  return getSubmission(db, Number(info.lastInsertRowid))!;
}

export function getSubmission(
  db: DB,
  id: number,
): ApplicationSubmission | null {
  const r = db
    .prepare(`SELECT * FROM application_submissions WHERE id = ?`)
    .get(id);
  return r ? mapSub(r) : null;
}

export function setSubmissionCard(
  db: DB,
  id: number,
  channelId: string,
  messageId: string,
): void {
  db.prepare(
    `UPDATE application_submissions SET card_channel_id = ?, card_message_id = ? WHERE id = ?`,
  ).run(channelId, messageId, id);
}

export function decideSubmission(
  db: DB,
  id: number,
  status: "approved" | "denied",
  reviewerId: string,
  reason: string | null,
): void {
  db.prepare(
    `UPDATE application_submissions
       SET status = ?, reviewer_id = ?, reason = ?, decided_at = ?
     WHERE id = ? AND status = 'pending'`,
  ).run(status, reviewerId, reason, Math.floor(Date.now() / 1000), id);
}

export function listSubmissions(
  db: DB,
  guildId: string,
  opts: {
    status?: SubmissionStatus;
    applicationId?: number;
    limit?: number;
  } = {},
): ApplicationSubmission[] {
  const where = ["guild_id = ?"];
  const args: unknown[] = [guildId];
  if (opts.status) {
    where.push("status = ?");
    args.push(opts.status);
  }
  if (opts.applicationId != null) {
    where.push("application_id = ?");
    args.push(opts.applicationId);
  }
  args.push(opts.limit ?? 100);
  return db
    .prepare(
      `SELECT * FROM application_submissions
       WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`,
    )
    .all(...args)
    .map(mapSub);
}
