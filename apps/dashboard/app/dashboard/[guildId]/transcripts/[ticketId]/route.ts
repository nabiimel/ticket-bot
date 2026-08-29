import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { transcriptsDir } from "@ticketbot/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { db, repos } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The transcript HTML is built from user-authored ticket messages. Even though
// discord-html-transcripts sanitizes, serve it under a strict sandbox so a
// sanitizer gap can't run script on the dashboard origin.
const SAFE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "content-security-policy":
    "sandbox; default-src 'none'; img-src https: data:; " +
    "style-src 'unsafe-inline' https:; font-src https: data:; media-src https: data:",
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
