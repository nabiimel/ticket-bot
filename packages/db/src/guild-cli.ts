import { openDb } from "./index.js";
import * as repos from "./repos/index.js";

// Host-operator tools for tenant guilds.
//   npm run guild --workspace @ticketbot/db -- guilds          list every server the bot is in
//   npm run guild --workspace @ticketbot/db -- suspend   <id>  kill-switch a server
//   npm run guild --workspace @ticketbot/db -- unsuspend <id>  lift the kill-switch
//   npm run guild --workspace @ticketbot/db -- list            list suspended servers only
const [cmd, guildId] = process.argv.slice(2);
const db = openDb();

function usage(): never {
  console.error("usage: guild <guilds|list|suspend|unsuspend> [guildId]");
  process.exit(1);
}

function fmtDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

switch (cmd) {
  case "suspend":
  case "unsuspend": {
    if (!guildId) usage();
    repos.guildConfig.updateGuildConfig(db, guildId, {
      suspended: cmd === "suspend",
    });
    console.log(
      `${guildId} is now ${cmd === "suspend" ? "SUSPENDED" : "active"}`,
    );
    break;
  }
  case "guilds": {
    const guilds = repos.guilds.listPresentGuilds(db);
    const suspended = new Set(
      (
        db
          .prepare(`SELECT guild_id FROM guild_config WHERE suspended = 1`)
          .all() as { guild_id: string }[]
      ).map((r) => r.guild_id),
    );
    if (guilds.length === 0) {
      console.log("The bot isn't in any servers.");
      break;
    }
    console.log(`${guilds.length} server(s):`);
    for (const g of guilds) {
      const flag = suspended.has(g.guildId) ? "  [SUSPENDED]" : "";
      console.log(
        `  ${g.guildId}  joined ${fmtDate(g.addedAt)}  ${g.name ?? "(unknown name)"}${flag}`,
      );
    }
    break;
  }
  case "list": {
    const rows = db
      .prepare(
        `SELECT guild_id FROM guild_config WHERE suspended = 1 ORDER BY guild_id`,
      )
      .all() as { guild_id: string }[];
    if (rows.length === 0) console.log("No suspended guilds.");
    else {
      console.log(`${rows.length} suspended guild(s):`);
      for (const r of rows) console.log(`  - ${r.guild_id}`);
    }
    break;
  }
  default:
    usage();
}

db.close();
