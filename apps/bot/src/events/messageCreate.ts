import { Events, type Message } from "discord.js";
import { repos } from "@ticketbot/db";
import { getDb } from "../lib/db.js";
import {
  getCategoriesCached,
  getGuildConfigCached,
} from "../lib/configCache.js";
import { isStaff } from "../lib/permissions.js";
import { handlePingGuard } from "../lib/pingGuard.js";
import { logger } from "../lib/logger.js";
import { PREFIX } from "../music/prefix.js";
import { musicCommandMap } from "../music/commands/index.js";

export const name = Events.MessageCreate;

export async function execute(message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;

  if (message.content.startsWith(PREFIX)) {
    const [rawName, ...args] = message.content
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);
    const command = rawName
      ? musicCommandMap.get(rawName.toLowerCase())
      : undefined;
    if (command) {
      try {
        await command.execute(message, args);
      } catch (err) {
        logger.error("music command failed", err);
      }
      return;
    }
  }

  const db = getDb();
  const ticket = repos.tickets.getTicketByChannel(db, message.channelId);
  if (!ticket || ticket.status === "closed") return;

  const guildConfig = getGuildConfigCached(message.guildId);

  let staff = false;
  // The opener answering their own ticket is never a "staff first reply".
  if (message.author.id !== ticket.openerId) {
    try {
      const category =
        getCategoriesCached(message.guildId).find(
          (c) => c.id === ticket.categoryId,
        ) ?? null;
      const member =
        message.member ??
        (await message.guild.members.fetch(message.author.id));
      staff = isStaff(member, guildConfig, category);
    } catch {
      /* ignore lookup failures, still bump activity */
    }
  } else {
    // Ticket opener — check for seller ping-spam.
    await handlePingGuard(message, guildConfig).catch(() => {});
  }

  repos.tickets.bumpActivity(db, message.channelId, { staff });
}
