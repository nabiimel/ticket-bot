"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { confirmDiscardIfDirty } from "@/lib/dirty-store";

export function NavLink({
  href,
  exact,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!confirmDiscardIfDirty()) e.preventDefault();
      }}
      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[var(--accent-soft)] font-semibold text-white"
          : "text-dim hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <span
        className={active ? "text-accent" : "text-faint group-hover:text-dim"}
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}
