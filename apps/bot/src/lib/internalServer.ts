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
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ready: client.isReady() }));
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

  server.listen(config.INTERNAL_PORT, () => {
    logger.info(`Internal server listening on :${config.INTERNAL_PORT}`);
  });
  return server;
}
