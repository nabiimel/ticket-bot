import type { Guild, GuildMember, User } from "discord.js";
import type {
  CategoryConfig,
  TemplateContext,
  TicketRecord,
} from "@ticketbot/shared";

interface BuildArgs {
  guild: Guild;
  opener?: User | GuildMember | null;
  category?: CategoryConfig | null;
  ticket?: TicketRecord | null;
  claimedBy?: User | GuildMember | null;
  reason?: string | null;
}

function asUser(u: User | GuildMember | null | undefined): User | null {
  if (!u) return null;
  return "user" in u ? u.user : u;
}

/** Build the placeholder context used to render dashboard-authored templates. */
export function buildContext(args: BuildArgs): TemplateContext {
  const opener = asUser(args.opener);
  const claimed = asUser(args.claimedBy);
  const ctx: TemplateContext = {
    "guild.name": args.guild.name,
    "guild.id": args.guild.id,
    date: new Date().toISOString().slice(0, 10),
  };
  if (opener) {
    ctx["user"] = opener.displayName ?? opener.username;
    ctx["user.mention"] = `<@${opener.id}>`;
    ctx["user.id"] = opener.id;
    ctx["user.tag"] = `@${opener.username}`;
  }
  if (args.category) {
    ctx["category.name"] = args.category.label;
    ctx["category.key"] = args.category.key;
  }
  if (args.ticket) {
    ctx["ticket.number"] = args.ticket.number;
    ctx["ticket.id"] = args.ticket.id;
  }
  if (claimed) {
    ctx["claimed_by"] = claimed.displayName ?? claimed.username;
    ctx["claimed_by.mention"] = `<@${claimed.id}>`;
    ctx["claimed_by.tag"] = `@${claimed.username}`;
  }
  if (args.reason != null) ctx["reason"] = args.reason || "No reason given";
  return ctx;
}
