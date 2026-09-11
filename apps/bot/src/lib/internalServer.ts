import { createServer, type Server } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Client } from "discord.js";
import { config } from "../config.js";
import { processJobsNow } from "./jobs.js";
import { logger } from "./logger.js";

/** Constant-time secret comparison (avoids a timing oracle on the wake secret). */
function secretMatches(provided: string | string[] | undefined): boolean {
  if (!config.INTERNAL_WAKE_SECRET || typeof provided !== "string")
    return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(config.INTERNAL_WAKE_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Tiny HTTP server the dashboard pokes after enqueuing a job so it is processed
 * immediately instead of waiting for the 3s poll. Auth via a shared secret.
 */
export function startInternalServer(client: Client): Server {
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const ready = client.isReady();
      res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: ready, ready }));
      return;
    }

    if (req.method === "POST" && req.url === "/internal/wake") {
      if (!secretMatches(req.headers["x-wake-secret"])) {
        res.writeHead(401).end();
        return;
      }
      processJobsNow(client)
        .then((n) => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ processed: n }));
        })
        .catch(() => res.writeHead(500).end());
      return;
    }

    res.writeHead(404).end();
  });

  // Bind to loopback only: under network_mode: host (needed for Discord voice
  // UDP) an unbound-host listen() would otherwise be reachable from the public
  // internet, not just other containers. The dashboard's wake call is already
  // best-effort with a 3s-poll fallback (see enqueueJob), so losing the
  // instant nudge here is an acceptable trade for not exposing this endpoint.
  server.listen(config.INTERNAL_PORT, "127.0.0.1", () => {
    logger.info(
      `Internal server listening on 127.0.0.1:${config.INTERNAL_PORT}`,
    );
  });
  return server;
}
