"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Render a template's Meta quality score. Meta returns UNKNOWN or NONE until the
// template has been delivered to enough recipients, which is normal for new
// templates, so that case reads as a muted "Not rated yet" rather than an error.
export function TemplateQualityLabel({ score }: { score: string | null }) {
  const value = (score ?? "").toUpperCase();

  if (value === "GREEN" || value === "YELLOW" || value === "RED") {
    const dotColor =
      value === "GREEN"
        ? "bg-success"
        : value === "YELLOW"
          ? "bg-warning"
          : "bg-destructive";
    const textColor =
      value === "GREEN"
        ? "text-success"
        : value === "YELLOW"
          ? "text-warning"
          : "text-destructive";
    const label =
      value === "GREEN" ? "High" : value === "YELLOW" ? "Medium" : "Low";
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium">
        <span className={`size-2 rounded-full ${dotColor}`} aria-hidden="true" />
        <span className={textColor}>Quality: {label}</span>
      </span>
    );
  }

  // UNKNOWN, NONE, missing: not enough data yet.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help text-xs text-muted-foreground underline decoration-dotted">
            Not rated yet
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Quality rating appears after the template has been delivered to enough
          recipients.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
