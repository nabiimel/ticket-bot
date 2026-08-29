import {
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
} from "discord.js";
import type { CategoryConfig, GuildConfig } from "@ticketbot/shared";

/**
 * Re-check Manage Server inside admin command handlers. `setDefaultMemberPermissions`
 * is only a default that a guild owner can loosen, so don't rely on it alone.
 * Returns true when allowed; otherwise replies and returns false.
 */
export async function assertManageGuild(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  await interaction.reply({
    content: "You need the Manage Server permission to use this command.",
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

/** Roles that can act as staff for a given category (category roles + guild default). */
export function staffRoleIdsFor(
  guildConfig: GuildConfig,
  category: CategoryConfig | null,
): string[] {
  const ids = new Set<string>();
  if (guildConfig.defaultStaffRoleId) ids.add(guildConfig.defaultStaffRoleId);
  for (const r of category?.staffRoleIds ?? []) ids.add(r);
  return [...ids];
}

/** Is this member allowed to manage tickets in this category? */
export function isStaff(
  member: GuildMember,
  guildConfig: GuildConfig,
  category: CategoryConfig | null,
): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const staffRoles = staffRoleIdsFor(guildConfig, category);
  return staffRoles.some((id) => member.roles.cache.has(id));
}

/** Permission overwrites for a new ticket channel. */
export function buildTicketOverwrites(
  guild: Guild,
  openerId: string,
  staffRoleIds: string[],
  extraUserIds: string[] = [],
): OverwriteResolvable[] {
  const allow =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.ReadMessageHistory |
    PermissionFlagsBits.AttachFiles |
    PermissionFlagsBits.EmbedLinks;

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: PermissionFlagsBits.ViewChannel },
    { id: openerId, allow },
  ];
  for (const roleId of staffRoleIds) {
    if (guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow });
  }
  for (const uid of extraUserIds) overwrites.push({ id: uid, allow });
  if (guild.members.me) {
    overwrites.push({
      id: guild.members.me.id,
      allow:
        allow |
        PermissionFlagsBits.ManageChannels |
        PermissionFlagsBits.ManageRoles,
    });
  }
  return overwrites;
}
