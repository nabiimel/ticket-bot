"use client";

import { useEffect } from "react";

/**
 * Module-level "unsaved changes" flag. Editors set it; NavLink and a
 * `beforeunload` listener check it to warn before navigating away.
 */
let dirty = false;

export const dirtyStore = {
  set: (v: boolean) => {
    dirty = v;
  },
  get: () => dirty,
};

const MESSAGE = "You have unsaved changes. Leave this page?";

export function confirmDiscardIfDirty(): boolean {
  if (!dirtyStore.get()) return true;
  return window.confirm(MESSAGE);
}

/** Editors call this with a boolean that reflects whether local state ≠ saved state. */
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    dirtyStore.set(isDirty);
    return () => dirtyStore.set(false);
  }, [isDirty]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyStore.get()) {
        e.preventDefault();
        e.returnValue = MESSAGE;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
