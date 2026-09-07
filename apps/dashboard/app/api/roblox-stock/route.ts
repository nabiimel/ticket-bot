import { db, repos } from "@/lib/db";
import { enqueueJob } from "@/lib/enqueue";
import { STOCK_SYNC_ENABLED, stockSecretMatches } from "@/lib/stock-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-stock-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Receives a Robux balance from the seller's own machine (see the userscript
 * on General settings). Updates the Reservations budget and, on an increase,
 * asks the bot to post a restock line.
 */
export async function POST(req: Request) {
  if (!STOCK_SYNC_ENABLED) return json({ error: "disabled" }, 404);

  let payload: Record<string, unknown> = {};
  try {
    const text = await req.text();
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = Object.fromEntries(new URLSearchParams(text));
    }
  } catch {
    return json({ error: "bad body" }, 400);
  }

  const secret = req.headers.get("x-stock-secret") ?? payload.secret;
  if (!stockSecretMatches(secret)) return json({ error: "unauthorized" }, 401);

  const guildId = String(payload.guildId ?? "");
  if (
    !/^\d{15,20}$/.test(guildId) ||
    !repos.guilds.isGuildPresent(db(), guildId)
  ) {
    return json({ error: "unknown guild" }, 404);
  }

  const robux = Math.trunc(Number(payload.robux));
  if (!Number.isFinite(robux) || robux < 0 || robux > 100_000_000) {
    return json({ error: "invalid robux" }, 400);
  }

  const previous = repos.guildConfig.getGuildConfig(
    db(),
    guildId,
  ).reservationsRobuxBudget;

  repos.guildConfig.updateGuildConfig(db(), guildId, {
    reservationsRobuxBudget: robux,
    reservationsStockSyncedAt: Math.floor(Date.now() / 1000),
  });

  // Refresh the stock embed on any change (rises also post a restock line).
  if (robux !== previous) {
    await enqueueJob(guildId, "post_stock_update", { robux, previous });
  }

  return json({ ok: true, robux, previous, changed: robux !== previous });
}
