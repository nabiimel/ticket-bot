import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { SlashCommand } from "../registry.js";
import { assertManageGuild } from "../lib/permissions.js";
import { STEP1_EMBED, quicksetupStep1 } from "../interactions/quicksetup.js";

const data = new SlashCommandBuilder()
  .setName("quicksetup")
  .setDescription("Set up a complete ticket system in three quick steps")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export const quicksetupCommand: SlashCommand = {
  data,
  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!(await assertManageGuild(interaction))) return;
    await interaction.reply({
      embeds: [STEP1_EMBED],
      components: [quicksetupStep1()],
      flags: MessageFlags.Ephemeral,
    });
  },
};
