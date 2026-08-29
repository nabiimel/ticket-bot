import { Events, MessageFlags, type Interaction } from "discord.js";
import { commandMap } from "../commands/index.js";
import {
  buttonHandlers,
  modalHandlers,
  selectHandlers,
} from "../interactions/index.js";
import { parseCustomId } from "../registry.js";
import { logger } from "../lib/logger.js";

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      const { prefix, args } = parseCustomId(interaction.customId);
      const handler = buttonHandlers.find((h) => h.prefix === prefix);
      if (handler) await handler.run(interaction, args);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const { prefix, args } = parseCustomId(interaction.customId);
      const handler = selectHandlers.find((h) => h.prefix === prefix);
      if (handler) await handler.run(interaction, args);
      return;
    }

    if (interaction.isModalSubmit()) {
      const { prefix, args } = parseCustomId(interaction.customId);
      const handler = modalHandlers.find((h) => h.prefix === prefix);
      if (handler) await handler.run(interaction, args);
      return;
    }
  } catch (err) {
    logger.error("interaction handler error", err);
    if (
      (interaction.isChatInputCommand() ||
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isModalSubmit()) &&
      !interaction.replied
    ) {
      const payload = {
        content: "Something went wrong handling that.",
        flags: MessageFlags.Ephemeral as const,
      };
      if (interaction.deferred) {
        await interaction
          .editReply({ content: payload.content })
          .catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  }
}
