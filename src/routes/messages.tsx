import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Send, MessageSquare, Search, Check, CheckCheck, ArrowRight, ArrowLeft, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileDropzone } from "@/components/patients/FileDropzone";
import { AttachmentList } from "@/components/patients/AttachmentList";
import type { StoredAttachment } from "@/lib/storage";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Doctor Bridge" }] }),
  component: MessagesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    to: typeof s.to === "string" ? s.to : undefined,
    thread: typeof s.thread === "string" ? s.thread : undefined,
  }),
});

interface Thread {
  id: string; user_a: string; user_b: string; last_message_at: string;
  other: { id: string; first_name: string; last_name: string; title: string | null; specialization: string | null } | null;
  other_doctor_profile_id?: string | null;
}
interface Message {
  id: string; thread_id: string; sender_id: string; body: string;
  created_at: string; read_at: string | null;
  attachments?: StoredAttachment[];
}

function MessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { to, thread } = Route.useSearch();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map());

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingAtt, setPendingAtt] = useState<StoredAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
      }
    }, 50);
  };

  // ── Load threads + unread counts ─────────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    if (!user) return;
    const { data: ts } = await supabase
      .from("direct_threads")
      .select("*")
      .order("last_message_at", { ascending: false });

    const rows = ts ?? [];
    const otherIds = rows.map((t) => (t.user_a === user.id ? t.user_b : t.user_a));

    if (otherIds.length === 0) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }

    const [{ data: profs }, { data: docProfiles }, { data: unreadMsgs }] = await Promise.all([
      supabase.from("profiles").select("id,first_name,last_name,title,specialization").in("id", otherIds),
      supabase.from("doctor_profiles").select("id,user_id").in("user_id", otherIds),
      // Fetch all unread incoming messages in one shot
      supabase
        .from("direct_messages")
        .select("thread_id")
        .neq("sender_id", user.id)
        .is("read_at", null),
    ]);

    const map = new Map((profs ?? []).map((p) => [p.id, p as NonNullable<Thread["other"]>]));
    const docMap = new Map((docProfiles ?? []).map((d: any) => [d.user_id, d.id]));

    // Build unread count map
    const newUnreadMap = new Map<string, number>();
    (unreadMsgs ?? []).forEach((m: any) => {
      newUnreadMap.set(m.thread_id, (newUnreadMap.get(m.thread_id) ?? 0) + 1);
    });
    setUnreadMap(newUnreadMap);

    setThreads(rows.map((t) => {
      const otherId = t.user_a === user.id ? t.user_b : t.user_a;
      return {
        ...t,
        other: map.get(otherId) ?? null,
        other_doctor_profile_id: docMap.get(otherId) ?? null,
      };
    }));
    setThreadsLoading(false);
  }, [user]);

  // ── Deep-link: open by user_id (from doctor profile "Message" button) ────────

  useEffect(() => {
    if (!to || !user) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_or_create_dm_thread", { _other: to });
      if (error) { toast.error(error.message); return; }
      setActiveId(data as string);
      setMobileView("chat");
      loadThreads();
    })();
  }, [to, user, loadThreads]);

  // ── Deep-link: open by thread_id (from notification bell) ────────────────────

  useEffect(() => {
    if (!thread || !user) return;
    setActiveId(thread);
    setMobileView("chat");
    loadThreads();
  }, [thread, user, loadThreads]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // ── Load messages for active thread ──────────────────────────────────────────

  const loadMessages = useCallback(async (id: string) => {
    setMessagesLoading(true);
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setMessagesLoading(false);
    scrollToBottom("instant");
    // Mark as read + update unread map
    await supabase.rpc("mark_thread_read", { _thread_id: id });
    setUnreadMap((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }, []);

  // ── Realtime for active thread ────────────────────────────────────────────────

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);

    const channel = supabase
      .channel(`dm-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `thread_id=eq.${activeId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            // Replace matching optimistic row (same sender + body) if exists
            const optIdx = prev.findIndex(
              (m) => m.id.startsWith("opt-") && m.sender_id === incoming.sender_id && m.body === incoming.body,
            );
            if (optIdx !== -1) {
              const next = [...prev];
              next[optIdx] = incoming;
              return next;
            }
            // Skip if already present (double-fire guard)
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          scrollToBottom();
          if (incoming.sender_id !== user?.id) {
            supabase.rpc("mark_thread_read", { _thread_id: activeId });
            setUnreadMap((prev) => { const next = new Map(prev); next.delete(activeId); return next; });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages", filter: `thread_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m)),
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId, loadMessages, user?.id]);

  // ── Send message (optimistic) ─────────────────────────────────────────────────

  const send = async () => {
    if ((!body.trim() && pendingAtt.length === 0) || !activeId || !user) return;

    const text = body.trim() || (pendingAtt.length > 0 ? "📎 Attachment" : "");
    const atts = [...pendingAtt];

    // Optimistic update
    const tempId = `opt-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      thread_id: activeId,
      sender_id: user.id,
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
      attachments: atts,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    setPendingAtt([]);
    scrollToBottom();
    setSending(true);

    const { error } = await supabase.from("direct_messages").insert({
      thread_id: activeId, sender_id: user.id, body: text,
      attachments: atts.length > 0 ? atts : undefined,
    });
    setSending(false);

    if (error) {
      toast.error(error.message);
      // Roll back optimistic message and restore draft
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setBody(text);
      setPendingAtt(atts);
      return;
    }

    loadThreads(); // refresh last_message_at
  };

  // ── Filter threads ────────────────────────────────────────────────────────────

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter((t) => {
      const name = `${t.other?.first_name ?? ""} ${t.other?.last_name ?? ""}`.toLowerCase();
      const spec = (t.other?.specialization ?? t.other?.title ?? "").toLowerCase();
      return name.includes(q) || spec.includes(q);
    });
  }, [threads, search]);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const attachmentBucketId = activeId ?? "_";

  return (
    <ErrorBoundary>
      <DashboardLayout>
        <PageHeader
          title="Messages"
          description="Secure peer-to-peer messaging with other doctors on the network."
        />

        <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 overflow-hidden md:grid-cols-[320px_1fr]">

          {/* ── Thread list ─────────────────────────────────────────────────── */}
          <aside className={cn(
            "flex-col overflow-hidden rounded-xl border bg-card shadow-card",
            mobileView === "chat" ? "hidden md:flex" : "flex",
          )}>
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search threads…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <NewConversationButton
                onThreadCreated={(id) => { setActiveId(id); loadThreads(); }}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {threadsLoading ? (
                <ThreadListSkeleton />
              ) : filteredThreads.length === 0 ? (
                <div className="p-6 text-center">
                  {search ? (
                    <p className="text-sm text-muted-foreground">No threads match "{search}".</p>
                  ) : (
                    <EmptyState
                      icon={MessageSquare}
                      title="No conversations yet"
                      description={`Open a doctor's profile and tap "Message" to start chatting.`}
                    />
                  )}
                </div>
              ) : (
                filteredThreads.map((t) => {
                  const unread = unreadMap.get(t.id) ?? 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setActiveId(t.id); setMobileView("chat"); }}
                      className={cn(
                        "w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        activeId === t.id && "bg-muted/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className={cn("font-medium", unread > 0 && "text-foreground")}>
                          Dr. {t.other?.first_name} {t.other?.last_name}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {unread > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {relativeTime(t.last_message_at)}
                          </span>
                        </div>
                      </div>
                      <div className={cn(
                        "truncate text-xs",
                        unread > 0 ? "font-medium text-foreground" : "text-muted-foreground",
                      )}>
                        {t.other?.specialization ?? t.other?.title ?? "—"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── Chat pane ───────────────────────────────────────────────────── */}
          <section className={cn(
            "flex-col overflow-hidden rounded-xl border bg-card shadow-card",
            mobileView === "list" ? "hidden md:flex" : "flex",
          )}>
            {!active ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  icon={MessageSquare}
                  title="No conversation open"
                  description="Select a thread on the left, or start a new conversation."
                />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 md:hidden"
                      onClick={() => setMobileView("list")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <div className="font-semibold">
                        Dr. {active.other?.first_name} {active.other?.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {active.other?.specialization ?? active.other?.title ?? "—"}
                      </div>
                    </div>
                  </div>
                  {active.other_doctor_profile_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5 text-xs"
                      onClick={() =>
                        router.navigate({
                          to: "/referrals/new",
                          search: { specialistId: active.other_doctor_profile_id! },
                        })
                      }
                    >
                      <Send className="h-3.5 w-3.5" /> Send referral
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                  {messagesLoading ? (
                    <MessagesSkeleton />
                  ) : messages.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      No messages yet — say hi 👋
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === user?.id;
                      const isOptimistic = m.id.startsWith("opt-");
                      return (
                        <div
                          key={m.id}
                          className={cn("flex", mine ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm transition-opacity",
                              mine
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                              isOptimistic && "opacity-70",
                            )}
                          >
                            <div className="whitespace-pre-wrap">{m.body}</div>
                            {m.attachments && m.attachments.length > 0 && (
                              <div
                                className={
                                  mine
                                    ? "[&_li]:bg-primary-foreground/10 [&_li]:border-primary-foreground/20"
                                    : ""
                                }
                              >
                                <AttachmentList attachments={m.attachments} />
                              </div>
                            )}
                            <div
                              className={cn(
                                "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                mine
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground",
                              )}
                            >
                              {isOptimistic ? (
                                <span className="italic">Sending…</span>
                              ) : (
                                <>
                                  {formatDateTime(m.created_at)}
                                  {mine && (
                                    m.read_at
                                      ? <CheckCheck className="h-3 w-3" />
                                      : <Check className="h-3 w-3" />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Compose */}
                <div className="border-t p-3">
                  {pendingAtt.length > 0 && (
                    <div className="mb-2 rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
                      {pendingAtt.length} attachment{pendingAtt.length > 1 ? "s" : ""} ready to send
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    {user && (
                      <FileDropzone
                        patientId={attachmentBucketId}
                        uploadedBy={user.id}
                        value={pendingAtt}
                        onChange={setPendingAtt}
                        maxSizeMb={10}
                      />
                    )}
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
                      rows={2}
                      className="resize-none"
                    />
                    <Button
                      onClick={send}
                      disabled={sending || (!body.trim() && pendingAtt.length === 0)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </DashboardLayout>
    </ErrorBoundary>
  );
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function ThreadListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function MessagesSkeleton() {
  const items = [
    { mine: false, w: "w-48" },
    { mine: true,  w: "w-56" },
    { mine: false, w: "w-64" },
    { mine: true,  w: "w-40" },
    { mine: false, w: "w-72" },
  ];
  return (
    <div className="space-y-3">
      {items.map(({ mine, w }, i) => (
        <div key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
          <Skeleton className={cn("h-12 rounded-lg", w)} />
        </div>
      ))}
    </div>
  );
}

// ── New Conversation Dialog ────────────────────────────────────────────────────

interface DoctorSearchResult {
  user_id: string;
  name: string;
  specialization: string | null;
}

function NewConversationButton({
  onThreadCreated,
}: {
  onThreadCreated: (threadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DoctorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const { user } = useAuth();

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);

    const [{ data: profs }, { data: profsLast }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,first_name,last_name,specialization,account_type")
        .ilike("first_name", `%${query}%`)
        .eq("account_type", "doctor")
        .neq("id", user?.id ?? "")
        .limit(15),
      supabase
        .from("profiles")
        .select("id,first_name,last_name,specialization,account_type")
        .ilike("last_name", `%${query}%`)
        .eq("account_type", "doctor")
        .neq("id", user?.id ?? "")
        .limit(15),
    ]);

    const combined = [...(profs ?? []), ...(profsLast ?? [])];
    const seen = new Set<string>();
    const deduped = combined.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    setResults(
      deduped.map((p) => ({
        user_id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        specialization: p.specialization ?? null,
      })),
    );
    setSearching(false);
  };

  const startChat = async (doctorUserId: string) => {
    setCreating(doctorUserId);
    const { data, error } = await supabase.rpc("get_or_create_dm_thread", {
      _other: doctorUserId,
    });
    setCreating(null);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    setQuery("");
    setResults([]);
    onThreadCreated(data as string);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="mr-2 h-3.5 w-3.5" /> New conversation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>
            Search for a doctor by name to open a direct message thread.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Doctor name</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Patel, Sharma…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <Button
                variant="outline"
                onClick={search}
                disabled={!query.trim() || searching}
              >
                {searching ? "…" : "Search"}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            {results.map((d) => (
              <div
                key={d.user_id}
                className="flex items-center justify-between rounded-md border px-3 py-2.5"
              >
                <div>
                  <div className="font-medium">Dr. {d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.specialization ?? "—"}
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={creating === d.user_id}
                  onClick={() => startChat(d.user_id)}
                >
                  {creating === d.user_id ? "Opening…" : "Message"}
                </Button>
              </div>
            ))}
            {results.length === 0 && query && !searching && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No doctors found for "{query}".
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
