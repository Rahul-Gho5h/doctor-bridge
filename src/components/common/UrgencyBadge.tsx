import { cn } from "@/lib/utils";

type Urgency = "ROUTINE" | "SEMI_URGENT" | "URGENT";

const STYLES: Record<Urgency, string> = {
  ROUTINE:    "bg-muted text-muted-foreground border border-border",
  SEMI_URGENT:"bg-warning/15 text-warning-foreground border border-warning/30",
  URGENT:     "bg-destructive/15 text-destructive border border-destructive/30",
};

const DOT: Record<Urgency, string> = {
  ROUTINE:    "bg-muted-foreground",
  SEMI_URGENT:"bg-warning",
  URGENT:     "bg-destructive",
};

const LABELS: Record<Urgency, string> = {
  ROUTINE:    "Routine",
  SEMI_URGENT:"Semi-urgent",
  URGENT:     "Urgent",
};

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium", STYLES[urgency])}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT[urgency])} />
      {LABELS[urgency]}
    </span>
  );
}
