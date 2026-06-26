import {
  PageHeaderSkeleton,
  ToolbarSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <ToolbarSkeleton />
        <TableSkeleton rows={5} cols={7} />
      </div>
    </div>
  );
}
