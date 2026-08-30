"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  exact,
  icon,
  badge,
  dot,
  children,
}: {
  href: string;
  exact?: boolean;
  icon?: React.ReactNode;
  /** Small count pill on the right. Omit / 0 to hide. */
  badge?: number;
  /** Red attention dot on the right (used when there's no count). */
  dot?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
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
      <span className="flex-1">{children}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {!badge && dot && (
        <span className="h-2 w-2 rounded-full bg-[var(--danger)]" />
      )}
    </Link>
  );
}
