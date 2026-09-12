"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { heartbeatPresence } from "@/app/dashboard/[guildId]/actions";

const INTERVAL_MS = 20_000;

/**
 * Invisible: pings presence for this guild while the tab is visible, then
 * refreshes the (server-rendered) layout so the avatar stack in the header
 * picks up who else just showed up or left.
 */
export function PresenceHeartbeat({ guildId }: { guildId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      await heartbeatPresence(guildId).catch(() => {});
      if (!cancelled) router.refresh();
    };
    void tick();
    const id = setInterval(() => void tick(), INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [guildId, router]);

  return null;
}
