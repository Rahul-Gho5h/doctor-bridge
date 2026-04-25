import { useEffect, useState } from "react";
import { Briefcase, FileText, Award, Microscope, BookOpen, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PortfolioItem, PortfolioType } from "./PortfolioEditor";

const META: Record<PortfolioType, { label: string; icon: typeof Briefcase }> = {
  OPERATION: { label: "Operation", icon: Microscope },
  PROJECT: { label: "Project", icon: Briefcase },
  PUBLICATION: { label: "Publication", icon: BookOpen },
  FELLOWSHIP: { label: "Fellowship", icon: FileText },
  AWARD: { label: "Award", icon: Award },
};

export function PortfolioDisplay({ doctorUserId }: { doctorUserId: string }) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("doctor_portfolio_items")
        .select("*").eq("doctor_user_id", doctorUserId).eq("is_published", true)
        .order("year", { ascending: false, nullsFirst: false });
      setItems((data ?? []) as PortfolioItem[]);
      setLoading(false);
    })();
  }, [doctorUserId]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading portfolio…</div>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No portfolio entries yet.</p>;

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((it) => {
        const Icon = META[it.type].icon;
        return (
          <li key={it.id} className="rounded-lg border bg-background p-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3 w-3" /> {META[it.type].label}{it.year ? ` · ${it.year}` : ""}
            </div>
            <h4 className="mt-1 font-semibold">{it.title}</h4>
            {it.role && <p className="text-xs text-muted-foreground">{it.role}</p>}
            {it.description && <p className="mt-2 text-sm">{it.description}</p>}
            {it.outcomes && <p className="mt-2 text-xs"><span className="font-medium">Outcomes: </span>{it.outcomes}</p>}
            {it.link_url && (
              <a href={it.link_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Read more <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
