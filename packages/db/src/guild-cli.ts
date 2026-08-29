import { openDb } from "./index.js";
import * as repos from "./repos/index.js";

// Host-operator kill-switch for a single tenant guild.
//   npm run guild --workspace @ticketbot/db -- suspend   <guildId>
//   npm run guild --workspace @ticketbot/db -- unsuspend <guildId>
//   npm run guild --workspace @ticketbot/db -- list
const [cmd, guildId] = process.argv.slice(2);
const db = openDb();

function usage(): never {
  console.error("usage: guild <suspend|unsuspend|list> [guildId]");
  process.exit(1);
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
