import { PageHeaderSkeleton, CardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="max-w-xl">
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}
