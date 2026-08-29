import type { ButtonConfig, EmbedConfig } from "./types.js";

export const BLURPLE = "#5865F2";
export const GREEN = "#57F287";
export const RED = "#ED4245";

/** Default embed for a freshly created panel. */
export const DEFAULT_PANEL_EMBED: EmbedConfig = {
  title: "Need help?",
  description:
    "Click the button below to open a ticket. Our staff team will be with you as soon as possible.",
  color: BLURPLE,
};

/** Default in-ticket welcome embed (guild-level; categories may override). */
export const DEFAULT_WELCOME_EMBED: EmbedConfig = {
  title: "Ticket #{ticket.number}",
  description:
    "Thanks for reaching out, {user.mention}. Staff have been notified and will be with you shortly.\nPlease describe your issue in as much detail as you can.",
  color: BLURPLE,
  timestamp: true,
};

/** Default DM embed sent to the opener when a ticket closes. */
export const DEFAULT_CLOSE_EMBED: EmbedConfig = {
  title: "Your ticket in {guild.name} was closed",
  description:
    "Ticket #{ticket.number} has been closed.\nA transcript of the conversation is attached below.",
  color: RED,
  timestamp: true,
};

/** Default feedback prompt embed. */
export const DEFAULT_FEEDBACK_EMBED: EmbedConfig = {
  title: "How did we do?",
  description:
    "Please rate the support you received for ticket #{ticket.number} using the buttons below.",
  color: BLURPLE,
};

/** Default per-category button styling on a panel. */
export const DEFAULT_BUTTON_CONFIG: ButtonConfig = {
  label: "Open Ticket",
  style: "Primary",
};

export const DEFAULT_NAMING_SCHEME = "ticket-{number}";

/** A handful of common emoji for the category quick-pick. */
export const QUICK_EMOJI = [
  "🎫",
  "🛟",
  "❓",
  "💬",
  "⚠️",
  "🐛",
  "💡",
  "🔧",
  "📦",
  "💳",
  "🚨",
  "🔒",
  "📣",
  "🤝",
  "⭐",
  "📝",
];

const CUSTOM_EMOJI = /^<a?:[a-zA-Z0-9_]{2,32}:\d{15,20}>$/;
// At least one pictographic or regional-indicator (flag) code point.
const UNICODE_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Accepts a single unicode emoji or a Discord custom emoji token `<:name:id>`. */
export function isValidEmoji(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  if (CUSTOM_EMOJI.test(s)) return true;
  return UNICODE_EMOJI.test(s) && [...s].length <= 8;
}
