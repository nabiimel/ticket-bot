import type { SlashCommand } from "../registry.js";
import { ticketSetupCommand } from "./ticket-setup.js";
import { ticketCategoryCommand } from "./ticket-category.js";
import { ticketPanelCommand } from "./ticket-panel.js";
import { ticketCommand } from "./ticket.js";
import { ticketBlacklistCommand } from "./ticket-blacklist.js";
import { ticketStatsCommand } from "./ticket-stats.js";

export const commands: SlashCommand[] = [
  ticketSetupCommand,
  ticketCategoryCommand,
  ticketPanelCommand,
  ticketCommand,
  ticketBlacklistCommand,
  ticketStatsCommand,
];

export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
