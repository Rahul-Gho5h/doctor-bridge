import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-info/15 text-info-foreground border border-info/30",
  VIEWED: "bg-info/15 text-info-foreground border border-info/30",
  ACKNOWLEDGED: "bg-info/15 text-info-foreground border border-info/30",
  ACCEPTED: "bg-success/15 text-success-foreground border border-success/30",
  APPOINTMENT_BOOKED: "bg-success/15 text-success-foreground border border-success/30",
  COMPLETED: "bg-success/20 text-success-foreground border border-success/40",
  DECLINED: "bg-destructive/15 text-destructive border border-destructive/30",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  // appointment statuses
  SCHEDULED: "bg-info/15 text-info-foreground border border-info/30",
  CONFIRMED: "bg-info/15 text-info-foreground border border-info/30",
  CHECKED_IN: "bg-warning/15 text-warning-foreground border border-warning/30",
  IN_PROGRESS: "bg-warning/15 text-warning-foreground border border-warning/30",
  NO_SHOW: "bg-destructive/15 text-destructive border border-destructive/30",
  RESCHEDULED: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", cls)}>
      {status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}
