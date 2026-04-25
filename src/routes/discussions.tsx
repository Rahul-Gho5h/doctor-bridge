/**
 * /discussions — list of all case discussions the current user is involved in.
 * Accessible from the referral detail page and from the nav.
 *
 * Each discussion is a multi-doctor thread around a referral case.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  MessageSquareMore, Plus, CheckCircle2, Send,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { notifyUser } from "@/lib/notify";

export const Route = createFileRoute("/discussions")({
  head: () => ({ meta: [{ title: "Case discussions — Doctor Bridge" }] }),
  component: () => (
    <ErrorBoundary>
      <DiscussionsPage />
    </ErrorBoundary>
  ),
});

interface Discussion {
  id: string;
  referral_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: "OPEN" | "RESOLVED" | "ARCHIVED";
  created_at: string;
  referral?: { referral_number: string; primary_diagnosis: string } | null;
  participant_count?: number;
  message_count?: number;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface Specialist {
  user_id: string;
  name: string;
  specialization: string | null;
}

function DiscussionsPage() {
  const { user, profile } = useAuth();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  // New discussion dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [referrals, setReferrals] = useState<{ id: string; referral_number: string; primary_diagnosis: string }[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newReferralId, setNewReferralId] = useState("");
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    // Get discussions where user is either creator or participant
    const { data: participated } = await supabase
      .from("case_discussion_participants")
      .select("discussion_id")
      .eq("user_id", user.id);

    const participatedIds = (participated ?? []).map((p: any) => p.discussion_id);

    const { data } = await supabase
      .from("case_discussions")
      .select("id,referral_id,created_by,title,description,status,created_at")
      .or(`created_by.eq.${user.id}${participatedIds.length > 0 ? `,id.in.(${participatedIds.join(",")})` : ""}`)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Enrich with referral info
    const refIds = [...new Set((data as any[]).map((d) => d.referral_id))];
    const { data: refs } = refIds.length
      ? await supabase.from("referrals").select("id,referral_number,primary_diagnosis").in("id", refIds)
      : { data: [] };
    const refMap = new Map((refs ?? []).map((r: any) => [r.id, r]));

    const enriched: Discussion[] = (data as any[]).map((d) => ({
      ...d,
      referral: refMap.get(d.referral_id) ?? null,
    }));

    setDiscussions(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Load messages for active discussion + poll every 5s
  useEffect(() => {
    if (!activeId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("case_discussion_messages")
        .select("id,sender_id,sender_name,message,created_at")
        .eq("discussion_id", activeId)
        .order("created_at");
      setMessages((data ?? []) as Message[]);
    };
    void fetchMessages();
    const interval = setInterval(() => { void fetchMessages(); }, 5000);
    return () => clearInterval(interval);
  }, [activeId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    if (!draft.trim() || !activeId || !user || !profile) return;
    const text = draft.trim();
    const senderName = `Dr. ${profile.first_name} ${profile.last_name}`;
    const tempId = `opt-${Date.now()}`;
    const optimistic: Message = { id: tempId, sender_id: user.id, sender_name: senderName, message: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);

    const { data: inserted, error } = await supabase
      .from("case_discussion_messages")
      .insert({ discussion_id: activeId, sender_id: user.id, sender_name: senderName, message: text })
      .select().single();
    setSending(false);
    if (error) { toast.error(error.message); setMessages((p) => p.filter((m) => m.id !== tempId)); setDraft(text); return; }
    if (inserted) setMessages((p) => p.map((m) => m.id === tempId ? (inserted as Message) : m));

    // Notify other participants
    const disc = discussions.find((d) => d.id === activeId);
    if (disc) {
      const { data: parts } = await supabase
        .from("case_discussion_participants")
        .select("user_id")
        .eq("discussion_id", activeId)
        .neq("user_id", user.id);
      for (const p of (parts ?? []) as any[]) {
        void notifyUser(p.user_id, {
          type: "CASE_DISCUSSION_MESSAGE",
          title: `New message in "${disc.title}"`,
          message: text.length > 100 ? `${text.slice(0, 100)}…` : text,
          data: { discussion_id: activeId },
        });
      }
    }
  };

  // Prepare create dialog
  const openCreate = async () => {
    if (!user) return;
    const [{ data: refs2 }, { data: docs }] = await Promise.all([
      supabase.from("referrals")
        .select("id,referral_number,primary_diagnosis")
        .or(`referring_doctor_id.eq.${user.id},specialist_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("doctor_profiles").select("user_id,nmc_number").eq("is_public", true).neq("user_id", user.id),
    ]);
    setReferrals((refs2 ?? []) as any[]);
    if (docs && docs.length > 0) {
      const userIds = (docs as any[]).map((d) => d.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,first_name,last_name,specialization").in("id", userIds);
      setSpecialists(
        (profs ?? []).map((p: any) => ({
          user_id: p.id,
          name: `Dr. ${p.first_name} ${p.last_name}`,
          specialization: p.specialization,
        }))
      );
    }
    setCreateOpen(true);
  };

  const createDiscussion = async () => {
    if (!user || !profile || !newTitle.trim() || !newReferralId) return;
    setCreating(true);
    const senderName = `Dr. ${profile.first_name} ${profile.last_name}`;

    const { data: disc, error } = await supabase
      .from("case_discussions")
      .insert({ referral_id: newReferralId, created_by: user.id, title: newTitle.trim(), description: newDesc.trim() || null })
      .select().single();
    if (error) { toast.error(error.message); setCreating(false); return; }

    // Add creator as participant
    await supabase.from("case_discussion_participants").insert({
      discussion_id: disc.id,
      user_id: user.id,
      display_name: senderName,
      specialization: (profile as any).specialization ?? null,
    });

    // Add invited specialists as participants + notify them
    for (const uid of inviteIds) {
      const spec = specialists.find((s) => s.user_id === uid);
      await supabase.from("case_discussion_participants").insert({
        discussion_id: disc.id,
        user_id: uid,
        display_name: spec?.name ?? "Doctor",
        specialization: spec?.specialization ?? null,
      });
      void notifyUser(uid, {
        type: "CASE_DISCUSSION_INVITE",
        title: `Invited to case discussion: "${newTitle.trim()}"`,
        message: `${senderName} invited you to discuss a case.`,
        data: { discussion_id: disc.id },
      });
    }

    setCreating(false);
    setCreateOpen(false);
    setNewTitle(""); setNewDesc(""); setNewReferralId(""); setInviteIds([]);
    toast.success("Discussion created");
    await load();
    setActiveId(disc.id);
  };

  const resolveDiscussion = async (id: string) => {
    await supabase.from("case_discussions").update({ status: "RESOLVED" }).eq("id", id);
    setDiscussions((prev) => prev.map((d) => d.id === id ? { ...d, status: "RESOLVED" } : d));
    toast.success("Discussion marked as resolved");
  };

  const active = discussions.find((d) => d.id === activeId);

  return (
    <DashboardLayout>
      <PageHeader
        title="Case discussions"
        description="Multi-doctor discussion threads for complex referral cases."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New discussion
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : discussions.length === 0 ? (
        <EmptyState
          icon={MessageSquareMore}
          title="No discussions yet"
          description="Start a multi-doctor discussion thread on any complex referral case."
          action={
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Start first discussion
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* Discussion list */}
          <div className="space-y-2 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto lg:pr-1">
            {discussions.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { setActiveId(d.id === activeId ? null : d.id); setMessages([]); }}
                className={`w-full rounded-xl border bg-card px-4 py-3 text-left shadow-card hover:border-primary/40 transition-colors ${activeId === d.id ? "border-primary/60 bg-primary-soft/10" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{d.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {d.referral?.referral_number ?? "—"} · {d.referral?.primary_diagnosis ?? ""}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    d.status === "OPEN"
                      ? "bg-success/15 text-success-foreground"
                      : d.status === "RESOLVED"
                      ? "bg-info/10 text-info-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {d.status}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{relativeTime(d.created_at)}</div>
              </button>
            ))}
          </div>

          {/* Thread view */}
          {active ? (
            <div className="rounded-xl border bg-card shadow-card flex flex-col">
              {/* Thread header */}
              <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">{active.title}</h2>
                  {active.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{active.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Referral: <span className="font-medium text-foreground">{active.referral?.referral_number}</span>
                    {" · "}{active.referral?.primary_diagnosis}
                  </p>
                </div>
                {active.status === "OPEN" && active.created_by === user?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveDiscussion(active.id)}
                    className="shrink-0"
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success-foreground" />Resolve
                  </Button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[420px]">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No messages yet. Start the discussion.</p>
                ) : messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <div className="text-[11px] opacity-70 mb-0.5">{m.sender_name} · {relativeTime(m.created_at)}</div>
                        <div className="whitespace-pre-line">{m.message}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEnd} />
              </div>

              {/* Input */}
              {active.status === "OPEN" && (
                <div className="border-t p-4 flex gap-2">
                  <Textarea
                    rows={2}
                    placeholder="Add to the discussion…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />
                  <Button onClick={sendMessage} disabled={sending || !draft.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {active.status !== "OPEN" && (
                <div className="border-t p-3 text-center text-xs text-muted-foreground bg-muted/30">
                  This discussion is {active.status.toLowerCase()} — no new messages.
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center text-sm text-muted-foreground">
              Select a discussion to view the thread.
            </div>
          )}
        </div>
      )}

      {/* Create discussion dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareMore className="h-5 w-5 text-primary" /> New case discussion
            </DialogTitle>
            <DialogDescription>
              Open a multi-doctor thread to collaborate on a complex case.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Referral *</Label>
              <Select value={newReferralId} onValueChange={setNewReferralId}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Select referral" /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {referrals.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.referral_number} · {r.primary_diagnosis}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Discussion title *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Unusual presentation — need cardiology + nephrology input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Context / question (optional)</Label>
              <Textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What do you need input on? Describe the clinical challenge."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invite specialists (optional)</Label>
              <div className="max-h-[160px] overflow-y-auto rounded-md border divide-y">
                {specialists.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No other verified doctors found.</p>
                ) : specialists.map((s) => (
                  <label key={s.user_id} className="flex items-center gap-3 cursor-pointer px-3 py-2 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={inviteIds.includes(s.user_id)}
                      onChange={(e) => setInviteIds((prev) =>
                        e.target.checked ? [...prev, s.user_id] : prev.filter((id) => id !== s.user_id)
                      )}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <div>
                      <div className="text-xs font-medium">{s.name}</div>
                      {s.specialization && <div className="text-[10px] text-muted-foreground">{s.specialization}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={creating || !newTitle.trim() || !newReferralId} onClick={createDiscussion}>
              <MessageSquareMore className="mr-1.5 h-4 w-4" />
              {creating ? "Creating…" : "Start discussion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
