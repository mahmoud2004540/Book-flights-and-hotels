import { Card } from "@/components/ui/card";

/** Shown while suppliers are still answering — section 4.2. */
export function OfferSkeleton() {
  return (
    <Card aria-hidden="true">
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:gap-6">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-28 rounded bg-surface-2" />
          <div className="flex items-center gap-4">
            <div className="h-9 w-14 rounded bg-surface-2" />
            <div className="h-px flex-1 bg-surface-2" />
            <div className="h-9 w-14 rounded bg-surface-2" />
          </div>
          <div className="h-3 w-40 rounded bg-surface-2" />
        </div>
        <div className="flex flex-col items-end gap-2 sm:border-s sm:border-line-soft sm:ps-6">
          <div className="h-7 w-24 rounded bg-surface-2" />
          <div className="h-9 w-20 rounded bg-surface-2" />
        </div>
      </div>
    </Card>
  );
}

export function OfferSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <OfferSkeleton key={index} />
      ))}
    </div>
  );
}
