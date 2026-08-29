/**
 * Canonical list of template placeholders available in dashboard-authored text
 * (embed titles/descriptions, footers, etc). Rendered by `renderTemplate`.
 *
 * The dashboard shows this list as a reference panel next to the editor.
 */
export interface PlaceholderDoc {
  token: string;
  description: string;
}

export const PLACEHOLDERS: PlaceholderDoc[] = [
  { token: "{user}", description: "The ticket opener's display name" },
  { token: "{user.mention}", description: "Pings the ticket opener" },
  { token: "{user.id}", description: "The opener's Discord user id" },
  {
    token: "{user.tag}",
    description: "The opener's username#0000 / @username",
  },
  {
    token: "{ticket.number}",
    description: "Sequential ticket number, e.g. 42",
  },
  { token: "{ticket.id}", description: "Internal ticket id" },
  { token: "{category.name}", description: "The ticket category label" },
  { token: "{category.key}", description: "The ticket category key" },
  { token: "{guild.name}", description: "The server name" },
  { token: "{guild.id}", description: "The server id" },
  {
    token: "{claimed_by}",
    description: "Display name of the staff member who claimed",
  },
  {
    token: "{claimed_by.mention}",
    description: "Pings the staff member who claimed",
  },
  {
    token: "{closed_by}",
    description: "Name of who closed the ticket (close message only)",
  },
  { token: "{reason}", description: "Close reason (close message only)" },
  { token: "{date}", description: "Current date (YYYY-MM-DD)" },
  {
    token: "{form.<key>}",
    description: "A ticket-open form answer, by its field key",
  },
  { token: "{form.all}", description: "All form answers as a bulleted list" },
];

/** Flat context object consumed by `renderTemplate`. */
export interface TemplateContext {
  user?: string;
  "user.mention"?: string;
  "user.id"?: string;
  "user.tag"?: string;
  "ticket.number"?: string | number;
  "ticket.id"?: string | number;
  "category.name"?: string;
  "category.key"?: string;
  "guild.name"?: string;
  "guild.id"?: string;
  claimed_by?: string;
  "claimed_by.mention"?: string;
  reason?: string;
  date?: string;
  [key: string]: string | number | undefined;
}

/** A representative context used for the dashboard live preview. */
export const PREVIEW_CONTEXT: TemplateContext = {
  user: "PreviewUser",
  "user.mention": "@PreviewUser",
  "user.id": "000000000000000000",
  "user.tag": "@previewuser",
  "ticket.number": 42,
  "ticket.id": 42,
  "category.name": "Support",
  "category.key": "support",
  "guild.name": "Your Server",
  "guild.id": "111111111111111111",
  claimed_by: "StaffMember",
  "claimed_by.mention": "@StaffMember",
  reason: "Issue resolved",
  closed_by: "StaffMember",
  date: new Date().toISOString().slice(0, 10),
  "form.all": "**Question:** Sample answer",
};
