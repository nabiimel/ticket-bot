"use client";

import { useEffect } from "react";

/**
 * Stamps a "you've seen this page" cookie on mount so the sidebar can badge
 * items that changed since your last visit. Renders nothing.
 */
export function MarkSeen({ cookie }: { cookie: string }) {
  useEffect(() => {
    try {
      document.cookie = `${cookie}=${Date.now()}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* ignore */
    }
  }, [cookie]);
  return null;
}
