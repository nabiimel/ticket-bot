import type { GuildTextBasedChannel } from "discord.js";
import { t, type GuildConfig, type TicketRecord } from "@ticketbot/shared";
import { repos } from "@ticketbot/db";
import { getDb } from "./db.js";
import {
  buildPipelineEmbed,
  buildTicketControls,
  type PipelineStage,
} from "./embeds.js";

/**
 * Current pipeline stage for a ticket. A ticket is on the "reservation" track
 * once it has (or is meant to get) a reservation — either one already exists,
 * or the buyer answered "Yes" to the "is this a reservation?" prompt. Every
 * other ticket (no reservation prompt, or the buyer said they're buying right
 * now) is "direct": no Reserved step, and "done" means the ticket got closed
 * rather than a reservation being marked fulfilled.
 */
export function computePipelineStage(ticket: TicketRecord): PipelineStage {
  const db = getDb();
  const reservation = repos.reservations.getByTicket(db, ticket.id);
  const active = reservation && reservation.status !== "cancelled";
  const wantsReservation = repos.tickets
    .getFormResponses(db, ticket.id)
    .some((r) => r.fieldKey === "is_reservation" && r.value === "Yes");
  const track: PipelineStage["track"] =
    active || wantsReservation ? "reservation" : "direct";
  return {
    track,
    reserved: !!active,
    paid: ticket.paid,
    done:
      track === "reservation"
        ? reservation?.status === "done"
        : ticket.status === "closed",
  };
}

/**
 * The full payload for a ticket's controls message: the pipeline status embed
 * plus the Claim/Reserve/Close buttons. `stageOverride` lets a caller supply a
 * value that hasn't landed in `ticket`/the DB yet (e.g. `paid` mid-toggle) so
 * the render doesn't need a re-fetch.
 */
export function buildControlsPayload(
  ticket: TicketRecord,
  guildConfig: GuildConfig,
  stageOverride: Partial<PipelineStage> = {},
) {
  const stage = { ...computePipelineStage(ticket), ...stageOverride };
  return {
    content: t("ticket.controlsLabel", guildConfig.language),
    embeds: [buildPipelineEmbed(stage)],
    components: [
      buildTicketControls(ticket.id, {
        claimed: !!ticket.claimedBy,
        claimEnabled: guildConfig.claimingEnabled,
        reserved: stage.reserved,
      }),
    ],
  };
}

/**
 * Re-render the controls message's pipeline embed + buttons in place (edit,
 * not delete+resend — the message doesn't need to move just because a stage
 * changed). No-op if the ticket has no tracked controls message.
 */
export async function refreshTicketPipeline(
  channel: GuildTextBasedChannel,
  ticket: TicketRecord,
  guildConfig: GuildConfig,
  stageOverride: Partial<PipelineStage> = {},
): Promise<void> {
  if (!ticket.controlsMessageId) return;
  const payload = buildControlsPayload(ticket, guildConfig, stageOverride);
  await channel.messages
    .fetch(ticket.controlsMessageId)
    .then((m) => m.edit(payload))
    .catch(() => {});
}
