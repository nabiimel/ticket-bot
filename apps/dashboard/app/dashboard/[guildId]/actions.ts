"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DASHBOARD_LEVELS,
  SUPPORTED_LANGUAGES,
  TICKET_PRIORITIES,
  isSupportedLanguage,
  isValidEmoji,
  type ButtonConfig,
  type DashboardLevel,
  type EmbedConfig,
  type FormField,
  type PanelStyle,
  type TicketPriority,
} from "@ticketbot/shared";
import { requireGuildAccess } from "@/lib/guild-access";
import { db, repos } from "@/lib/db";
import { enqueueJob } from "@/lib/enqueue";
import { bustDiscordCache, getGuildMemberRoles } from "@/lib/discord";
import { cleanupOrphanUploads } from "@/lib/uploads";
import { hit } from "@/lib/cooldown";
import { err, ok, type FormState } from "@/lib/form";

const SUSPENDED_MSG = "This server has been suspended by the bot host.";

/** True when the host operator has suspended this guild (writes are frozen). */
function isSuspended(guildId: string): boolean {
  return repos.guildConfig.getGuildConfig(db(), guildId).suspended;
}

function rev(guildId: string) {
  revalidatePath(`/dashboard/${guildId}`, "layout");
}

function audit(
  guildId: string,
  actorId: string,
  action: string,
  summary: string,
) {
  repos.audit.logAudit(db(), { guildId, actorId, action, summary });
}

const SNOWFLAKE = /^\d{15,20}$/;

// ---------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------

export async function saveGeneral(
  guildId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, message: SUSPENDED_MSG };
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim().length ? v.trim() : null;
  };

  const fieldErrors: Record<string, string> = {};

  const language = str("language") ?? "en";
  if (!isSupportedLanguage(language)) {
    fieldErrors.language = `Unsupported language (choose ${SUPPORTED_LANGUAGES.join(", ")})`;
  }

  const namingScheme = str("namingScheme") ?? "ticket-{number}";
  if (namingScheme.length > 90) {
    fieldErrors.namingScheme = "Keep the naming scheme under 90 characters";
  } else if (!/\{(number|id)\}/.test(namingScheme)) {
    fieldErrors.namingScheme =
      "Include {number} or {id} so ticket channels get unique names";
  }

  const maxRaw = str("maxOpenPerUser");
  const maxOpenPerUser = maxRaw == null ? 1 : Number(maxRaw);
  if (
    !Number.isInteger(maxOpenPerUser) ||
    maxOpenPerUser < 1 ||
    maxOpenPerUser > 25
  ) {
    fieldErrors.maxOpenPerUser = "Enter a whole number from 1 to 25";
  }

  const inacRaw = str("inactivityHours");
  const inactivityHours = inacRaw == null ? 0 : Number(inacRaw);
  if (
    !Number.isInteger(inactivityHours) ||
    inactivityHours < 0 ||
    inactivityHours > 720
  ) {
    fieldErrors.inactivityHours = "Enter a whole number of hours from 0 to 720";
  }

  const retRaw = str("transcriptRetentionDays");
  const transcriptRetentionDays = retRaw == null ? 0 : Number(retRaw);
  if (
    !Number.isInteger(transcriptRetentionDays) ||
    transcriptRetentionDays < 0 ||
    transcriptRetentionDays > 3650
  ) {
    fieldErrors.transcriptRetentionDays =
      "Enter a whole number of days from 0 to 3650";
  }

  const slaUnclaimedMins = Number(str("slaUnclaimedMins") ?? 30);
  const slaNoReplyMins = Number(str("slaNoReplyMins") ?? 60);
  for (const [k, v] of [
    ["slaUnclaimedMins", slaUnclaimedMins],
    ["slaNoReplyMins", slaNoReplyMins],
  ] as const) {
    if (!Number.isInteger(v) || v < 1 || v > 1440) {
      fieldErrors[k] = "Enter a whole number of minutes from 1 to 1440";
    }
  }

  // --- Staff hours ---
  const staffStatusEnabled = form.get("staffStatusEnabled") === "on";
  const ovRaw = str("staffOverride");
  const staffStatusOverride =
    ovRaw === "open" || ovRaw === "closed" ? ovRaw : "auto";
  const staffTz = str("staffTz") ?? "UTC";
  const hmToMin = (v: string | null): number | null => {
    if (!v) return null;
    const [h, m] = v.split(":").map(Number);
    return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h < 24
      ? h * 60 + m
      : null;
  };
  const staffDays: ([number, number] | null)[] = [];
  for (let d = 0; d < 7; d++) {
    const openDay = form.get(`staffDay${d}Open`) === "on";
    const f = hmToMin(str(`staffDay${d}From`));
    const t = hmToMin(str(`staffDay${d}To`));
    staffDays.push(openDay && f != null && t != null && t > f ? [f, t] : null);
  }
  const staffHours = { tz: staffTz, days: staffDays };
  if (staffStatusEnabled && staffDays.every((x) => x === null)) {
    fieldErrors.staffHours =
      "Open at least one day (with an end time after the start time)";
  }

  const closeBehaviour =
    str("closeBehaviour") === "archive" ? "archive" : "delete";
  const archiveCategoryId = str("archiveCategoryId");
  if (closeBehaviour === "archive" && !archiveCategoryId) {
    fieldErrors.archiveCategoryId =
      "Choose an archive category when close behaviour is “archive”";
  }

  for (const k of [
    "logChannelId",
    "transcriptChannelId",
    "defaultStaffRoleId",
    "archiveCategoryId",
  ] as const) {
    const v = str(k);
    if (v && !SNOWFLAKE.test(v)) fieldErrors[k] = "Invalid selection";
  }

  if (Object.keys(fieldErrors).length > 0) return err(fieldErrors);

  const before = repos.guildConfig.getGuildConfig(db(), guildId);
  const defaultStaffRoleId = str("defaultStaffRoleId");

  const next: Parameters<typeof repos.guildConfig.updateGuildConfig>[2] = {
    logChannelId: str("logChannelId"),
    transcriptChannelId: str("transcriptChannelId"),
    defaultStaffRoleId,
    language,
    namingScheme,
    maxOpenPerUser,
    closeBehaviour,
    archiveCategoryId,
    feedbackEnabled: form.get("feedbackEnabled") === "on",
    claimingEnabled: form.get("claimingEnabled") === "on",
    inactivityHours,
    transcriptRetentionDays,
    slaUnclaimedMins,
    slaNoReplyMins,
    staffStatusEnabled,
    staffHours,
    staffStatusOverride,
  };
  const GEN_LABELS: Record<string, string> = {
    logChannelId: "log channel",
    transcriptChannelId: "transcript channel",
    defaultStaffRoleId: "default staff role",
    language: "language",
    namingScheme: "channel name",
    maxOpenPerUser: "max open per person",
    closeBehaviour: "close behaviour",
    archiveCategoryId: "archive category",
    feedbackEnabled: "rating prompt",
    claimingEnabled: "claiming",
    inactivityHours: "auto-close",
    transcriptRetentionDays: "transcript retention",
    slaUnclaimedMins: "unclaimed target",
    slaNoReplyMins: "first-reply target",
    staffStatusEnabled: "staff status line",
    staffHours: "staff hours",
    staffStatusOverride: "staff status override",
  };
  const genChanged = Object.keys(next)
    .filter(
      (k) =>
        JSON.stringify((next as Record<string, unknown>)[k]) !==
        JSON.stringify((before as unknown as Record<string, unknown>)[k]),
    )
    .map((k) => GEN_LABELS[k] ?? k);

  repos.guildConfig.updateGuildConfig(db(), guildId, next);

  // The default staff role applies to every ticket — re-sync open channels.
  if (before.defaultStaffRoleId !== defaultStaffRoleId) {
    await enqueueJob(guildId, "sync_ticket_perms", {});
  }

  // Staff-status settings changed → re-post published panels so the line updates.
  const staffChanged =
    before.staffStatusEnabled !== staffStatusEnabled ||
    before.staffStatusOverride !== staffStatusOverride ||
    JSON.stringify(before.staffHours) !== JSON.stringify(staffHours);
  if (staffChanged) {
    for (const p of repos.panels.listPanels(db(), guildId)) {
      if (p.status === "published" && p.channelId) {
        await enqueueJob(guildId, "edit_panel", { panelId: p.id });
      }
    }
  }

  audit(
    guildId,
    userId,
    "general.update",
    `Updated general settings${
      genChanged.length ? `: ${genChanged.join(", ")}` : ""
    }`,
  );
  rev(guildId);
  return ok("Settings saved");
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface CategoryPayload {
  key: string;
  label: string;
  emoji?: string | null;
  description?: string | null;
  staffRoleIds: string[];
  pingRoleIds: string[];
  discordParentId?: string | null;
  perUserLimit?: number | null;
  namingScheme?: string | null;
  welcomeEmbed?: EmbedConfig | null;
  form: FormField[];
  disabled?: boolean;
  disabledReason?: string | null;
  sortOrder?: number;
}

const CATEGORY_KEY = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** Form-driven category creation with inline validation; redirects to the editor on success. */
export async function createCategoryFromForm(
  guildId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, message: SUSPENDED_MSG };
  const key = String(form.get("key") ?? "")
    .trim()
    .toLowerCase();
  const label = String(form.get("label") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!key) fieldErrors.key = "Key is required";
  else if (!CATEGORY_KEY.test(key))
    fieldErrors.key =
      "Lowercase letters, numbers, - or _ (max 32, can’t start with - or _)";
  if (!label) fieldErrors.label = "Label is required";
  else if (label.length > 100)
    fieldErrors.label = "Keep the label under 100 characters";

  if (
    !fieldErrors.key &&
    repos.categories.getCategoryByKey(db(), guildId, key)
  ) {
    fieldErrors.key = `A category with key “${key}” already exists`;
  }
  if (Object.keys(fieldErrors).length > 0) return err(fieldErrors);

  const cat = repos.categories.createCategory(db(), guildId, {
    key,
    label,
    staffRoleIds: [],
    pingRoleIds: [],
    form: [],
  });
  audit(
    guildId,
    userId,
    "category.create",
    `Created category “${label}” (${key})`,
  );
  rev(guildId);
  redirect(`/dashboard/${guildId}/categories/${cat.id}`);
}

export async function saveCategory(
  guildId: string,
  categoryId: number,
  payload: Partial<CategoryPayload>,
) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const existing = repos.categories.getCategory(db(), categoryId);
  if (!existing || existing.guildId !== guildId) {
    return { ok: false, error: "Not found" };
  }
  if (payload.emoji && !isValidEmoji(payload.emoji)) {
    return {
      ok: false,
      error: "Emoji must be a single emoji or a custom emoji like <:name:id>",
    };
  }
  if (
    payload.namingScheme &&
    (payload.namingScheme.length > 90 ||
      !/\{(number|id)\}/.test(payload.namingScheme))
  ) {
    return {
      ok: false,
      error: "Channel naming must include {number} or {id} (max 90 chars)",
    };
  }
  const CAT_FIELD_LABELS: Record<string, string> = {
    label: "name",
    key: "reference id",
    emoji: "emoji",
    description: "menu description",
    staffRoleIds: "staff roles",
    pingRoleIds: "ping roles",
    discordParentId: "parent category",
    perUserLimit: "per-user limit",
    namingScheme: "channel name",
    welcomeEmbed: "welcome message",
    form: "form",
    disabled: "paused",
    disabledReason: "pause reason",
  };
  const changed = Object.keys(payload)
    .filter(
      (k) =>
        k in CAT_FIELD_LABELS &&
        JSON.stringify((payload as Record<string, unknown>)[k]) !==
          JSON.stringify((existing as unknown as Record<string, unknown>)[k]),
    )
    .map((k) => CAT_FIELD_LABELS[k]);

  repos.categories.updateCategory(db(), categoryId, payload);
  await enqueueJob(guildId, "sync_ticket_perms", { categoryId });

  // Button label / emoji / colour / paused state all affect published panels.
  for (const p of repos.panels.listPanels(db(), guildId)) {
    if (p.status === "published" && p.categoryIds.includes(categoryId)) {
      await enqueueJob(guildId, p.messageId ? "edit_panel" : "repost_panel", {
        panelId: p.id,
      });
    }
  }

  audit(
    guildId,
    userId,
    "category.update",
    `Updated category “${existing.label}” (${existing.key})${
      changed.length ? `: ${changed.join(", ")}` : ""
    }`,
  );
  void cleanupOrphanUploads(guildId);
  rev(guildId);
  return { ok: true };
}

export async function deleteCategory(guildId: string, categoryId: number) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const existing = repos.categories.getCategory(db(), categoryId);
  if (existing?.guildId === guildId) {
    repos.categories.deleteCategory(db(), categoryId);
    audit(
      guildId,
      userId,
      "category.delete",
      `Deleted category “${existing.label}” (${existing.key})`,
    );
    rev(guildId);
  }
  return { ok: true };
}

export async function reorderCategories(guildId: string, orderedIds: number[]) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const owned = new Set(
    repos.categories.listCategories(db(), guildId).map((c) => c.id),
  );
  const ids = orderedIds.filter((id) => owned.has(id));
  if (ids.length !== owned.size) return { ok: false, error: "Stale list" };
  repos.categories.reorderCategories(db(), guildId, ids);
  audit(guildId, userId, "category.reorder", "Reordered categories");
  rev(guildId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

export interface PanelPayload {
  channelId?: string | null;
  style: PanelStyle;
  dropdownPlaceholder?: string | null;
  embed: EmbedConfig;
  buttons: Record<string, ButtonConfig>;
  categoryIds: number[];
}

export async function createPanel(guildId: string) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const panel = repos.panels.createPanel(db(), guildId, {});
  audit(guildId, userId, "panel.create", `Created panel #${panel.id}`);
  rev(guildId);
  return { ok: true, id: panel.id };
}

export async function savePanel(
  guildId: string,
  panelId: number,
  payload: PanelPayload,
) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const existing = repos.panels.getPanel(db(), panelId);
  if (!existing || existing.guildId !== guildId) {
    return { ok: false, error: "Not found" };
  }
  repos.panels.updatePanel(db(), panelId, payload);
  audit(guildId, userId, "panel.update", `Saved panel #${panelId} (draft)`);
  void cleanupOrphanUploads(guildId);
  rev(guildId);
  return { ok: true };
}

export async function publishPanel(guildId: string, panelId: number) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const panel = repos.panels.getPanel(db(), panelId);
  if (!panel || panel.guildId !== guildId) {
    return { ok: false, error: "Not found" };
  }
  if (!panel.channelId) {
    return { ok: false, error: "Choose a target channel first" };
  }
  repos.panels.updatePanel(db(), panelId, { status: "published" });
  await enqueueJob(guildId, panel.messageId ? "edit_panel" : "repost_panel", {
    panelId,
  });
  audit(guildId, userId, "panel.publish", `Published panel #${panelId}`);
  rev(guildId);
  return { ok: true };
}

export async function deletePanel(guildId: string, panelId: number) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const panel = repos.panels.getPanel(db(), panelId);
  if (panel?.guildId === guildId) {
    repos.panels.deletePanel(db(), panelId);
    audit(guildId, userId, "panel.delete", `Deleted panel #${panelId}`);
    rev(guildId);
  }
  return { ok: true };
}

/**
 * Replace one panel's ordered category list — used by the board view for
 * assign / unassign / reorder. Re-posts the panel if it's already live.
 */
export async function setPanelCategorySet(
  guildId: string,
  panelId: number,
  categoryIds: number[],
) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const panel = repos.panels.getPanel(db(), panelId);
  if (!panel || panel.guildId !== guildId) {
    return { ok: false, error: "Not found" };
  }

  const valid = new Set(
    repos.categories.listCategories(db(), guildId).map((c) => c.id),
  );
  const next = [...new Set(categoryIds)].filter((id) => valid.has(id));

  repos.panels.setPanelCategories(db(), panelId, next);
  for (const id of panel.categoryIds) {
    if (!next.includes(id)) {
      repos.panelStats.clearPanelCategory(db(), panelId, id);
    }
  }

  if (panel.status === "published" && panel.messageId) {
    await enqueueJob(guildId, "edit_panel", { panelId });
  }

  audit(
    guildId,
    userId,
    "panel.categories",
    `Set ${panel.embed.title || `panel #${panel.id}`} to ${next.length} ticket type(s)`,
  );
  rev(guildId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Open tickets (live console)
// ---------------------------------------------------------------------------

export async function setTicketPriority(
  guildId: string,
  ticketId: number,
  priority: string,
) {
  const { userId } = await requireGuildAccess(guildId);
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  if (!TICKET_PRIORITIES.includes(priority as TicketPriority)) {
    return { ok: false, error: "Invalid priority" };
  }
  const tk = repos.tickets.getTicket(db(), ticketId);
  if (!tk || tk.guildId !== guildId || tk.status === "closed") {
    return { ok: false, error: "Ticket not found or already closed" };
  }
  repos.tickets.setPriority(db(), ticketId, priority as TicketPriority);
  audit(
    guildId,
    userId,
    "ticket.priority",
    `Set ticket #${tk.number} priority to ${priority}`,
  );
  rev(guildId);
  return { ok: true };
}

export async function claimTicketAdmin(guildId: string, ticketId: number) {
  const { userId } = await requireGuildAccess(guildId);
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const tk = repos.tickets.getTicket(db(), ticketId);
  if (!tk || tk.guildId !== guildId || tk.status === "closed") {
    return { ok: false, error: "Ticket not found or already closed" };
  }
  if (tk.claimedBy) return { ok: false, error: "Already claimed" };
  await enqueueJob(guildId, "admin_claim_ticket", {
    ticketId,
    staffId: userId,
  });
  audit(
    guildId,
    userId,
    "ticket.claim",
    `Claimed ticket #${tk.number} from the dashboard`,
  );
  rev(guildId);
  return { ok: true };
}

export async function closeTicketAdmin(
  guildId: string,
  ticketId: number,
  reason?: string,
) {
  const { userId } = await requireGuildAccess(guildId);
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const tk = repos.tickets.getTicket(db(), ticketId);
  if (!tk || tk.guildId !== guildId || tk.status === "closed") {
    return { ok: false, error: "Ticket not found or already closed" };
  }
  await enqueueJob(guildId, "admin_close_ticket", {
    ticketId,
    closedBy: userId,
    reason: reason?.trim() || undefined,
  });
  audit(
    guildId,
    userId,
    "ticket.close",
    `Closed ticket #${tk.number} from the dashboard`,
  );
  rev(guildId);
  return { ok: true };
}

export async function sendTest(
  guildId: string,
  channelId: string,
  embed: EmbedConfig,
) {
  await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  if (!channelId) return { ok: false, error: "Pick a channel" };
  if (!hit(`test:${guildId}`, 15_000)) {
    return { ok: false, error: "Wait a few seconds between test sends." };
  }
  await enqueueJob(guildId, "post_preview", { channelId, embed });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Messages (guild-level embeds)
// ---------------------------------------------------------------------------

export async function saveMessages(
  guildId: string,
  payload: {
    welcomeEmbed: EmbedConfig | null;
    closeEmbed: EmbedConfig | null;
    feedbackPromptEmbed: EmbedConfig | null;
  },
) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  repos.guildConfig.updateGuildConfig(db(), guildId, payload);
  audit(
    guildId,
    userId,
    "messages.update",
    "Updated welcome / close / feedback embeds",
  );
  void cleanupOrphanUploads(guildId);
  rev(guildId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Blacklist
// ---------------------------------------------------------------------------

export async function addBlacklist(
  guildId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await requireGuildAccess(guildId, "admin");
  if (isSuspended(guildId)) return { ok: false, message: SUSPENDED_MSG };
  const userId = String(form.get("userId") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!userId) {
    fieldErrors.userId = "Enter a Discord user ID";
  } else if (!SNOWFLAKE.test(userId)) {
    fieldErrors.userId =
      "That doesn’t look like a Discord user ID (15–20 digits)";
  }
  if (reason.length > 500) {
    fieldErrors.reason = "Keep the reason under 500 characters";
  }
  if (Object.keys(fieldErrors).length > 0) return err(fieldErrors);

  const already = repos.blacklist.isBlacklisted(db(), guildId, userId);
  repos.blacklist.addToBlacklist(
    db(),
    guildId,
    userId,
    session.userId,
    reason || null,
  );
  audit(
    guildId,
    session.userId,
    "blacklist.add",
    `${already ? "Updated" : "Blocked"} user ${userId}`,
  );
  rev(guildId);
  return ok(already ? "Updated existing entry" : "User blocked");
}

export async function removeBlacklist(
  guildId: string,
  userId: string,
): Promise<void> {
  const session = await requireGuildAccess(guildId, "admin");
  if (isSuspended(guildId)) return;
  repos.blacklist.removeFromBlacklist(db(), guildId, userId);
  audit(
    guildId,
    session.userId,
    "blacklist.remove",
    `Unblocked user ${userId}`,
  );
  rev(guildId);
}

// ---------------------------------------------------------------------------
// Snippets (canned responses)
// ---------------------------------------------------------------------------

const SNIPPET_NAME = /^[a-z0-9][a-z0-9_-]{0,49}$/;
const MAX_SNIPPETS = 100;
const MAX_SNIPPET_ATTACHMENTS = 5;

/** Keep only `/u/<thisGuild>/<file>` URLs, de-duped, capped. */
function sanitizeAttachments(guildId: string, raw: unknown): string[] {
  const re = new RegExp(`^/u/${guildId}/[A-Za-z0-9._-]+$`);
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const v of list) {
    if (typeof v === "string" && re.test(v) && !out.includes(v)) out.push(v);
  }
  return out.slice(0, MAX_SNIPPET_ATTACHMENTS);
}

export async function createSnippetFromForm(
  guildId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, message: SUSPENDED_MSG };

  const name = String(form.get("name") ?? "")
    .trim()
    .toLowerCase();
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Name is required";
  else if (!SNIPPET_NAME.test(name))
    fieldErrors.name =
      "Lowercase letters, numbers, - or _ (max 50, can’t start with - or _)";

  if (
    !fieldErrors.name &&
    repos.snippets.getSnippetByName(db(), guildId, name)
  ) {
    fieldErrors.name = `A snippet named “${name}” already exists`;
  }
  if (
    !fieldErrors.name &&
    repos.snippets.countSnippets(db(), guildId) >= MAX_SNIPPETS
  ) {
    fieldErrors.name = `This server already has ${MAX_SNIPPETS} snippets`;
  }
  if (Object.keys(fieldErrors).length > 0) return err(fieldErrors);

  const snip = repos.snippets.createSnippet(db(), guildId, {
    name,
    createdBy: userId,
  });
  audit(guildId, userId, "snippet.create", `Created snippet “${name}”`);
  rev(guildId);
  redirect(`/dashboard/${guildId}/snippets/${snip.id}`);
}

export async function saveSnippet(
  guildId: string,
  id: number,
  payload: { name?: string; content?: string; attachments?: string[] },
) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const existing = repos.snippets.getSnippet(db(), id);
  if (!existing || existing.guildId !== guildId) {
    return { ok: false, error: "Not found" };
  }

  const patch: { name?: string; content?: string; attachments?: string[] } = {};

  if (payload.name != null) {
    const name = payload.name.trim().toLowerCase();
    if (!SNIPPET_NAME.test(name)) {
      return { ok: false, error: "Invalid snippet name" };
    }
    const clash = repos.snippets.getSnippetByName(db(), guildId, name);
    if (clash && clash.id !== id) {
      return { ok: false, error: `A snippet named “${name}” already exists` };
    }
    patch.name = name;
  }

  if (payload.content != null) {
    if (payload.content.length > 2000) {
      return { ok: false, error: "Keep snippet text under 2000 characters" };
    }
    patch.content = payload.content;
  }

  if (payload.attachments != null) {
    patch.attachments = sanitizeAttachments(guildId, payload.attachments);
  }

  repos.snippets.updateSnippet(db(), id, patch);
  audit(
    guildId,
    userId,
    "snippet.update",
    `Updated snippet “${patch.name ?? existing.name}”`,
  );
  void cleanupOrphanUploads(guildId);
  rev(guildId);
  return { ok: true };
}

export async function deleteSnippet(guildId: string, id: number) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const existing = repos.snippets.getSnippet(db(), id);
  if (existing?.guildId === guildId) {
    repos.snippets.deleteSnippet(db(), id);
    audit(
      guildId,
      userId,
      "snippet.delete",
      `Deleted snippet “${existing.name}”`,
    );
    void cleanupOrphanUploads(guildId);
    rev(guildId);
  }
  return { ok: true };
}

export async function refreshDiscordCaches(guildId: string) {
  await requireGuildAccess(guildId, "editor");
  bustDiscordCache(`roles:${guildId}`);
  bustDiscordCache(`channels:${guildId}`);
  rev(guildId);
  return { ok: true };
}

/** Move this user's notification "seen up to here" marker to now. */
export async function markNotificationsRead(guildId: string) {
  const { userId } = await requireGuildAccess(guildId);
  repos.notifications.markAllRead(db(), guildId, userId);
  rev(guildId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export interface ApplicationPayload {
  name: string;
  channelId: string | null;
  embed: EmbedConfig;
  buttonLabel: string;
  questions: FormField[];
  reviewerRoleIds: string[];
  grantRoleIds: string[];
  logChannelId: string | null;
  eligibility: {
    minAccountDays?: number;
    minMemberDays?: number;
    requiredRoleIds?: string[];
    blockedRoleIds?: string[];
  } | null;
  maxOpenPerUser: number;
}

export async function createApplication(guildId: string) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const app = repos.applications.createApplication(db(), guildId, {
    createdBy: userId,
  });
  audit(
    guildId,
    userId,
    "application.create",
    `Created application #${app.id}`,
  );
  rev(guildId);
  return { ok: true, id: app.id };
}

export async function saveApplication(
  guildId: string,
  id: number,
  payload: ApplicationPayload,
) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const existing = repos.applications.getApplication(db(), id);
  if (!existing || existing.guildId !== guildId) {
    return { ok: false, error: "Not found" };
  }
  repos.applications.updateApplication(db(), id, {
    name: payload.name.slice(0, 100) || "Staff application",
    channelId: payload.channelId,
    embed: payload.embed,
    buttonLabel: payload.buttonLabel.slice(0, 80) || "Apply",
    questions: payload.questions.slice(0, 5),
    reviewerRoleIds: payload.reviewerRoleIds,
    grantRoleIds: payload.grantRoleIds,
    logChannelId: payload.logChannelId,
    eligibility: payload.eligibility,
    maxOpenPerUser: Math.max(1, Math.min(10, payload.maxOpenPerUser || 1)),
  });
  audit(guildId, userId, "application.update", `Saved application #${id}`);
  if (existing.status === "published" && existing.messageId) {
    await enqueueJob(guildId, "repost_application", { applicationId: id });
  }
  rev(guildId);
  return { ok: true };
}

export async function publishApplication(guildId: string, id: number) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const app = repos.applications.getApplication(db(), id);
  if (!app || app.guildId !== guildId) return { ok: false, error: "Not found" };
  if (!app.channelId)
    return { ok: false, error: "Choose a channel to post in" };
  if (!app.logChannelId)
    return { ok: false, error: "Set a review channel first" };
  if (app.reviewerRoleIds.length === 0)
    return { ok: false, error: "Add at least one reviewer role" };
  repos.applications.updateApplication(db(), id, { status: "published" });
  await enqueueJob(guildId, "repost_application", { applicationId: id });
  audit(guildId, userId, "application.publish", `Published application #${id}`);
  rev(guildId);
  return { ok: true };
}

export async function deleteApplication(guildId: string, id: number) {
  const { userId } = await requireGuildAccess(guildId, "editor");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const app = repos.applications.getApplication(db(), id);
  if (app?.guildId === guildId) {
    repos.applications.deleteApplication(db(), id);
    audit(guildId, userId, "application.delete", `Deleted application #${id}`);
    rev(guildId);
  }
  return { ok: true };
}

/** Approve or deny a submission from the dashboard. Reviewers + editors only. */
export async function decideSubmissionAction(
  guildId: string,
  submissionId: number,
  decision: "approved" | "denied",
  reason?: string,
) {
  const { userId, level } = await requireGuildAccess(guildId, "console");
  if (isSuspended(guildId)) return { ok: false, error: SUSPENDED_MSG };
  const sub = repos.applications.getSubmission(db(), submissionId);
  if (!sub || sub.guildId !== guildId || sub.status !== "pending") {
    return { ok: false, error: "Already decided or not found" };
  }
  const app = repos.applications.getApplication(db(), sub.applicationId);
  if (!app) return { ok: false, error: "Not found" };

  if (level === "console") {
    const roles = await getGuildMemberRoles(guildId, userId).catch(
      (): string[] => [],
    );
    if (!app.reviewerRoleIds.some((r) => roles.includes(r))) {
      return { ok: false, error: "You're not a reviewer for this application" };
    }
  }

  repos.applications.decideSubmission(
    db(),
    submissionId,
    decision,
    userId,
    reason?.trim() || null,
  );
  await enqueueJob(guildId, "decide_application", {
    submissionId,
    decision,
    reviewerId: userId,
    reason: reason?.trim() || undefined,
  });
  audit(
    guildId,
    userId,
    "application.decide",
    `${decision === "approved" ? "Approved" : "Denied"} application submission #${submissionId}`,
  );
  rev(guildId);
  return { ok: true };
}

/** Grant or revoke a Discord role's dashboard access. `level: "none"` removes it. */
export async function setDashboardGrant(
  guildId: string,
  roleId: string,
  level: string,
) {
  const { userId } = await requireGuildAccess(guildId, "admin");
  if (!SNOWFLAKE.test(roleId)) return { ok: false, error: "Invalid role" };

  if (level === "none") {
    repos.dashboardGrants.removeGrant(db(), guildId, roleId);
    audit(
      guildId,
      userId,
      "permissions.revoke",
      `Removed dashboard access for role ${roleId}`,
    );
  } else if ((DASHBOARD_LEVELS as string[]).includes(level)) {
    repos.dashboardGrants.setGrant(
      db(),
      guildId,
      roleId,
      level as DashboardLevel,
    );
    audit(
      guildId,
      userId,
      "permissions.grant",
      `Set role ${roleId} dashboard access to ${level}`,
    );
  } else {
    return { ok: false, error: "Invalid level" };
  }
  rev(guildId);
  return { ok: true };
}
