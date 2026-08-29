import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { NextResponse } from "next/server";
import { uploadsDir } from "@ticketbot/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * Serves dashboard-uploaded images. Public (filenames are UUIDs) so both the
 * dashboard preview and Discord's image proxy can fetch them.
 */
export async function GET(
  _req: Request,
  { params }: { params: { guildId: string; file: string } },
) {
  const guildId = params.guildId.replace(/[^0-9]/g, "");
  const file = basename(params.file).replace(/[^A-Za-z0-9._-]/g, "");
  if (!guildId || !file) {
    return new NextResponse("Not found", { status: 404 });
  }
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  if (!(ext in MIME)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buf = await readFile(join(uploadsDir(guildId), file));
    return new NextResponse(buf, {
      headers: {
        "content-type": MIME[ext]!,
        // Served from the dashboard origin — stop browsers guessing HTML/JS.
        "x-content-type-options": "nosniff",
        "content-disposition": `inline; filename="${file}"`,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
