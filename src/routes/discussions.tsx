/**
 * /discussions — list of all case discussions the current user is involved in.
 * Accessible from the referral detail page and from the nav.
 *
 * Each discussion is a multi-doctor thread around a referral case.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  MessageSquareMore, Plus, CheckCircle2, Send, Search, X, UserPlus, Archive, RotateCcw,
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
import { relativeTime } from "@/lib/format";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Discussion {
  id: string;
  referral_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  status: "OPEN" | "RESOLVED" | "ARCHIVED";
  created_at: string;
  referral?: { referral_number: string; primary_diagnosis: string } | null;
  last_message?: { message: string; sender_name: string; created_at: string } | null;
  message_count?: number;
}

interface PatientOption {
  key: string;     // "gp:{uuid}" or "snap:{referral_id}"
  name: string;
  idLabel: string; // e.g. "PT-001 · 34y M" or "MRN: AB123 · 28y F"
  meta?: string;   // "Registered patient" | "Via referral REF-xxx"
}

interface ReferralOption {
  id: string;
  referral_number: string;
  primary_diagnosis: string | null;
  patient_name: string;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

interface Participant {
  user_id: string;
  display_name: string;
  specialization: string | null;
}

interface Specialist {
  user_id: string;
  name: string;
  specialization: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

function DiscussionsPage() {
  const { user, profile } = useAuth();

  // Core state
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  // Fix 2 — search + filter state
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const hasFilters = searchQ.trim() !== "" || statusFilter !== "ALL";
  const clearFilters = () => { setSearchQ(""); setStatusFilter("ALL"); };

  // Fix 3 — participants
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Doctor profile ID (doctor_profiles.id, not auth user id) — used for referral queries
  const [docProfileId, setDocProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("doctor_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDocProfileId((data as any).id as string);
          console.log("docProfileId loaded:", (data as any).id);
        }
      });
  }, [user]);

  // Fix 4 — invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [invitableDoctors, setInvitableDoctors] = useState<Specialist[]>([]);
  const [inviteSelectedId, setInviteSelectedId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Create discussion dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientOption[]>([]);
  const [allReferrals, setAllReferrals] = useState<ReferralOption[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPatientKey, setNewPatientKey] = useState("");   // required
  const [newReferralId, setNewReferralId] = useState("");   // optional
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // ── Fix 2: derived filtered list ─────────────────────────────────────────────

  const filteredDiscussions = useMemo(() => {
    let result = discussions;
    if (statusFilter !== "ALL") {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.referral?.referral_number ?? "").toLowerCase().includes(q) ||
          (d.referral?.primary_diagnosis ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [discussions, searchQ, statusFilter]);

  // Fix 4: derived invite search
  const filteredInvitable = useMemo(() => {
    if (!inviteSearch.trim()) return invitableDoctors;
    const q = inviteSearch.toLowerCase();
    return invitableDoctors.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.specialization ?? "").toLowerCase().includes(q),
    );
  }, [invitableDoctors, inviteSearch]);

  // ── Load discussions + referral enrichment + Fix 6: last message + count ─────

  const load = useCallback(async () => {
    if (!user) return;

    const { data: participated } = await supabase
      .from("case_discussion_participants")
      .select("discussion_id")
      .eq("user_id", user.id);

    const participatedIds = (participated ?? []).map((p: any) => p.discussion_id as string);

    const { data } = await supabase
      .from("case_discussions")
      .select("id,referral_id,created_by,title,description,status,created_at")
      .or(
        `created_by.eq.${user.id}${participatedIds.length > 0 ? `,id.in.(${participatedIds.join(",")})` : ""}`,
      )
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Enrich with referral info
    const refIds = [...new Set((data as any[]).map((d) => d.referral_id as string | null).filter(Boolean))] as string[];
    const { data: refs } = refIds.length
      ? await supabase
          .from("referrals")
          .select("id,referral_number,primary_diagnosis")
          .in("id", refIds)
      : { data: [] };
    const refMap = new Map((refs ?? []).map((r: any) => [r.id as string, r]));

    // Fix 6 — fetch latest message + count per discussion
    const discIds = (data as any[]).map((d) => d.id as string);
    const { data: msgData } = discIds.length
      ? await supabase
          .from("case_discussion_messages")
          .select("discussion_id,message,sender_name,created_at")
          .in("discussion_id", discIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const lastMsgMap = new Map<string, { message: string; sender_name: string; created_at: string }>();
    const countMap = new Map<string, number>();
    for (const m of (msgData ?? []) as any[]) {
      countMap.set(m.discussion_id, (countMap.get(m.discussion_id) ?? 0) + 1);
      if (!lastMsgMap.has(m.discussion_id)) lastMsgMap.set(m.discussion_id, m);
    }

    const enriched: Discussion[] = (data as any[]).map((d) => ({
      ...d,
      referral: refMap.get(d.referral_id) ?? null,
      last_message: lastMsgMap.get(d.id) ?? null,
      message_count: countMap.get(d.id) ?? 0,
    }));

    setDiscussions(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Fix 1: realtime subscription on case_discussion_messages ─────────────────

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

    const channel = supabase
      .channel(`disc-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "case_discussion_messages",
          filter: `discussion_id=eq.${activeId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            // Replace matching optimistic row
            const optIdx = prev.findIndex(
              (m) =>
                m.id.startsWith("opt-") &&
                m.sender_id === incoming.sender_id &&
                m.message === incoming.message,
            );
            if (optIdx !== -1) {
              const next = [...prev];
              next[optIdx] = incoming;
              return next;
            }
            // Dedup guard
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId]);

  // Scroll to bottom whenever messages list changes
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fix 3: fetch participants whenever active discussion changes ──────────────

  useEffect(() => {
    if (!activeId) { setParticipants([]); return; }
    (async () => {
      const { data } = await supabase
        .from("case_discussion_participants")
        .select("user_id,display_name,specialization")
        .eq("discussion_id", activeId);
      setParticipants((data ?? []) as Participant[]);
    })();
  }, [activeId]);

  // ── Send message (optimistic) ─────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!draft.trim() || !activeId || !user || !profile) return;
    const text = draft.trim();
    const senderName = `Dr. ${(profile as any).first_name} ${(profile as any).last_name}`;
    const tempId = `opt-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      sender_name: senderName,
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);

    const { data: inserted, error } = await supabase
      .from("case_discussion_messages")
      .insert({ discussion_id: activeId, sender_id: user.id, sender_name: senderName, message: text })
      .select()
      .single();
    setSending(false);
    if (error) {
      toast.error(error.message);
      setMessages((p) => p.filter((m) => m.id !== tempId));
      setDraft(text);
      return;
    }
    if (inserted) setMessages((p) => p.map((m) => (m.id === tempId ? (inserted as Message) : m)));

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

  // ── Fix 5: unified status action ──────────────────────────────────────────────

  const updateStatus = async (id: string, status: "OPEN" | "RESOLVED" | "ARCHIVED") => {
    const { error } = await supabase.from("case_discussions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setDiscussions((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
    const label = status === "OPEN" ? "Re-opened" : status === "RESOLVED" ? "Resolved" : "Archived";
    toast.success(`Discussion ${label}`);
  };

  // ── Create discussion ─────────────────────────────────────────────────────────

  const openCreate = async () => {
    console.log("openCreate called, docProfileId:", docProfileId);
    if (!user) return;

    // 1. Fetch all referrals + global patients in parallel
    const [{ data: refs }, { data: globalPts }, { data: docs }] = await Promise.all([
      supabase
        .from("referrals")
        .select("id, referral_number, primary_diagnosis, patient_snapshot")
        .neq("status", "CANCELLED")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.rpc("search_global_patients", { _q: "" }),
      supabase.from("doctor_profiles").select("user_id").eq("is_public", true).neq("user_id", user.id),
    ]);

    console.log("referrals:", refs?.length, "globalPts:", (globalPts as any[])?.length);

    // 2. Build unified patient list (deduped by name + id)
    const patientMap = new Map<string, PatientOption>();

    // Helper: compute age from ISO date string
    const calcAge = (dob?: string | null): string =>
      dob ? `${Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000)}y` : "";

    // Global patients first (authoritative) — include display_id + age + gender
    for (const p of (globalPts ?? []) as any[]) {
      const name = `${p.first_name} ${p.last_name}`.trim();
      const key = `gp:${p.id}`;
      const agePart = calcAge(p.date_of_birth);
      const genderPart = p.gender ? (p.gender as string).charAt(0).toUpperCase() : "";
      const idLabel = [p.display_id, [agePart, genderPart].filter(Boolean).join(" ")]
        .filter(Boolean).join(" · ");
      patientMap.set(key, { key, name, idLabel, meta: "Registered" });
    }

    // Patients from referral snapshots not already in map
    for (const r of (refs ?? []) as any[]) {
      const snap = r.patient_snapshot as any;
      const snapName: string = snap?.name ?? "";
      if (!snapName) continue;
      const alreadyExists = Array.from(patientMap.values()).some(
        (p) => p.name.toLowerCase() === snapName.toLowerCase(),
      );
      if (!alreadyExists) {
        const key = `snap:${r.id}`;
        const mrnPart  = snap?.mrn  ? `MRN: ${snap.mrn}` : "";
        const agePart  = snap?.age  ? `${snap.age}y`     : "";
        const genderPart = snap?.gender ? (snap.gender as string).charAt(0).toUpperCase() : "";
        const idLabel = [mrnPart, [agePart, genderPart].filter(Boolean).join(" ")]
          .filter(Boolean).join(" · ");
        patientMap.set(key, { key, name: snapName, idLabel, meta: `Via ${r.referral_number}` });
      }
    }

    setAllPatients(
      Array.from(patientMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    );

    // 3. Store referrals for optional second dropdown
    setAllReferrals(
      (refs ?? []).map((r: any) => ({
        id: r.id,
        referral_number: r.referral_number,
        primary_diagnosis: r.primary_diagnosis ?? null,
        patient_name: (r.patient_snapshot as any)?.name ?? "",
      })),
    );

    // 4. Load specialists for invite list
    if (docs && docs.length > 0) {
      const userIds = (docs as any[]).map((d: any) => d.user_id as string);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,specialization")
        .in("id", userIds);
      setSpecialists(
        (profs ?? []).map((p: any) => ({
          user_id: p.id,
          name: `Dr. ${p.first_name} ${p.last_name}`,
          specialization: p.specialization ?? null,
        })),
      );
    }
    setNewPatientKey("");
    setNewReferralId("");
    setCreateOpen(true);
  };

  const createDiscussion = async () => {
    if (!user || !profile || !newTitle.trim() || !newPatientKey) return;
    setCreating(true);
    const senderName = `Dr. ${(profile as any).first_name} ${(profile as any).last_name}`;

    // Attach a referral_id if one was selected; otherwise null (requires nullable column)
    const { data: disc, error } = await supabase
      .from("case_discussions")
      .insert({
        referral_id: newReferralId || "",
        created_by: user.id,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); setCreating(false); return; }

    await supabase.from("case_discussion_participants").insert({
      discussion_id: disc.id,
      user_id: user.id,
      display_name: senderName,
      specialization: (profile as any).specialization ?? null,
    });

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
    setNewTitle(""); setNewDesc(""); setNewPatientKey(""); setNewReferralId(""); setInviteIds([]);
    toast.success("Discussion created");
    await load();
    setActiveId(disc.id);
  };

  // ── Fix 4: invite doctor to active discussion ─────────────────────────────────

  const openInvite = async () => {
    if (!user) return;
    const { data: docs } = await supabase
      .from("doctor_profiles")
      .select("user_id")
      .eq("is_public", true)
      .neq("user_id", user.id);

    if (docs && docs.length > 0) {
      const userIds = (docs as any[]).map((d: any) => d.user_id as string);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,first_name,last_name,specialization")
        .in("id", userIds);
      const existingIds = new Set(participants.map((p) => p.user_id));
      setInvitableDoctors(
        (profs ?? [])
          .filter((p: any) => !existingIds.has(p.id as string))
          .map((p: any) => ({
            user_id: p.id,
            name: `Dr. ${p.first_name} ${p.last_name}`,
            specialization: p.specialization ?? null,
          })),
      );
    } else {
      setInvitableDoctors([]);
    }
    setInviteSearch("");
    setInviteSelectedId(null);
    setInviteOpen(true);
  };

  const inviteDoctor = async () => {
    if (!inviteSelectedId || !activeId || !user || !profile) return;
    setInviting(true);
    const spec = invitableDoctors.find((s) => s.user_id === inviteSelectedId);
    const { error } = await supabase.from("case_discussion_participants").insert({
      discussion_id: activeId,
      user_id: inviteSelectedId,
      display_name: spec?.name ?? "Doctor",
      specialization: spec?.specialization ?? null,
    });
    if (error) { toast.error(error.message); setInviting(false); return; }

    void notifyUser(inviteSelectedId, {
      type: "CASE_DISCUSSION_INVITE",
      title: `Invited to case discussion: "${active?.title ?? ""}"`,
      message: `Dr. ${(profile as any).first_name} ${(profile as any).last_name} invited you to discuss a case.`,
      data: { discussion_id: activeId },
    });

    // Refresh participants list
    const { data } = await supabase
      .from("case_discussion_participants")
      .select("user_id,display_name,specialization")
      .eq("discussion_id", activeId);
    setParticipants((data ?? []) as Participant[]);
    setInviting(false);
    setInviteOpen(false);
    toast.success("Doctor invited to discussion");
  };

  const active = discussions.find((d) => d.id === activeId);

  // ── Render ────────────────────────────────────────────────────────────────────

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

          {/* ── Left column: filter bar + discussion list ── */}
          <div className="flex flex-col gap-3">

            {/* Fix 2 — search + status filter */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search title, referral…"
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />Clear
                  </button>
                )}
              </div>
            </div>

            {/* Discussion list */}
            <div className="space-y-2 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-1">
              {filteredDiscussions.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No discussions match your filters.
                </p>
              ) : (
                filteredDiscussions.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { setActiveId(d.id === activeId ? null : d.id); setMessages([]); }}
                    className={`w-full rounded-xl border bg-card px-4 py-3 text-left shadow-card transition-colors hover:border-primary/40 ${
                      activeId === d.id ? "border-primary/60 bg-primary-soft/10" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{d.title}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {d.referral?.referral_number ?? "—"} · {d.referral?.primary_diagnosis ?? ""}
                        </div>
                        {/* Fix 6 — last message preview or description */}
                        {(d.last_message || d.description) && (
                          <div className="mt-1 truncate text-xs text-muted-foreground/75">
                            {d.last_message
                              ? `${d.last_message.sender_name.replace(/^Dr\. /, "")}: ${
                                  d.last_message.message.length > 55
                                    ? `${d.last_message.message.slice(0, 55)}…`
                                    : d.last_message.message
                                }`
                              : (d.description ?? "").length > 60
                                ? `${d.description!.slice(0, 60)}…`
                                : d.description
                            }
                          </div>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          d.status === "OPEN"
                            ? "bg-success/15 text-success-foreground"
                            : d.status === "RESOLVED"
                            ? "bg-info/10 text-info-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{relativeTime(d.created_at)}</span>
                      {(d.message_count ?? 0) > 0 && (
                        <span>· {d.message_count} msg{d.message_count !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right column: thread view ── */}
          {active ? (
            <div className="flex flex-col rounded-xl border bg-card shadow-card">

              {/* Thread header */}
              <div className="border-b px-5 py-4">
                {/* Title row + Fix 5 action buttons */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{active.title}</h2>
                    {active.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{active.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Referral:{" "}
                      <span className="font-medium text-foreground">{active.referral?.referral_number}</span>
                      {" · "}{active.referral?.primary_diagnosis}
                    </p>
                  </div>

                  {/* Fix 5 — status action buttons (creator only) */}
                  {active.created_by === user?.id && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {active.status === "OPEN" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(active.id, "RESOLVED")}
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success-foreground" />Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(active.id, "ARCHIVED")}
                          >
                            <Archive className="mr-1.5 h-3.5 w-3.5" />Archive
                          </Button>
                        </>
                      )}
                      {active.status === "RESOLVED" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(active.id, "OPEN")}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Re-open
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(active.id, "ARCHIVED")}
                          >
                            <Archive className="mr-1.5 h-3.5 w-3.5" />Archive
                          </Button>
                        </>
                      )}
                      {active.status === "ARCHIVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(active.id, "OPEN")}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Re-open
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Fix 3 — participant avatar chips + Fix 4 invite button */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Participants:</span>
                  {participants.map((p) => (
                    <span
                      key={p.user_id}
                      title={`${p.display_name}${p.specialization ? ` · ${p.specialization}` : ""}`}
                      className="inline-flex h-7 w-7 cursor-default items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-accent-foreground"
                    >
                      {avatarInitials(p.display_name)}
                    </span>
                  ))}
                  {active.status === "OPEN" && (
                    <button
                      type="button"
                      onClick={openInvite}
                      title="Invite a doctor"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="max-h-[380px] flex-1 space-y-3 overflow-y-auto p-5">
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No messages yet. Start the discussion.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            mine ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <div className="mb-0.5 text-[11px] opacity-70">
                            {m.sender_name} · {relativeTime(m.created_at)}
                          </div>
                          <div className="whitespace-pre-line">{m.message}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEnd} />
              </div>

              {/* Compose or closed banner */}
              {active.status === "OPEN" ? (
                <div className="flex gap-2 border-t p-4">
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
              ) : (
                <div className="border-t bg-muted/30 p-3 text-center text-xs text-muted-foreground">
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

      {/* ── Create discussion dialog ── */}
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
            {/* Patient selector (required) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Patient *</Label>
              <Select value={newPatientKey} onValueChange={setNewPatientKey}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {allPatients.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No patients found. Register a patient or create a referral first.
                    </div>
                  ) : (
                  allPatients.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{p.name}</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {p.idLabel && (
                            <span className="rounded bg-muted px-1 py-0.5 font-mono">{p.idLabel}</span>
                          )}
                          {p.meta && <span>{p.meta}</span>}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Related referral (optional, filtered to selected patient) */}
            {newPatientKey && (() => {
              const selectedName = allPatients.find((p) => p.key === newPatientKey)?.name ?? "";
              const filtered = allReferrals.filter(
                (r) => !selectedName || r.patient_name.toLowerCase() === selectedName.toLowerCase(),
              );
              return filtered.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Related referral <span className="text-muted-foreground">(optional)</span></Label>
                  <Select value={newReferralId} onValueChange={setNewReferralId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Select referral (optional)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[180px]">
                      {filtered.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.referral_number}{r.primary_diagnosis ? ` — ${r.primary_diagnosis}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null;
            })()}
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
              <div className="max-h-[160px] divide-y overflow-y-auto rounded-md border">
                {specialists.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No other verified doctors found.</p>
                ) : (
                  specialists.map((s) => (
                    <label
                      key={s.user_id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={inviteIds.includes(s.user_id)}
                        onChange={(e) =>
                          setInviteIds((prev) =>
                            e.target.checked
                              ? [...prev, s.user_id]
                              : prev.filter((id) => id !== s.user_id),
                          )
                        }
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <div>
                        <div className="text-xs font-medium">{s.name}</div>
                        {s.specialization && (
                          <div className="text-[10px] text-muted-foreground">{s.specialization}</div>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={creating || !newTitle.trim() || !newPatientKey}
              onClick={createDiscussion}
            >
              <MessageSquareMore className="mr-1.5 h-4 w-4" />
              {creating ? "Creating…" : "Start discussion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fix 4: Invite doctor dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Invite a doctor
            </DialogTitle>
            <DialogDescription>
              Add a verified doctor to this discussion thread.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Search by name or specialization…"
                className="pl-8 text-xs"
              />
            </div>
            <div className="max-h-[220px] divide-y overflow-y-auto rounded-md border">
              {filteredInvitable.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  {invitableDoctors.length === 0
                    ? "All verified doctors are already participants."
                    : "No doctors match your search."}
                </p>
              ) : (
                filteredInvitable.map((d) => (
                  <label
                    key={d.user_id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
                  >
                    <input
                      type="radio"
                      name="invite-doctor"
                      value={d.user_id}
                      checked={inviteSelectedId === d.user_id}
                      onChange={() => setInviteSelectedId(d.user_id)}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <div>
                      <div className="text-xs font-medium">{d.name}</div>
                      {d.specialization && (
                        <div className="text-[10px] text-muted-foreground">{d.specialization}</div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button disabled={inviting || !inviteSelectedId} onClick={inviteDoctor}>
              {inviting ? "Inviting…" : "Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
