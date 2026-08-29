import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { uploadsDir } from "@ticketbot/db";
import { checkGuildAccess } from "@/lib/guild-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // Discord's non-nitro attachment limit
const MAX_FILES_PER_GUILD = 60;
const MAX_TOTAL_BYTES_PER_GUILD = 150 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Verify the bytes actually are the claimed image type (the MIME header is client-set). */
function sniff(buf: Buffer): "png" | "jpg" | "gif" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}

/** Reject cross-site POSTs (route handlers have no built-in CSRF token). */
function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  // Older browsers: fall back to comparing Origin with Host.
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

async function guildUsage(
  dir: string,
): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  try {
    for (const name of await readdir(dir)) {
      const s = await stat(join(dir, name)).catch(() => null);
      if (s?.isFile()) {
        count++;
        bytes += s.size;
      }
    }
  } catch {
    /* dir doesn't exist yet */
  }
  return { count, bytes };
}

export async function POST(
  req: Request,
  { params }: { params: { guildId: string } },
) {
  if (!sameOrigin(req)) {
    return NextResponse.json(
      { error: "Cross-origin request refused" },
      { status: 403 },
    );
  }
  const access = await checkGuildAccess(params.guildId);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported type — use PNG, JPG, GIF or WebP" },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 8 MB" }, { status: 413 });
  }

  const dir = uploadsDir(params.guildId);
  const usage = await guildUsage(dir);
  if (
    usage.count >= MAX_FILES_PER_GUILD ||
    usage.bytes + file.size > MAX_TOTAL_BYTES_PER_GUILD
  ) {
    return NextResponse.json(
      {
        error:
          "This server's image storage is full — remove unused images first",
      },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (sniff(bytes) !== ext) {
    return NextResponse.json(
      { error: "File contents don't match a valid PNG, JPG, GIF or WebP" },
      { status: 415 },
    );
  }

  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(join(dir, name), bytes);

  return NextResponse.json({ url: `/u/${params.guildId}/${name}` });
}
