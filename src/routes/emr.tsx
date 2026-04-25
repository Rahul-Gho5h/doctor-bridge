import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Stethoscope, Pill, FlaskConical, Activity, FileText, NotebookPen,
  Search, User as UserIcon, Calendar, ArrowRight, Filter,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { EmrSkeleton } from "@/components/common/Skeletons";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/emr")({
  head: () => ({ meta: [{ title: "EMR — Doctor Bridge" }] }),
  component: EmrPage,
});

type EncounterType = "ALL" | "VISIT" | "DIAGNOSIS" | "PRESCRIPTION" | "TEST" | "SURGERY" | "NOTE";

interface EncounterRow {
  id: string;
  global_patient_id: string;
  type: Exclude<EncounterType, "ALL">;
  title: string;
  details: string | null;
  occurred_at: string;
  hospital_name: string | null;
  patient_name?: string;
  patient_display_id?: string;
}

const TYPE_META: Record<Exclude<EncounterType, "ALL">, { label: string; icon: typeof Stethoscope; color: string }> = {
  VISIT:        { label: "Visit",        icon: Stethoscope, color: "bg-info/15 text-info-foreground border-info/30" },
  DIAGNOSIS:    { label: "Diagnosis",    icon: Activity,    color: "bg-warning/15 text-warning-foreground border-warning/30" },
  PRESCRIPTION: { label: "Prescription", icon: Pill,        color: "bg-primary-soft text-accent-foreground border-primary/20" },
  TEST:         { label: "Test",         icon: FlaskConical, color: "bg-accent text-accent-foreground border-accent" },
  SURGERY:      { label: "Surgery",      icon: FileText,    color: "bg-destructive/10 text-destructive border-destructive/30" },
  NOTE:         { label: "Note",         icon: NotebookPen, color: "bg-muted text-muted-foreground border-border" },
};

const TYPE_COUNTS_KEY = ["ALL", "VISIT", "DIAGNOSIS", "PRESCRIPTION", "TEST", "SURGERY", "NOTE"] as EncounterType[];

function EmrPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EncounterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EncounterType>("ALL");
  const [counts, setCounts] = useState<Partial<Record<EncounterType, number>>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch encounters authored by this doctor, last 200
    const { data: enc } = await supabase
      .from("patient_encounters")
      .select("id,global_patient_id,type,title,details,occurred_at,hospital_name")
      .eq("doctor_user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (!enc || enc.length === 0) { setRows([]); setLoading(false); return; }

    // Enrich with patient names
    const patientIds = Array.from(new Set(enc.map((e) => e.global_patient_id)));
    const { data: patients } = await supabase
      .from("global_patients")
      .select("id,first_name,last_name,display_id")
      .in("id", patientIds);

    const ptMap = new Map((patients ?? []).map((p) => [p.id, p]));

    const enriched: EncounterRow[] = enc.map((e) => {
      const pt = ptMap.get(e.global_patient_id);
      return {
        ...(e as EncounterRow),
        patient_name: pt ? `${pt.first_name} ${pt.last_name}` : "Unknown patient",
        patient_display_id: pt?.display_id,
      };
    });

    // Build type counts
    const c: Partial<Record<EncounterType, number>> = { ALL: enriched.length };
    for (const t of TYPE_COUNTS_KEY.slice(1)) {
      c[t] = enriched.filter((e) => e.type === t).length;
    }
    setCounts(c);
    setRows(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Filtered view
  const filtered = rows.filter((r) => {
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        (r.patient_name ?? "").toLowerCase().includes(q) ||
        (r.patient_display_id ?? "").toLowerCase().includes(q) ||
        (r.details ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by date
  const grouped = filtered.reduce<{ date: string; items: EncounterRow[] }[]>((acc, row) => {
    const dateKey = new Date(row.occurred_at).toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const existing = acc.find((g) => g.date === dateKey);
    if (existing) existing.items.push(row);
    else acc.push({ date: dateKey, items: [row] });
    return acc;
  }, []);

  return (
    <ErrorBoundary>
    <DashboardLayout>
      <PageHeader
        title="My EMR"
        description="Your complete clinical record across all patients."
      />

      {loading ? (
        <EmrSkeleton />
      ) : (
      <>
      {/* Stats bar — only shown once data has loaded */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TYPE_COUNTS_KEY.map((t) => {
          const count = counts[t] ?? 0;
          const isActive = typeFilter === t;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {t === "ALL" ? "All" : TYPE_META[t as Exclude<EncounterType, "ALL">].label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search + filter row */}
      <div className="mb-5 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by patient name, ID, or note content…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as EncounterType)}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {(Object.keys(TYPE_META) as Exclude<EncounterType, "ALL">[]).map((t) => (
              <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {rows.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No clinical entries yet"
          description="Open a patient and add a visit, diagnosis, prescription, or test."
          action={<Button asChild><Link to="/patients">Go to patients</Link></Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No entries match your filters"
          description={
            search && typeFilter !== "ALL"
              ? `No ${TYPE_META[typeFilter as Exclude<EncounterType, "ALL">]?.label.toLowerCase() ?? typeFilter.toLowerCase()} entries matching "${search}". Try clearing the search or changing the type.`
              : search
              ? `No entries matching "${search}". Try a different patient name, ID, or keyword.`
              : `No ${TYPE_META[typeFilter as Exclude<EncounterType, "ALL">]?.label.toLowerCase() ?? typeFilter.toLowerCase()} entries recorded yet.`
          }
          action={
            <Button variant="outline" onClick={() => { setSearch(""); setTypeFilter("ALL"); }}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <section key={date}>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />{date}
              </h2>
              <div className="space-y-2">
                {items.map((e) => {
                  const meta = TYPE_META[e.type as Exclude<EncounterType, "ALL">];
                  const Icon = meta?.icon ?? FileText;
                  return (
                    <div
                      key={e.id}
                      className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-card"
                    >
                      {/* Type badge */}
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm ${meta?.color ?? ""}`}>
                        <Icon className="h-4 w-4" />
                      </span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta?.color ?? ""}`}>
                            {meta?.label ?? e.type}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{relativeTime(e.occurred_at)}</span>
                          {e.hospital_name && (
                            <span className="text-[11px] text-muted-foreground">· {e.hospital_name}</span>
                          )}
                        </div>
                        <p className="mt-1 font-medium leading-snug">{e.title}</p>
                        {e.details && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.details}</p>
                        )}
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          <span className="font-medium">{e.patient_name}</span>
                          {e.patient_display_id && <span className="font-mono text-muted-foreground/60">· {e.patient_display_id}</span>}
                        </div>
                      </div>

                      {/* Nav link */}
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="shrink-0 self-center"
                      >
                        <Link to="/patients/$patientId" params={{ patientId: e.global_patient_id }}>
                          Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* footer */}
          {filtered.length >= 200 && (
            <p className="text-center text-xs text-muted-foreground">
              Showing most recent 200 entries. Open individual patients to see full history.
            </p>
          )}
        </div>
      )}
      </>
      )}
    </DashboardLayout>
    </ErrorBoundary>
  );
}
