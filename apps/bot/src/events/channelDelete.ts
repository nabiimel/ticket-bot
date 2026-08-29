import {
  Events,
  type DMChannel,
  type NonThreadGuildBasedChannel,
} from "discord.js";
import { repos } from "@ticketbot/db";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";

export const name = Events.ChannelDelete;

/**
 * If a ticket channel is removed (manually, or a race with our own delete),
 * close the ticket row so it stops counting against the opener's open limit.
 */
export async function execute(
  channel: DMChannel | NonThreadGuildBasedChannel,
): Promise<void> {
  if (channel.isDMBased?.()) return;
  const db = getDb();
  const ticket = repos.tickets.getTicketByChannel(db, channel.id);
  if (!ticket || ticket.status === "closed") return;
  repos.tickets.markAbandoned(db, ticket.id, "Ticket channel was deleted");
  logger.info(
    `Ticket #${ticket.number} closed — channel ${channel.id} deleted`,
  );
}
