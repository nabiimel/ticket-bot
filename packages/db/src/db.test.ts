import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import * as repos from "./repos/index.js";
import type { DB } from "./index.js";

function freshDb(): DB {
  const db = new Database(":memory:") as unknown as DB;
  runMigrations(db);
  return db;
}

describe("migrations", () => {
  it("apply once, then are idempotent", () => {
    const db = new Database(":memory:") as unknown as DB;
    const first = runMigrations(db);
    expect(first).toEqual([
      "001_init",
      "002_extras",
      "003_claiming",
      "004_category_naming",
      "005_suspend",
      "006_snippets",
    ]);
    expect(runMigrations(db)).toEqual([]);
  });
});

describe("ticket_counter", () => {
  it("hands out sequential numbers per guild", () => {
    const db = freshDb();
    expect(repos.counter.nextTicketNumber(db, "g1")).toBe(1);
    expect(repos.counter.nextTicketNumber(db, "g1")).toBe(2);
    expect(repos.counter.nextTicketNumber(db, "g2")).toBe(1);
    expect(repos.counter.peekTicketNumber(db, "g1")).toBe(2);
  });
});

describe("tickets repo", () => {
  let db: DB;
  beforeEach(() => {
    db = freshDb();
  });

  it("creates a ticket with form responses and counts open tickets", () => {
    const n = repos.counter.nextTicketNumber(db, "g1");
    const t = repos.tickets.createTicket(db, {
      guildId: "g1",
      number: n,
      channelId: "c1",
      categoryId: null,
      openerId: "u1",
      formResponses: [{ fieldKey: "q", fieldLabel: "Q", value: "hello" }],
    });
    expect(t.status).toBe("open");
    expect(repos.tickets.countOpenByUser(db, "g1", "u1")).toBe(1);
    expect(repos.tickets.getFormResponses(db, t.id)).toHaveLength(1);
  });

  it("markAbandoned closes without a transcript", () => {
    const t = repos.tickets.createTicket(db, {
      guildId: "g1",
      number: 1,
      channelId: "c1",
      categoryId: null,
      openerId: "u1",
    });
    repos.tickets.markAbandoned(db, t.id, "gone");
    const after = repos.tickets.getTicket(db, t.id)!;
    expect(after.status).toBe("closed");
    expect(after.closeReason).toBe("gone");
    expect(repos.tickets.countOpenByUser(db, "g1", "u1")).toBe(0);
  });
});

describe("guildConfig repo", () => {
  it("round-trips a partial update including the retention column", () => {
    const db = freshDb();
    repos.guildConfig.updateGuildConfig(db, "g1", {
      maxOpenPerUser: 3,
      transcriptRetentionDays: 30,
      welcomeEmbed: { title: "hi" },
    });
    const cfg = repos.guildConfig.getGuildConfig(db, "g1");
    expect(cfg.maxOpenPerUser).toBe(3);
    expect(cfg.transcriptRetentionDays).toBe(30);
    expect(cfg.welcomeEmbed?.title).toBe("hi");
    expect(cfg.closeBehaviour).toBe("delete");
    expect(cfg.claimingEnabled).toBe(true); // default
    expect(cfg.suspended).toBe(false); // default

    repos.guildConfig.updateGuildConfig(db, "g1", { claimingEnabled: false });
    expect(repos.guildConfig.getGuildConfig(db, "g1").claimingEnabled).toBe(
      false,
    );
  });

  it("round-trips the suspended flag as a boolean", () => {
    const db = freshDb();
    expect(repos.guildConfig.getGuildConfig(db, "g1").suspended).toBe(false);
    repos.guildConfig.updateGuildConfig(db, "g1", { suspended: true });
    expect(repos.guildConfig.getGuildConfig(db, "g1").suspended).toBe(true);
    repos.guildConfig.updateGuildConfig(db, "g1", { suspended: false });
    expect(repos.guildConfig.getGuildConfig(db, "g1").suspended).toBe(false);
  });
});

describe("snippets repo", () => {
  it("creates, looks up by name, updates attachments, and enforces unique names", () => {
    const db = freshDb();
    const s = repos.snippets.createSnippet(db, "g1", {
      name: "welcome",
      content: "Hi {user}",
      createdBy: "u1",
    });
    expect(s.attachments).toEqual([]);
    expect(repos.snippets.getSnippetByName(db, "g1", "welcome")?.id).toBe(s.id);
    expect(repos.snippets.countSnippets(db, "g1")).toBe(1);

    repos.snippets.updateSnippet(db, s.id, {
      attachments: ["/u/g1/a.png", "/u/g1/b.png"],
    });
    expect(repos.snippets.getSnippet(db, s.id)?.attachments).toEqual([
      "/u/g1/a.png",
      "/u/g1/b.png",
    ]);

    expect(() =>
      repos.snippets.createSnippet(db, "g1", { name: "welcome" }),
    ).toThrow();

    repos.snippets.deleteSnippet(db, s.id);
    expect(repos.snippets.getSnippet(db, s.id)).toBeNull();
  });
});

describe("categories repo", () => {
  it("reorderCategories rewrites sort_order", () => {
    const db = freshDb();
    const a = repos.categories.createCategory(db, "g1", {
      key: "a",
      label: "A",
      staffRoleIds: [],
      pingRoleIds: [],
      form: [],
    });
    const b = repos.categories.createCategory(db, "g1", {
      key: "b",
      label: "B",
      staffRoleIds: [],
      pingRoleIds: [],
      form: [],
    });
    repos.categories.reorderCategories(db, "g1", [b.id, a.id]);
    const order = repos.categories.listCategories(db, "g1").map((c) => c.key);
    expect(order).toEqual(["b", "a"]);
  });

  it("round-trips an optional per-category naming scheme", () => {
    const db = freshDb();
    const cat = repos.categories.createCategory(db, "g1", {
      key: "reroll",
      label: "Reroll",
      staffRoleIds: [],
      pingRoleIds: [],
      form: [],
      namingScheme: "reroll-{number}",
    });
    expect(cat.namingScheme).toBe("reroll-{number}");
    repos.categories.updateCategory(db, cat.id, { namingScheme: null });
    expect(repos.categories.getCategory(db, cat.id)?.namingScheme).toBeNull();
  });
});

describe("blacklist repo", () => {
  it("adds, checks and removes", () => {
    const db = freshDb();
    expect(repos.blacklist.isBlacklisted(db, "g1", "u1")).toBe(false);
    repos.blacklist.addToBlacklist(db, "g1", "u1", "mod", "spam");
    expect(repos.blacklist.isBlacklisted(db, "g1", "u1")).toBe(true);
    expect(repos.blacklist.removeFromBlacklist(db, "g1", "u1")).toBe(true);
    expect(repos.blacklist.isBlacklisted(db, "g1", "u1")).toBe(false);
  });
});

describe("audit repo", () => {
  it("logs and lists newest first", () => {
    const db = freshDb();
    repos.audit.logAudit(db, {
      guildId: "g1",
      actorId: "u1",
      action: "a.one",
      summary: "first",
    });
    repos.audit.logAudit(db, {
      guildId: "g1",
      actorId: "u1",
      action: "a.two",
      summary: "second",
    });
    const rows = repos.audit.listAudit(db, "g1");
    expect(rows.map((r) => r.action)).toEqual(["a.two", "a.one"]);
  });
});

describe("jobs repo", () => {
  it("collapses identical pending jobs", () => {
    const db = freshDb();
    const a = repos.jobs.enqueueJob(db, "g1", "repost_panel", { panelId: 1 });
    const b = repos.jobs.enqueueJob(db, "g1", "repost_panel", { panelId: 1 });
    expect(b).toBe(a);
    const c = repos.jobs.enqueueJob(db, "g1", "repost_panel", { panelId: 2 });
    expect(c).not.toBe(a);
    expect(repos.jobs.takePendingJobs(db)).toHaveLength(2);
  });

  it("gives up after 5 attempts", () => {
    const db = freshDb();
    const id = repos.jobs.enqueueJob(db, "g1", "repost_panel", { panelId: 1 });
    for (let i = 0; i < 5; i++) {
      repos.jobs.takePendingJobs(db);
      repos.jobs.failJob(db, id, "boom");
    }
    expect(repos.jobs.takePendingJobs(db)).toHaveLength(0);
    expect(repos.jobs.listJobs(db, "g1")[0]?.status).toBe("error");
  });
});

describe("stats repo", () => {
  it("aggregates counts and category breakdown", () => {
    const db = freshDb();
    const cat = repos.categories.createCategory(db, "g1", {
      key: "s",
      label: "Support",
      staffRoleIds: [],
      pingRoleIds: [],
      form: [],
    });
    repos.tickets.createTicket(db, {
      guildId: "g1",
      number: 1,
      channelId: "c1",
      categoryId: cat.id,
      openerId: "u1",
    });
    const s = repos.stats.getGuildStats(db, "g1", 30);
    expect(s.totalCount).toBe(1);
    expect(s.openCount).toBe(1);
    expect(s.byCategory[0]?.label).toBe("Support");
  });
});
