import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Doctor Bridge" }] }),
  component: NotificationsPage,
});

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  read_at: string | null;
  sent_at: string;
  data: Record<string, unknown> | null;
}

type Category = "ALL" | "REFERRALS" | "DISCUSSIONS" | "SYSTEM";

const CATEGORY_TYPES: Record<Exclude<Category, "ALL">, string[]> = {
  REFERRALS: [
    "NEW_REFERRAL", "REFERRAL_ACCEPTED", "REFERRAL_DECLINED",
    "REFERRAL_MESSAGE", "REFERRAL_OUTCOME", "APPOINTMENT_SCHEDULED",
    "FOLLOW_UP_REMINDER", "APPOINTMENT_REMINDER",
  ],
  DISCUSSIONS: ["CASE_DISCUSSION_MESSAGE", "CASE_DISCUSSION_INVITE", "MESSAGE"],
  SYSTEM: [
    "DOCTOR_AUTH_SUCCESS", "DOCTOR_AUTH_BLOCKED", "DOCTOR_REGISTERED",
    "SYSTEM_ALERT", "APPOINTMENT_CANCELLED", "NEW_APPOINTMENT",
    "PATIENT_CHECKED_IN", "LAB_RESULTS_READY", "PRESCRIPTION_READY",
    "PAYMENT_RECEIVED", "INVOICE_OVERDUE", "INVENTORY_LOW",
  ],
};

function resolveLink(n: NotificationRow): string | null {
  const d = n.data ?? {};
  const rid = d.referral_id as string | undefined;
  const did = d.discussion_id as string | undefined;
  switch (n.type) {
    case "NEW_REFERRAL":
    case "REFERRAL_ACCEPTED":
    case "REFERRAL_DECLINED":
    case "REFERRAL_MESSAGE":
    case "APPOINTMENT_SCHEDULED":
    case "FOLLOW_UP_REMINDER":
    case "APPOINTMENT_REMINDER":
      return rid ? `/referrals/${rid}` : "/referrals";
    case "CASE_DISCUSSION_MESSAGE":
    case "CASE_DISCUSSION_INVITE":
      return did ? `/discussions?id=${did}` : "/discussions";
    case "MESSAGE":
      return "/messages";
    case "AFFILIATION_REQUEST":
    case "AFFILIATION_ACCEPTED":
      return "/affiliations";
    default:
      return null;
  }
}

function typeIcon(type: string): string {
  switch (type) {
    case "NEW_REFERRAL":           return "📋";
    case "REFERRAL_ACCEPTED":      return "✅";
    case "REFERRAL_DECLINED":      return "❌";
    case "REFERRAL_MESSAGE":       return "💬";
    case "APPOINTMENT_SCHEDULED":  return "📅";
    case "FOLLOW_UP_REMINDER":     return "⏰";
    case "APPOINTMENT_REMINDER":   return "🔔";
    case "CASE_DISCUSSION_MESSAGE":
    case "CASE_DISCUSSION_INVITE": return "🗂️";
    case "MESSAGE":                return "✉️";
    case "AFFILIATION_REQUEST":
    case "AFFILIATION_ACCEPTED":   return "🏥";
    case "DOCTOR_REGISTERED":      return "👨‍⚕️";
    case "DOCTOR_AUTH_SUCCESS":    return "✅";
    case "DOCTOR_AUTH_BLOCKED":    return "🚫";
    case "SYSTEM_ALERT":           return "⚠️";
    default:                       return "🔔";
  }
}

const PAGE_SIZE = 30;

function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState<Category>("ALL");
  const [offset, setOffset] = useState(0);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const fetchPage = useCallback(async (cat: Category, from: number, append: boolean) => {
    if (!user) return;
    let query = supabase
      .from("notifications")
      .select("id,title,message,type,read_at,sent_at,data")
      .eq("recipient_id", user.id)
      .order("sent_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (cat !== "ALL") {
      const types = CATEGORY_TYPES[cat];
      query = query.in("type", types as any);
    }

    const { data } = await query;
    const rows = (data ?? []) as NotificationRow[];
    setHasMore(rows.length === PAGE_SIZE);
    setItems((prev) => append ? [...prev, ...rows] : rows);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    fetchPage(category, 0, false).finally(() => setLoading(false));
  }, [category, fetchPage]);

  // Real-time: insert new notification at the top
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notif-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const incoming = payload.new as NotificationRow;
          const belongs =
            category === "ALL" ||
            CATEGORY_TYPES[category].includes(incoming.type);
          if (belongs) setItems((prev) => [incoming, ...prev]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, category]);

  const loadMore = async () => {
    const next = offset + PAGE_SIZE;
    setLoadingMore(true);
    await fetchPage(category, next, true);
    setOffset(next);
    setLoadingMore(false);
  };

  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    setItems((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
    );
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const handleClick = async (n: NotificationRow) => {
    if (!n.read_at) await markRead(n.id);
    const link = resolveLink(n);
    if (link) router.navigate({ to: link as any });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Notifications"
        description="Your full notification history."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="mr-1.5 h-4 w-4" />
              Mark all read ({unreadCount})
            </Button>
          ) : undefined
        }
      />

      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList className="mb-4">
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="REFERRALS">Referrals</TabsTrigger>
          <TabsTrigger value="DISCUSSIONS">Discussions</TabsTrigger>
          <TabsTrigger value="SYSTEM">System</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-xl border bg-card shadow-card">
        {loading ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-5 py-4">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No notifications here yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((n) => {
              const link = resolveLink(n);
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/40",
                    !n.read_at && "bg-primary/5",
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-xl leading-none">{typeIcon(n.type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        {!n.read_at && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeTime(n.sent_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  </div>
                  {link && (
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="border-t px-5 py-3 text-center">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
