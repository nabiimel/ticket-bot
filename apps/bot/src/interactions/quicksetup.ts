import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  RoleSelectMenuBuilder,
  type AnySelectMenuInteraction,
} from "discord.js";
import { DEFAULT_PANEL_EMBED } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import type { ComponentHandler } from "../registry.js";
import { getDb } from "../lib/db.js";
import { bustConfigCache } from "../lib/configCache.js";

/** In-progress wizards, keyed `guildId:userId`. Cleared on finish or TTL. */
const state = new Map<
  string,
  { roleIds: string[]; logChannelId?: string; at: number }
>();
const TTL_MS = 10 * 60_000;

function sweep() {
  const now = Date.now();
  for (const [k, v] of state) if (now - v.at > TTL_MS) state.delete(k);
}

const stepEmbed = (title: string, body: string) =>
  new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`⚡ Quick setup — ${title}`)
    .setDescription(body);

export function quicksetupStep1() {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("qs:roles")
      .setPlaceholder("Choose the roles that handle tickets")
      .setMinValues(1)
      .setMaxValues(10),
  );
}

function step2() {
  return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("qs:log")
      .setPlaceholder("Choose a log channel")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

function step3() {
  return new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("qs:panel")
      .setPlaceholder("Choose where the ticket panel goes")
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

async function stale(i: AnySelectMenuInteraction) {
  await i.update({
    embeds: [
      stepEmbed(
        "expired",
        "This setup timed out. Run `/quicksetup` again to start over.",
      ),
    ],
    components: [],
  });
}

export const STEP1_EMBED = stepEmbed(
  "Step 1 of 3 · Staff roles",
  "Pick every role that should be able to see and reply to new tickets. Add as many as you need.",
);

export const quicksetupHandlers: ComponentHandler<AnySelectMenuInteraction>[] =
  [
    {
      prefix: "qs",
      async run(interaction, args) {
        if (!interaction.inCachedGuild()) return;
        sweep();
        const key = `${interaction.guildId}:${interaction.user.id}`;
        const sub = args[0];

        if (sub === "roles" && interaction.isRoleSelectMenu()) {
          state.set(key, { roleIds: [...interaction.values], at: Date.now() });
          await interaction.update({
            embeds: [
              stepEmbed(
                "Step 2 of 3 · Log channel",
                "Ticket opens and closes are posted here so you have a full record.",
              ),
            ],
            components: [step2()],
          });
          return;
        }

        if (sub === "log" && interaction.isChannelSelectMenu()) {
          const s = state.get(key);
          if (!s) return stale(interaction);
          s.logChannelId = interaction.values[0];
          s.at = Date.now();
          await interaction.update({
            embeds: [
              stepEmbed(
                "Step 3 of 3 · Panel channel",
                "The ticket panel — the message members click to open a ticket — is posted here.",
              ),
            ],
            components: [step3()],
          });
          return;
        }

        if (sub === "panel" && interaction.isChannelSelectMenu()) {
          const s = state.get(key);
          if (!s?.logChannelId) return stale(interaction);
          const panelChannelId = interaction.values[0]!;
          await interaction.deferUpdate();

          const db = getDb();
          const guildId = interaction.guildId;

          repos.guildConfig.updateGuildConfig(db, guildId, {
            logChannelId: s.logChannelId,
            defaultStaffRoleId: s.roleIds[0],
          });

          let cat = repos.categories
            .listCategories(db, guildId)
            .find((c) => c.key === "support");
          if (!cat) {
            cat = repos.categories.createCategory(db, guildId, {
              key: "support",
              label: "Support",
              staffRoleIds: s.roleIds,
              pingRoleIds: [],
              form: [],
            });
          }

          const panel = repos.panels.createPanel(db, guildId, {
            channelId: panelChannelId,
            style: "buttons",
            embed: DEFAULT_PANEL_EMBED,
            categoryIds: [cat.id],
            status: "published",
            createdBy: interaction.user.id,
          });

          bustConfigCache(guildId);
          repos.jobs.enqueueJob(db, guildId, "repost_panel", {
            panelId: panel.id,
          });
          state.delete(key);

          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x3ba55d)
                .setTitle("✅ Ticket system is live")
                .setDescription(
                  [
                    `**Staff roles:** ${s.roleIds.map((r) => `<@&${r}>`).join(" ")}`,
                    `**Log channel:** <#${s.logChannelId}>`,
                    `**Panel posted in:** <#${panelChannelId}>`,
                    "",
                    "Members can open a ticket now. Fine-tune everything — extra categories, forms, embeds — from the web dashboard.",
                  ].join("\n"),
                ),
            ],
            components: [],
          });
          return;
        }

        // Unknown / mismatched component type — ignore quietly.
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "That step is no longer active.",
            flags: MessageFlags.Ephemeral,
          });
        }
      },
    },
  ];
