import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-9 w-24" />
        </div>
        <TableSkeleton rows={8} cols={7} />
      </div>
    </div>
  );
}
