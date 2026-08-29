import { Events, type Client } from "discord.js";
import { repos } from "@ticketbot/db";
import { getDb } from "../lib/db.js";
import { logger } from "../lib/logger.js";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>): Promise<void> {
  logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);

  const db = getDb();

  // Sweep current guilds so the dashboard knows where the bot is.
  const seen = new Set<string>();
  for (const [, guild] of client.guilds.cache) {
    seen.add(guild.id);
    repos.guilds.markGuildPresent(db, guild.id, guild.name, guild.iconURL());
    repos.guildConfig.ensureGuildConfig(db, guild.id);
  }
  for (const g of repos.guilds.listPresentGuilds(db)) {
    if (!seen.has(g.guildId)) repos.guilds.markGuildRemoved(db, g.guildId);
  }
  logger.info(`Serving ${seen.size} guild(s)`);

  // Reconcile: close ticket rows whose channels no longer exist (deleted while
  // the bot was offline, or a lost delete during a previous close).
  let reconciled = 0;
  for (const [, guild] of client.guilds.cache) {
    for (const ticket of repos.tickets.listOpenTickets(db, guild.id)) {
      const exists =
        guild.channels.cache.has(ticket.channelId) ||
        (await guild.channels.fetch(ticket.channelId).catch(() => null)) !=
          null;
      if (!exists) {
        repos.tickets.markAbandoned(
          db,
          ticket.id,
          "Channel missing on startup",
        );
        reconciled++;
      }
    }
  }
  if (reconciled > 0)
    logger.info(`Reconciled ${reconciled} orphaned ticket(s)`);
}
