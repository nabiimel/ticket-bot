import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="page">
      <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="card space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
