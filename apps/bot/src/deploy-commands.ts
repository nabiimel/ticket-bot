import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commands } from "./commands/index.js";

const body = commands.map((c) => c.data.toJSON());
const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

const route = config.devGuildId
  ? Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.devGuildId)
  : Routes.applicationCommands(config.DISCORD_CLIENT_ID);

const scope = config.devGuildId ? `guild ${config.devGuildId}` : "global";
console.log(`Registering ${body.length} command(s) to ${scope}…`);
await rest.put(route, { body });
console.log("Done.");
