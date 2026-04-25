import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { Send, Inbox, ArrowRight, Search, ChevronDown } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UrgencyBadge } from "@/components/common/UrgencyBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/referrals/")({
  head: () => ({ meta: [{ title: "Referrals — Doctor Bridge" }] }),
  validateSearch: z.object({ tab: z.enum(["sent", "received"]).optional() }),
  component: ReferralsPage,
});

interface ReferralRow {
  id: string;
  referral_number: string;
  status: string;
  urgency: "ROUTINE" | "SEMI_URGENT" | "URGENT";
  primary_diagnosis: string;
  diagnosis_code: string | null;
  patient_snapshot: { name?: string; age?: number; gender?: string };
  created_at: string;
  sent_at: string | null;
  referring_doctor_id: string;
  specialist_id: string;
  referring_doctor: { user_id: string; profile: { first_name: string; last_name: string } | null } | null;
  specialist: { user_id: string; profile: { first_name: string; last_name: string } | null } | null;
}

const PAGE_SIZE = 25;

function ReferralsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { tab } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"sent" | "received">(tab ?? "sent");
  const [myDocId, setMyDocId] = useState<string | null | undefined>(undefined);

  // Separate state for sent and received tabs
  const [sent, setSent]           = useState<ReferralRow[]>([]);
  const [received, setReceived]   = useState<ReferralRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMoreSent, setLoadingMoreSent]         = useState(false);
  const [loadingMoreReceived, setLoadingMoreReceived] = useState(false);
  const [hasMoreSent, setHasMoreSent]         = useState(false);
  const [hasMoreReceived, setHasMoreReceived] = useState(false);
  const [offsetSent, setOffsetSent]           = useState(0);
  const [offsetReceived, setOffsetReceived]   = useState(0);

  // Sync tab changes to URL
  const handleTabChange = (value: string) => {
    const t = value as "sent" | "received";
    setActiveTab(t);
    router.navigate({ to: "/referrals/", search: { tab: t }, replace: true });
  };

  // Step 1: resolve my doctor profile ID once
  useEffect(() => {
    if (!user) return;
    supabase.from("doctor_profiles").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setMyDocId(data?.id ?? null));
  }, [user]);

  // Enrich doctor name info
  const enrich = useCallback(async (rows: any[]): Promise<ReferralRow[]> => {
    const docIds = Array.from(new Set(rows.flatMap((r) => [r.referring_doctor_id, r.specialist_id])));
    const { data: docs } = docIds.length
      ? await supabase.from("doctor_profiles").select("id,user_id").in("id", docIds)
      : { data: [] as any[] };
    const userIds = Array.from(new Set((docs ?? []).map((d: any) => d.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id,first_name,last_name").in("id", userIds)
      : { data: [] as any[] };
    const docMap  = new Map((docs  ?? []).map((d: any) => [d.id, d]));
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return rows.map((r) => {
      const refDoc = docMap.get(r.referring_doctor_id);
      const spDoc  = docMap.get(r.specialist_id);
      return {
        ...r,
        referring_doctor: refDoc ? { user_id: refDoc.user_id, profile: profMap.get(refDoc.user_id) ?? null } : null,
        specialist:        spDoc  ? { user_id: spDoc.user_id,  profile: profMap.get(spDoc.user_id)  ?? null } : null,
      };
    });
  }, []);

  // Fetch sent referrals (where I am the referring doctor)
  const fetchSent = useCallback(async (from: number, append: boolean) => {
    if (!myDocId) return;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("referrals")
      .select(`id,referral_number,status,urgency,primary_diagnosis,diagnosis_code,
        patient_snapshot,created_at,sent_at,referring_doctor_id,specialist_id`)
      .eq("referring_doctor_id", myDocId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) { console.error(error); return; }
    const rows = data ?? [];
    setHasMoreSent(rows.length === PAGE_SIZE);
    const enriched = await enrich(rows);
    setSent((prev) => append ? [...prev, ...enriched] : enriched);
  }, [myDocId, enrich]);

  // Fetch received referrals (where I am the specialist)
  const fetchReceived = useCallback(async (from: number, append: boolean) => {
    if (!myDocId) return;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("referrals")
      .select(`id,referral_number,status,urgency,primary_diagnosis,diagnosis_code,
        patient_snapshot,created_at,sent_at,referring_doctor_id,specialist_id`)
      .eq("specialist_id", myDocId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) { console.error(error); return; }
    const rows = data ?? [];
    setHasMoreReceived(rows.length === PAGE_SIZE);
    const enriched = await enrich(rows);
    setReceived((prev) => append ? [...prev, ...enriched] : enriched);
  }, [myDocId, enrich]);

  // Initial load
  useEffect(() => {
    if (myDocId === undefined) return;
    if (myDocId === null) { setLoading(false); return; }
    setLoading(true);
    setOffsetSent(0);
    setOffsetReceived(0);
    Promise.all([fetchSent(0, false), fetchReceived(0, false)])
      .finally(() => setLoading(false));
  }, [myDocId, fetchSent, fetchReceived]);

  const loadMoreSent = async () => {
    const next = offsetSent + PAGE_SIZE;
    setLoadingMoreSent(true);
    await fetchSent(next, true);
    setOffsetSent(next);
    setLoadingMoreSent(false);
  };

  const loadMoreReceived = async () => {
    const next = offsetReceived + PAGE_SIZE;
    setLoadingMoreReceived(true);
    await fetchReceived(next, true);
    setOffsetReceived(next);
    setLoadingMoreReceived(false);
  };

  return (
    <ErrorBoundary>
    <DashboardLayout>
      <PageHeader
        title="Referrals"
        description="Track patient referrals you've sent and received."
        actions={
          <Button asChild>
            <Link to="/referrals/new"><Send className="mr-1.5 h-4 w-4" /> New referral</Link>
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="sent">
            Sent {!loading && `(${sent.length}${hasMoreSent ? "+" : ""})`}
          </TabsTrigger>
          <TabsTrigger value="received">
            Received {!loading && `(${received.length}${hasMoreReceived ? "+" : ""})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="mt-4">
          <ReferralList rows={sent} loading={loading} side="sent"
            hasMore={hasMoreSent} loadingMore={loadingMoreSent} onLoadMore={loadMoreSent} />
        </TabsContent>
        <TabsContent value="received" className="mt-4">
          <ReferralList rows={received} loading={loading} side="received"
            hasMore={hasMoreReceived} loadingMore={loadingMoreReceived} onLoadMore={loadMoreReceived} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
    </ErrorBoundary>
  );
}

function ReferralList({
  rows, loading, side, hasMore, loadingMore, onLoadMore,
}: {
  rows: ReferralRow[]; loading: boolean; side: "sent" | "received";
  hasMore: boolean; loadingMore: boolean; onLoadMore: () => void;
}) {
  if (loading) return <TableSkeleton columns={8} rows={5} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={side === "sent" ? Send : Inbox}
        title={side === "sent" ? "No referrals sent yet" : "No referrals received yet"}
        description={
          side === "sent"
            ? "Find a verified specialist and send your first referral with full clinical context."
            : "When other doctors refer patients to you, they'll show up here. Make sure your profile is visible and accepting referrals."
        }
        action={
          side === "sent" ? (
            <Button asChild>
              <Link to="/doctors"><Search className="mr-1.5 h-4 w-4" />Find a specialist</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Ref #</th>
            <th className="px-4 py-3 text-left">Patient</th>
            <th className="px-4 py-3 text-left">Diagnosis</th>
            <th className="px-4 py-3 text-left">{side === "sent" ? "To" : "From"}</th>
            <th className="px-4 py-3 text-left">Urgency</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Sent</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const counterparty = side === "sent" ? r.specialist : r.referring_doctor;
            return (
              <tr key={r.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => {}}>
                <td className="px-4 py-3 font-mono text-xs">{r.referral_number}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.patient_snapshot?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.patient_snapshot?.age ? `${r.patient_snapshot.age}y` : ""} {r.patient_snapshot?.gender ?? ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.primary_diagnosis}</div>
                  {r.diagnosis_code && <div className="font-mono text-xs text-muted-foreground">{r.diagnosis_code}</div>}
                </td>
                <td className="px-4 py-3">
                  {counterparty?.profile
                    ? `Dr. ${counterparty.profile.first_name} ${counterparty.profile.last_name}`
                    : "—"}
                </td>
                <td className="px-4 py-3"><UrgencyBadge urgency={r.urgency} /></td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(r.sent_at ?? r.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      to="/referrals/$referralId"
                      params={{ referralId: r.id }}
                      search={{ from: side }}
                    >
                      Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {hasMore && (
        <div className="border-t px-4 py-3 text-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading…
              </>
            ) : (
              <>
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                Load more
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
