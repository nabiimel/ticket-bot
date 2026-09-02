/**
 * Shared data shapes used by both the bot and the dashboard.
 * These describe the JSON payloads stored as TEXT columns in SQLite as well as
 * the normalized records the repositories return.
 */

// ---------------------------------------------------------------------------
// Embed / component config (authored in the dashboard visual editor)
// ---------------------------------------------------------------------------

export interface EmbedFooterConfig {
  text: string;
  iconUrl?: string;
}

export interface EmbedAuthorConfig {
  name: string;
  iconUrl?: string;
  url?: string;
}

/**
 * A subset of the Discord embed object that the dashboard editor exposes.
 * `description` / `title` / field text may contain {placeholder} tokens — see
 * `renderTemplate`.
 */
export interface EmbedConfig {
  title?: string;
  description?: string;
  /** Hex string like "#5865F2". Rendered to an int for discord.js. */
  color?: string;
  /** Large image shown at the bottom of the embed (the "banner"). */
  image?: string;
  /** Small image shown top-right. */
  thumbnail?: string;
  footer?: EmbedFooterConfig;
  author?: EmbedAuthorConfig;
  /** When true the embed carries the current timestamp. */
  timestamp?: boolean;
}

export type ButtonStyleName = "Primary" | "Secondary" | "Success" | "Danger";

export interface ButtonConfig {
  label: string;
  /** Unicode emoji or a custom emoji id. */
  emoji?: string;
  style: ButtonStyleName;
}

// ---------------------------------------------------------------------------
// Ticket open forms
// ---------------------------------------------------------------------------

export type FormFieldStyle = "short" | "paragraph";

export interface FormField {
  /** Stable key used to store the response. */
  key: string;
  label: string;
  style: FormFieldStyle;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Normalized records
// ---------------------------------------------------------------------------

export type CloseBehaviour = "delete" | "archive";
export type PanelStyle = "buttons" | "dropdown";
export type PanelStatus = "draft" | "published";
export type TicketStatus = "open" | "claimed" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export const TICKET_PRIORITIES: TicketPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

/** Staff coverage hours for the live panel status line. */
export interface StaffHours {
  /** IANA timezone, e.g. "America/New_York". */
  tz: string;
  /**
   * Sun..Sat (index 0..6). `null` = closed that day; otherwise
   * `[openMinuteOfDay, closeMinuteOfDay]`.
   */
  days: ([number, number] | null)[];
}

export type StaffStatusOverride = "auto" | "open" | "closed";

/** Dashboard access tiers, lowest to highest. */
export type DashboardLevel = "console" | "editor" | "admin";
export const DASHBOARD_LEVELS: DashboardLevel[] = [
  "console",
  "editor",
  "admin",
];

const LEVEL_ORDER: Record<DashboardLevel, number> = {
  console: 0,
  editor: 1,
  admin: 2,
};

export function levelAtLeast(
  have: DashboardLevel,
  need: DashboardLevel,
): boolean {
  return LEVEL_ORDER[have] >= LEVEL_ORDER[need];
}

export interface GuildConfig {
  guildId: string;
  logChannelId: string | null;
  transcriptChannelId: string | null;
  defaultStaffRoleId: string | null;
  language: string;
  namingScheme: string;
  maxOpenPerUser: number;
  closeBehaviour: CloseBehaviour;
  archiveCategoryId: string | null;
  feedbackEnabled: boolean;
  feedbackPromptEmbed: EmbedConfig | null;
  welcomeEmbed: EmbedConfig | null;
  closeEmbed: EmbedConfig | null;
  inactivityHours: number;
  /** Delete saved transcript files older than this many days. 0 = keep forever. */
  transcriptRetentionDays: number;
  /** Show a Claim button and allow /ticket claim + /ticket transfer. */
  claimingEnabled: boolean;
  /** Minutes an unclaimed ticket may sit before it's flagged. */
  slaUnclaimedMins: number;
  /** Minutes with no staff reply before a ticket is flagged. */
  slaNoReplyMins: number;
  /** Show a live "Staff online / offline" line on published panels. */
  staffStatusEnabled: boolean;
  staffHours: StaffHours | null;
  /** `auto` follows the hours; `open`/`closed` force the line. */
  staffStatusOverride: StaffStatusOverride;
  /** Host kill-switch: blocks ticket opening, jobs, sweeps and dashboard writes. */
  suspended: boolean;
}

export interface Snippet {
  id: number;
  guildId: string;
  /** Lookup key used by `/snippet name:<…>` (lowercase slug). */
  name: string;
  /** Message body; supports the same template tokens as other messages. */
  content: string;
  /** Dashboard-upload URLs (`/u/<guildId>/<file>`) sent as image attachments. */
  attachments: string[];
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CategoryConfig {
  id: number;
  guildId: string;
  key: string;
  label: string;
  emoji: string | null;
  description: string | null;
  staffRoleIds: string[];
  pingRoleIds: string[];
  discordParentId: string | null;
  /** null => fall back to the guild's default welcome embed. */
  welcomeEmbed: EmbedConfig | null;
  form: FormField[];
  /** null => fall back to guild `maxOpenPerUser`. */
  perUserLimit: number | null;
  /** null => fall back to the guild's naming scheme. `{category}` = this key. */
  namingScheme: string | null;
  /** Paused: panel button is disabled, new tickets are refused. */
  disabled: boolean;
  disabledReason: string | null;
  sortOrder: number;
}

export interface PanelConfig {
  id: number;
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  style: PanelStyle;
  dropdownPlaceholder: string | null;
  embed: EmbedConfig;
  /** categoryId (as string) -> button styling */
  buttons: Record<string, ButtonConfig>;
  categoryIds: number[];
  status: PanelStatus;
  createdBy: string | null;
}

export interface PanelStatRow {
  categoryId: number;
  clicks: number;
  opens: number;
}

export interface TicketRecord {
  id: number;
  guildId: string;
  number: number;
  channelId: string;
  categoryId: number | null;
  openerId: string;
  status: TicketStatus;
  priority: TicketPriority;
  /** Free-form staff labels. */
  tags: string[];
  subject: string | null;
  claimedBy: string | null;
  createdAt: number;
  claimedAt: number | null;
  firstStaffMsgAt: number | null;
  lastActivityAt: number;
  closedAt: number | null;
  closedBy: string | null;
  closeReason: string | null;
  transcriptUrl: string | null;
}

export interface BlacklistEntry {
  guildId: string;
  userId: string;
  reason: string | null;
  addedBy: string;
  addedAt: number;
}

export interface RatingRecord {
  ticketId: number;
  guildId: string;
  userId: string;
  score: number;
  comment: string | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Dashboard notification centre (derived on read; not persisted)
// ---------------------------------------------------------------------------

export type NotificationType =
  | "sla_unclaimed"
  | "sla_no_reply"
  | "low_rating"
  | "job_failed"
  | "config_changed"
  | "ticket_opened"
  | "ticket_closed";

export type NotificationSeverity = "info" | "warn" | "critical";

export interface FeedNotification {
  /** Stable synthetic key, e.g. `sla_unclaimed:42`. Lets the UI dedupe/react. */
  key: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  /** Unix seconds — when it happened (the breach moment for SLA items). */
  at: number;
  /** Dashboard-relative link, e.g. `/dashboard/<id>/tickets`. */
  href?: string;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export type ApplicationStatus = "draft" | "published";
export type SubmissionStatus = "pending" | "approved" | "denied";

export interface ApplicationEligibility {
  /** Minimum Discord account age in days. */
  minAccountDays?: number;
  /** Minimum time in this server, in days. */
  minMemberDays?: number;
  requiredRoleIds?: string[];
  blockedRoleIds?: string[];
}

export interface ApplicationConfig {
  id: number;
  guildId: string;
  name: string;
  channelId: string | null;
  messageId: string | null;
  embed: EmbedConfig;
  buttonLabel: string;
  questions: FormField[];
  reviewerRoleIds: string[];
  grantRoleIds: string[];
  logChannelId: string | null;
  eligibility: ApplicationEligibility | null;
  maxOpenPerUser: number;
  status: ApplicationStatus;
  createdBy: string | null;
}

export interface ApplicationSubmission {
  id: number;
  applicationId: number;
  guildId: string;
  userId: string;
  answers: { key: string; label: string; value: string }[];
  status: SubmissionStatus;
  reviewerId: string | null;
  reason: string | null;
  cardChannelId: string | null;
  cardMessageId: string | null;
  decidedAt: number | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Jobs (dashboard -> bot outbox)
// ---------------------------------------------------------------------------

export type JobType =
  | "repost_panel"
  | "edit_panel"
  | "sync_ticket_perms"
  | "post_preview"
  | "admin_close_ticket"
  | "admin_claim_ticket"
  | "repost_application"
  | "decide_application";

export type JobStatus = "pending" | "done" | "error";

export interface JobRecord<P = unknown> {
  id: number;
  guildId: string;
  type: JobType;
  payload: P;
  status: JobStatus;
  attempts: number;
  createdAt: number;
  processedAt: number | null;
  error: string | null;
}

export interface RepostPanelPayload {
  panelId: number;
}
export interface EditPanelPayload {
  panelId: number;
}
export interface SyncTicketPermsPayload {
  /** Omit to re-sync every open ticket in the guild (e.g. default staff role changed). */
  categoryId?: number;
}
export interface PostPreviewPayload {
  channelId: string;
  embed: EmbedConfig;
}
export interface AdminCloseTicketPayload {
  ticketId: number;
  closedBy: string;
  reason?: string;
}
export interface AdminClaimTicketPayload {
  ticketId: number;
  staffId: string;
}
export interface RepostApplicationPayload {
  applicationId: number;
}
export interface DecideApplicationPayload {
  submissionId: number;
  decision: "approved" | "denied";
  reviewerId: string;
  reason?: string;
}
