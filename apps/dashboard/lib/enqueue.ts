import "server-only";
import type { JobType } from "@ticketbot/shared";
import { db, repos } from "./db";

/**
 * Insert a job for the bot and immediately poke its internal HTTP endpoint so
 * it's processed without waiting for the 3s poll. The poke is best-effort.
 */
export async function enqueueJob(
  guildId: string,
  type: JobType,
  payload: unknown,
): Promise<void> {
  repos.jobs.enqueueJob(db(), guildId, type, payload);
  const url = process.env.BOT_INTERNAL_URL;
  const secret = process.env.INTERNAL_WAKE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(`${url}/internal/wake`, {
      method: "POST",
      headers: { "x-wake-secret": secret },
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* bot will pick it up on the next poll */
  }
}
