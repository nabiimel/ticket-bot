import type { ReactNode } from "react";

/** Consistent empty-list placeholder with an optional call to action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-field bg-surface-2 text-dim">
          {icon}
        </div>
      )}
      <div className="font-medium">{title}</div>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-faint">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
