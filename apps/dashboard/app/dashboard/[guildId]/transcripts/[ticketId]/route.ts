import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { transcriptsDir } from "@ticketbot/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { db, repos } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// discord-html-transcripts renders with <discord-message> web components that
// need JavaScript (an inline data blob + the component library from jsDelivr).
// `sandbox allow-scripts` — WITHOUT allow-same-origin — lets them run in an
// opaque origin: the transcript can style itself but can't read the dashboard
// session, cookies or storage, so a sanitizer gap in the (already-escaping)
// library still has nowhere to go.
const SAFE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "content-security-policy": [
    "sandbox allow-scripts",
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'unsafe-inline' https:",
    "img-src https: data: blob:",
    "font-src https: data:",
    "media-src https: data:",
    "connect-src https://cdn.jsdelivr.net",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; "),
  "cache-control": "private, no-store",
};

export async function GET(
  _req: Request,
  { params }: { params: { guildId: string; ticketId: string } },
) {
  await requireGuildAccess(params.guildId);
  const ticket = repos.tickets.getTicket(db(), Number(params.ticketId));
  if (!ticket || ticket.guildId !== params.guildId) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const html = await readFile(transcriptsDir(ticket.id));
    return new NextResponse(html, { headers: SAFE_HEADERS });
  } catch {
    if (ticket.transcriptUrl) {
      return NextResponse.redirect(ticket.transcriptUrl);
    }
    return new NextResponse("Transcript file not available", { status: 404 });
  }
}
