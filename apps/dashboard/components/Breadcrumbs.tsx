import Link from "next/link";

export type Crumb = { label: string; href?: string };

/** Section trail for nested editor pages, e.g. Categories › Support. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-2 text-faint">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="rounded-full px-2 py-0.5 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "font-medium text-ink" : "px-2"}>
                  {c.label}
                </span>
              )}
              {!last && (
                <span aria-hidden className="text-faint/60">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
