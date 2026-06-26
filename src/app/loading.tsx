import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  CardSkeleton,
} from "@/components/skeletons";

// Default loading UI (covers Overview and any route without its own loading).
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton withAction />
      <div className="mb-8 space-y-3">
        <StatCardsSkeleton />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
