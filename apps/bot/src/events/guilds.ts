import { Events, type Guild } from "discord.js";
import { repos } from "@ticketbot/db";
import { getDb } from "../lib/db.js";
import { bustConfigCache } from "../lib/configCache.js";
import { logger } from "../lib/logger.js";

export const guildCreate = {
  name: Events.GuildCreate as const,
  execute(guild: Guild) {
    const db = getDb();
    repos.guilds.markGuildPresent(db, guild.id, guild.name, guild.icon);
    repos.guildConfig.ensureGuildConfig(db, guild.id);
    bustConfigCache(guild.id);
    logger.info(`Joined guild ${guild.name} (${guild.id})`);
  },
};

export const guildDelete = {
  name: Events.GuildDelete as const,
  execute(guild: Guild) {
    repos.guilds.markGuildRemoved(getDb(), guild.id);
    bustConfigCache(guild.id);
    logger.info(`Removed from guild ${guild.id}`);
  },
};
