import { Badge } from "@/components/ui/badge";

// Map a Meta template status to a colored Badge.
export function TemplateStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "APPROVED") return <Badge variant="success">Approved</Badge>;
  if (s === "PENDING" || s === "IN_APPEAL")
    return <Badge variant="warning">Pending</Badge>;
  if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  if (s === "PAUSED" || s === "DISABLED")
    return <Badge variant="secondary">{titleCase(s)}</Badge>;
  return <Badge variant="outline">{titleCase(s)}</Badge>;
}

// Map a send_log status to a colored Badge.
export function SendStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return <Badge variant="success">Sent</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "skipped_dupe":
      return <Badge variant="secondary">Deduped</Badge>;
    case "skipped_invalid":
      return <Badge variant="warning">Invalid number</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function CategoryBadge({ category }: { category: string }) {
  const c = category.toUpperCase();
  return (
    <Badge variant={c === "MARKETING" ? "default" : "outline"}>
      {titleCase(c)}
    </Badge>
  );
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
