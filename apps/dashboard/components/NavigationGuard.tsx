"use client";

import { useEffect } from "react";
import { confirmDiscardIfDirty, dirtyStore } from "@/lib/dirty-store";

/**
 * Warns before leaving a page with unsaved editor changes. `beforeunload` (in
 * dirty-store) covers tab close and hard reload; this covers in-app navigation:
 * any internal link click, and the browser back/forward buttons.
 *
 * Mount once, inside the dashboard layout.
 */
export function NavigationGuard() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        a.target === "_blank" ||
        a.hasAttribute("download")
      )
        return;
      // Leave external links alone.
      if (
        /^[a-z]+:\/\//i.test(href) &&
        !href.startsWith(window.location.origin)
      )
        return;
      if (!confirmDiscardIfDirty()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // Capture phase so we run before Next's <Link> handler.
    document.addEventListener("click", onClick, true);

    // Back / forward. When declined, step forward again to undo the pop; a flag
    // swallows the popstate that the corrective step itself fires.
    let undoing = false;
    const onPop = () => {
      if (undoing) {
        undoing = false;
        return;
      }
      if (!dirtyStore.get()) return;
      if (!window.confirm("You have unsaved changes. Leave this page?")) {
        undoing = true;
        window.history.go(1);
      } else {
        dirtyStore.set(false);
      }
    };
    window.addEventListener("popstate", onPop);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return null;
}
