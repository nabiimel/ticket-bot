import { Events, type Message } from "discord.js";
import { repos } from "@ticketbot/db";
import { getDb } from "../lib/db.js";
import {
  getCategoriesCached,
  getGuildConfigCached,
} from "../lib/configCache.js";
import { isStaff } from "../lib/permissions.js";

export const name = Events.MessageCreate;

export async function execute(message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;
  const db = getDb();
  const ticket = repos.tickets.getTicketByChannel(db, message.channelId);
  if (!ticket || ticket.status === "closed") return;

  let staff = false;
  // The opener answering their own ticket is never a "staff first reply".
  if (message.author.id !== ticket.openerId) {
    try {
      const guildConfig = getGuildConfigCached(message.guildId);
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
  }

  repos.tickets.bumpActivity(db, message.channelId, { staff });
}
