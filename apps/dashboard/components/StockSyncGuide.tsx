"use client";

import { useMemo, useState } from "react";

/**
 * Shows the Tampermonkey/Violentmonkey userscript the seller installs on their
 * own machine to push their Robux balance (Option A). Their Roblox session
 * never leaves their computer — the script only sends a number + the secret.
 */
export function StockSyncGuide({
  guildId,
  appOrigin,
  enabled,
}: {
  guildId: string;
  appOrigin: string;
  enabled: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const script = useMemo(() => {
    const origin =
      appOrigin.replace(/\/+$/, "") ||
      (typeof window !== "undefined" ? window.location.origin : "");
    let host = "*";
    try {
      host = new URL(origin).host;
    } catch {
      /* keep * */
    }
    return `// ==UserScript==
// @name         Roblox stock → Ticket Bot
// @match        https://www.roblox.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      ${host}
// ==/UserScript==
(function () {
  const GUILD_ID = ${JSON.stringify(guildId)};
  const SECRET   = "PASTE_ROBLOX_STOCK_SECRET";      // from the droplet .env
  const ENDPOINT = ${JSON.stringify(origin + "/api/roblox-stock")};
  const EVERY_MINUTES = 10;

  async function push() {
    try {
      const r = await fetch("https://economy.roblox.com/v1/user/currency", {
        credentials: "include",
      });
      if (!r.ok) return;
      const { robux } = await r.json();
      GM_xmlhttpRequest({
        method: "POST",
        url: ENDPOINT,
        headers: { "content-type": "application/json" },
        data: JSON.stringify({ guildId: GUILD_ID, secret: SECRET, robux }),
      });
    } catch (e) {
      /* offline / logged out — try again next tick */
    }
  }
  push();
  setInterval(push, EVERY_MINUTES * 60000);
})();`;
  }, [guildId, appOrigin]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the user can select manually */
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-block h-2 w-2 rounded-full ${enabled ? "bg-success" : "bg-faint"}`}
        />
        <span className="text-dim">
          {enabled
            ? "Endpoint active — set ROBLOX_STOCK_SECRET matches the script."
            : "Endpoint disabled — set ROBLOX_STOCK_SECRET on the droplet to enable."}
        </span>
      </div>
      <p className="text-xs text-faint">
        Install Tampermonkey (or Violentmonkey), add this as a new script, and
        replace <code>PASTE_ROBLOX_STOCK_SECRET</code> with the secret from{" "}
        <code>.env</code>. It pushes the balance every 10 minutes while a
        roblox.com tab is open. The seller&apos;s login never leaves their
        machine.
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={copy}
          className="btn-secondary absolute right-2 top-2 !px-2 !py-1 text-xs"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="max-h-64 overflow-auto rounded-field border border-line bg-surface-2 p-3 text-xs leading-relaxed">
          <code>{script}</code>
        </pre>
      </div>
    </div>
  );
}
