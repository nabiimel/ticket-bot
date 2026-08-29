# Ticket Bot + Dashboard

A Discord support-ticket bot with a web dashboard for visual customization.

- **`apps/bot`** — discord.js v14 bot: panels, ticket channels, claim/close, HTML
  transcripts, categories + forms, ratings, blacklist, per-user limits, metrics,
  i18n, optional inactivity auto-close.
- **`apps/dashboard`** — Next.js dashboard (Discord OAuth) for editing panels,
  embeds, categories, messages, blacklist, and viewing stats/transcripts.
- **`packages/db`** — shared SQLite layer (`better-sqlite3`) + migrations + repos.
- **`packages/shared`** — shared types, template/placeholder rendering, i18n, defaults.

The bot and dashboard share **one SQLite file** and run on the **same host**.
The dashboard writes config; the bot reads it live. Discord-side effects
(re-posting a panel, syncing channel permissions) go through a `jobs` table that
the bot drains every few seconds — the dashboard also pokes the bot's internal
HTTP endpoint so changes apply immediately.

## Requirements

- Node.js 20.11+
- A Discord application + bot (https://discord.com/developers/applications)

## Setup

```bash
npm install
cp .env.example .env   # then fill it in
npm run migrate
```

If `npm install` reports blocked install scripts (an allow-scripts policy), run:

```bash
npm approve-scripts better-sqlite3 && npm approve-scripts esbuild && npm install
```

### Discord Developer Portal

1. **Bot** tab → enable **Message Content Intent** and **Server Members Intent**
   (both privileged).
2. Copy the **bot token** → `DISCORD_TOKEN` (and `DISCORD_BOT_TOKEN` for the dashboard).
3. **General Information** → **Application ID** → `DISCORD_CLIENT_ID`.
4. **OAuth2** → add redirect `http://localhost:3000/api/auth/callback/discord`
   (dashboard); copy the **client secret** → `DISCORD_CLIENT_SECRET`.
5. Invite the bot with scopes `bot applications.commands` and permissions:
   Manage Channels, Manage Roles, View Channels, Send Messages, Embed Links,
   Attach Files, Read Message History. Either tick those boxes in **OAuth2 → URL
   Generator**, or use:
   `https://discord.com/api/oauth2/authorize?client_id=<APP_ID>&permissions=268553232&scope=bot%20applications.commands`

### Run

```bash
npm run dev            # bot + dashboard together
npm run dev:bot        # bot only
npm run deploy-commands  # register slash commands (auto-done for DEV_GUILD_ID)
```

On startup the bot **syncs global slash commands** whenever their definitions
change (a hash is cached at `DATA_DIR/.commands-hash` to stay under Discord's
daily global-command write limit). Set `DEV_GUILD_ID` in `.env` to *also*
register to that one guild on every start — guild commands appear instantly,
so you don't wait on the ~1h global propagation. `npm run deploy-commands`
forces a global re-sync.

## Bot commands

| Command | Who | What |
|---|---|---|
| `/ticket-setup view` / `general …` | Manage Server | Log/transcript channels, default staff role, language, limits, close behaviour, feedback, inactivity |
| `/ticket-category add\|edit\|remove\|list` | Manage Server | Define categories (staff role, parent, emoji, ping role, per-user limit). Forms/styling in the dashboard |
| `/ticket-panel create\|resend` | Manage Server | Post/repost a panel. Full editing in the dashboard |
| `/ticket add\|remove\|rename\|claim\|transfer\|close` | Staff (in a ticket) | Manage the current ticket; `transfer` reassigns the claim to another staff member |
| `/ticket-blacklist add\|remove\|list` | Manage Server | Block users from opening tickets |
| `/ticket-stats [days]` | Manage Server | Volume, time-to-claim/close, ratings, per-staff |

The bot also self-heals: a deleted ticket channel (or one missing at startup)
closes its ticket row automatically, so the per-user open-ticket limit can't
strand anyone.

## Dashboard

Open `http://localhost:3000`, sign in with Discord, and pick a server where you
have **Manage Server**. If the bot isn't in that server yet you get an "Add bot"
link instead.

| Page | What you can edit |
|---|---|
| **General** | Log/transcript channels, default staff role, language, naming scheme, max open per user, close behaviour + archive category, feedback toggle, inactivity hours, transcript retention days |
| **Categories** | Per category: label/key/emoji (with quick-pick + validation)/description, staff roles, ping roles, parent Discord category, per-user limit, a 0–5 field open form, and an optional welcome-embed override with live preview. Reorder categories with ↑/↓ |
| **Panels** | Visual embed editor (title, description with placeholders, color, banner, thumbnail, footer, author, timestamp) + live preview, button/dropdown style, per-category button label/emoji/color, target channel. **Save draft**, **Save & publish** (posts/edits the Discord message), **Send test** |

The banner/thumbnail fields accept a URL **or** an uploaded image (PNG/JPG/GIF/WebP,
≤ 8 MB). Uploads are stored under `DATA_DIR/uploads/<guildId>/` and served by the
dashboard at `/u/<guildId>/<file>`. When the bot posts an embed whose image is an
upload, it attaches the file to that message (`attachment://…`) so it renders in
Discord even if the dashboard has no public URL.
| **Messages** | Server-wide welcome / close-DM / feedback-prompt embeds, each with live preview |
| **Blacklist** | Add/remove blocked user IDs |
| **Transcripts** | Open the stored HTML transcript for any closed ticket |
| **Stats** | Volume, time-to-claim/close, ratings, per-staff activity over 7/30/90 days |
| **Audit log** | Every config change made through the dashboard: who, when, what |

Forms validate inline (invalid fields highlight with a message). Editors warn
before you navigate away with unsaved changes. Role/channel pickers are
searchable. Unused uploaded images are pruned automatically after a save.

Config edits apply to the next ticket immediately (the bot reads config live).
Discord-side effects — (re)posting a panel, syncing channel permissions when a
category's staff roles change, test messages — go through the `jobs` table; the
dashboard pokes `BOT_INTERNAL_URL/internal/wake` so they run within a second,
and the bot also polls every 3s as a fallback.

## Data & files

Relative `DATABASE_PATH` / `DATA_DIR` are resolved from the **repo root**, so the
bot and dashboard always share the same files regardless of which folder they
run from. Use absolute paths to relocate.

- `DATABASE_PATH` — SQLite file (default `./data/ticketbot.db`)
- `DATA_DIR/transcripts/<ticketId>.html` — saved transcripts (pruned per the
  guild's retention-days setting)
- `DATA_DIR/uploads/<guildId>/` — dashboard-uploaded images (per-guild cap;
  orphans pruned on save)

## Security notes

- Every dashboard route and server action re-checks the signed-in user still has
  **Manage Server** on the target guild; every query is scoped to that guild id.
- Admin slash commands re-assert Manage Server at runtime (not just the
  command-level default a guild owner could loosen).
- Uploads: Manage-Server only, `Sec-Fetch-Site` CSRF check, magic-byte type
  check, 8 MB/file and 60-file/150 MB per-guild caps, orphan pruning on save.
- Static user content (`/u/…`, transcript HTML) is served with
  `X-Content-Type-Options: nosniff`; transcripts additionally get a strict
  `Content-Security-Policy: sandbox` so a sanitizer gap can't run script on the
  dashboard origin.
- The bot's internal wake endpoint uses a constant-time secret comparison; set
  `INTERNAL_WAKE_SECRET` and keep that port on a private network.
- All SQL is parameterized; file-serving routes reject path traversal
  (basename + charset filter + extension allowlist + guild-presence check).
- `AUTH_SECRET` and `INTERNAL_WAKE_SECRET` must be set to real random values
  (`openssl rand -base64 32`); set `NEXTAUTH_URL` explicitly in production.

Not covered here: infra hardening (TLS, WAF, host firewall) and a review of the
`discord-html-transcripts` / `next-auth` supply chain.

## Develop

```bash
npm run typecheck   # all workspaces
npm run lint         # eslint, zero-warning gate
npm run format:check # prettier
npm test             # vitest (shared, db, bot helpers)
```

CI (`.github/workflows/ci.yml`) runs all of the above plus the dashboard build.

## Deploy (one host)

```bash
# .env at repo root with DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
# DISCORD_BOT_TOKEN, AUTH_SECRET, INTERNAL_WAKE_SECRET, NEXTAUTH_URL
# optional: LOG_WEBHOOK_URL, BACKUP_S3_* (see .env.example)
docker compose up -d   # bot + dashboard + autoheal + nightly backup
```

Both processes run migrations on startup (concurrency-safe), so no separate
migrate step is required — `docker compose run --rm migrate` still exists if you
want to run them explicitly. The bot shuts down gracefully on `SIGTERM`
(drains the job queue, flushes the error webhook, closes the DB).

The compose stack also runs:

- **`autoheal`** — restarts any container Docker marks `unhealthy`. The `bot`
  healthcheck hits `:8787/health` (which returns 503 when the gateway is down);
  the bot additionally self-exits if it stays disconnected for ~3 min so
  `restart: unless-stopped` recycles it.
- **`backup`** (`offen/docker-volume-backup`) — nightly `tar.gz` of the data
  volume at 03:00, keeping 14 in the local `ticketbot-backups` volume. Set the
  `BACKUP_S3_*` vars in `.env` to also push each archive to Cloudflare R2 /
  DO Spaces / S3.
- Container logs are capped at 5 × 10 MB per service (`x-logging` anchor). For a
  daemon-wide cap that also covers Caddy, put `log-opts` in
  `/etc/docker/daemon.json` instead.

The bot writes an **hourly SQLite snapshot** to `DATA_DIR/snapshots/`
(`db-YYYYMMDD-HH.db`, newest 48 kept) via the online-backup API — a consistent
point-in-time copy even between nightly archives.

### Restore from a nightly archive

```bash
docker compose down
docker run --rm -v ticket-bot_ticketbot-data:/data -v ticket-bot_ticketbot-backups:/archive \
  alpine sh -c "rm -rf /data/* && tar xzf /archive/<archive>.tar.gz -C / backup/ticketbot-data --strip-components=2"
docker compose up -d
```

(The archive stores the volume under `backup/ticketbot-data/`.) To restore a
single hourly snapshot instead, copy `snapshots/db-*.db` over
`DATA_DIR/ticketbot.db` (and delete the `-wal` / `-shm` siblings) while the
stack is down.

### Error alerts

Set `LOG_WEBHOOK_URL` to a Discord webhook (a private `#bot-logs` channel).
Error-level log lines are batched and posted there (≤ 1 message / 10 s).

### Suspending an abusive server

```bash
docker compose exec bot npm run guild --workspace @ticketbot/db -- list
docker compose exec bot npm run guild --workspace @ticketbot/db -- suspend <guildId>
docker compose exec bot npm run guild --workspace @ticketbot/db -- unsuspend <guildId>
```

A suspended guild can't open tickets, its queued jobs are dropped, scheduler
sweeps skip it, and its dashboard becomes read-only with a banner. Per-user
open cooldowns (20 s) and dashboard test-send cooldowns (15 s) apply to every
guild regardless.

## Project status

- [x] Monorepo, shared DB layer + migrations, shared types/templating
- [x] Bot: ticket flow, categories/forms, claim/close/transfer, transcripts,
      ratings, blacklist, limits, metrics, i18n, jobs worker, internal server,
      scheduler (inactivity + transcript retention), channel-delete self-heal,
      startup reconciliation, graceful shutdown
- [x] Dashboard: auth (+ token refresh) + guild picker, General/Categories/
      Panels/Messages/Blacklist/Transcripts/Stats/Audit, visual embed editor +
      live preview, image upload (origin-checked, quota, orphan cleanup),
      inline validation, unsaved-changes guard, searchable pickers, category
      ordering, emoji quick-pick
- [x] `Dockerfile` + `docker-compose.yml`, CI, ESLint + Prettier, vitest

### Possible next steps

- Additional locale files under `packages/shared/src/locales/`
- Upload support for footer/author icon URLs (currently URL-only)
- Drag-and-drop (rather than ↑/↓) category ordering
