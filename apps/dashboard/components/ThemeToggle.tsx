"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const ORDER: Mode[] = ["system", "light", "dark"];

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") {
    delete root.dataset.theme;
    try {
      localStorage.removeItem("theme");
    } catch {
      /* ignore */
    }
  } else {
    root.dataset.theme = mode;
    try {
      localStorage.setItem("theme", mode);
    } catch {
      /* ignore */
    }
  }
}

const ICON: Record<Mode, string> = { system: "🖥", light: "☀", dark: "🌙" };
const NEXT_LABEL: Record<Mode, string> = {
  system: "Switch to light theme",
  light: "Switch to dark theme",
  dark: "Use system theme",
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      /* ignore */
    }
    setMode(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!;
    setMode(next);
    apply(next);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      title={NEXT_LABEL[mode]}
      aria-label={NEXT_LABEL[mode]}
      className={`grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-surface-2 text-sm transition-colors hover:bg-surface-3 ${className}`}
    >
      <span aria-hidden>{ICON[mode]}</span>
    </button>
  );
}
