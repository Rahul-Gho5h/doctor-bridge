import { useEffect, useState, useCallback, useMemo } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read_at: string | null;
  sent_at: string;
  data: Record<string, unknown> | null;
}

function resolveLink(n: Notification): string | null {
  const d = n.data ?? {};
  const rid = d.referral_id as string | undefined;
  const did = d.discussion_id as string | undefined;
  switch (n.type) {
    case "NEW_REFERRAL":
    case "REFERRAL_ACCEPTED":
    case "REFERRAL_DECLINED":
    case "REFERRAL_MESSAGE":
    case "REFERRAL_OUTCOME":
    case "APPOINTMENT_SCHEDULED":
    case "FOLLOW_UP_REMINDER":
      return rid ? `/referrals/${rid}` : "/referrals";
    case "CASE_DISCUSSION_MESSAGE":
    case "CASE_DISCUSSION_INVITE":
      return did ? `/discussions?id=${did}` : "/discussions";
    case "MESSAGE": {
      const tid = d.thread_id as string | undefined;
      return tid ? `/messages?thread=${tid}` : "/messages";
    }
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
    case "REFERRAL_OUTCOME":       return "📝";
    case "APPOINTMENT_SCHEDULED":  return "📅";
    case "FOLLOW_UP_REMINDER":     return "⏰";
    case "CASE_DISCUSSION_MESSAGE":
    case "CASE_DISCUSSION_INVITE": return "🗂️";
    case "MESSAGE":                return "✉️";
    case "AFFILIATION_REQUEST":
    case "AFFILIATION_ACCEPTED":   return "🏥";
    default:                       return "🔔";
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,message,type,read_at,sent_at,data")
      .eq("recipient_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(25);
    setItems((data ?? []) as Notification[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notif-bell:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => {
          // Silently refresh the bell badge & dropdown list.
          // No toast — the user prefers to check notifications on-demand.
          load();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const markRead = async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", id);
    if (error) { console.warn("[bell] markRead failed:", error); return; }
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: now } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .in("id", ids);
    if (error) { console.warn("[bell] markAllRead failed:", error); return; }
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
  };

  const handleClick = async (n: Notification) => {
    if (!n.read_at) await markRead(n.id);
    const link = resolveLink(n);
    setOpen(false);
    if (link) router.navigate({ to: link as any });
  };

  const unread = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="text-sm font-semibold">
            Notifications {unread > 0 && <span className="ml-1 text-xs text-muted-foreground">({unread} new)</span>}
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">You're all caught up!</p>
            </div>
          ) : (
            items.map((n) => {
              const link = resolveLink(n);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full border-b px-4 py-3 text-left text-sm last:border-0 transition-colors hover:bg-muted/40",
                    !n.read_at && "bg-primary/5",
                    link ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-base leading-none">{typeIcon(n.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium leading-tight">{n.title}</span>
                        {!n.read_at && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">{relativeTime(n.sent_at)}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => {
              setOpen(false);
              router.navigate({ to: "/notifications" as any });
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all notifications
          </button>
          <button
            onClick={() => {
              setOpen(false);
              router.navigate({ to: "/settings", search: { tab: "notifications" } as any });
            }}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Settings
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
