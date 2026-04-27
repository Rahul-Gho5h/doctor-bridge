import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Pencil, Briefcase, FileText, Award, Microscope, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type PortfolioType = "OPERATION" | "PROJECT" | "PUBLICATION" | "FELLOWSHIP" | "AWARD";

const TYPE_META: Record<PortfolioType, { label: string; icon: typeof Briefcase }> = {
  OPERATION: { label: "Operation / Procedure", icon: Microscope },
  PROJECT: { label: "Project", icon: Briefcase },
  PUBLICATION: { label: "Publication", icon: BookOpen },
  FELLOWSHIP: { label: "Fellowship", icon: FileText },
  AWARD: { label: "Award", icon: Award },
};

export interface PortfolioItem {
  id: string;
  doctor_user_id: string;
  type: PortfolioType;
  title: string;
  description: string | null;
  year: number | null;
  role: string | null;
  outcomes: string | null;
  image_url: string | null;
  link_url: string | null;
  is_published: boolean;
}

export function PortfolioEditor() {
  const { user } = useAuth();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("doctor_portfolio_items")
      .select("*").eq("doctor_user_id", user.id).order("year", { ascending: false, nullsFirst: false });
    setItems((data ?? []) as PortfolioItem[]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const { error } = await supabase.from("doctor_portfolio_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  };

  const startNew = () => { setEditing(null); setOpen(true); };
  const startEdit = (it: PortfolioItem) => { setEditing(it); setOpen(true); };

  return (
    <section className="rounded-xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Portfolio</h2>
          <p className="text-xs text-muted-foreground">Operations, projects, publications, awards. Visible to other doctors searching for specialists.</p>
        </div>
        <Button size="sm" onClick={startNew}><Plus className="mr-1.5 h-4 w-4" />Add entry</Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Build trust by adding signature operations, papers, or projects you've led.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((it) => {
            const Icon = TYPE_META[it.type].icon;
            return (
              <li key={it.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Icon className="h-3 w-3" />{TYPE_META[it.type].label}{it.year ? ` · ${it.year}` : ""}
                    </div>
                    <h3 className="mt-0.5 truncate font-semibold">{it.title}</h3>
                    {it.role && <p className="text-xs text-muted-foreground">{it.role}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(it)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
                {it.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{it.description}</p>}
                {it.outcomes && <p className="mt-2 text-xs"><span className="font-medium">Outcomes: </span>{it.outcomes}</p>}
                {!it.is_published && <span className="mt-2 inline-flex rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground">Draft</span>}
              </li>
            );
          })}
        </ul>
      )}

      <PortfolioDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={load} />
    </section>
  );
}

function PortfolioDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean; onOpenChange: (b: boolean) => void;
  editing: PortfolioItem | null; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<PortfolioItem>>({
    type: "OPERATION", title: "", description: "", year: new Date().getFullYear(),
    role: "", outcomes: "", image_url: "", link_url: "", is_published: true,
  });

  useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ type: "OPERATION", title: "", description: "", year: new Date().getFullYear(), role: "", outcomes: "", image_url: "", link_url: "", is_published: true });
  }, [editing, open]);

  const save = async () => {
    if (!user || !form.title || !form.type) { toast.error("Title and type are required"); return; }
    setBusy(true);
    const payload = {
      doctor_user_id: user.id,
      type: form.type as PortfolioType,
      title: form.title,
      description: form.description || null,
      year: form.year || null,
      role: form.role || null,
      outcomes: form.outcomes || null,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      is_published: form.is_published ?? true,
    };
    const { error } = editing
      ? await supabase.from("doctor_portfolio_items").update(payload).eq("id", editing.id)
      : await supabase.from("doctor_portfolio_items").insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Added");
    onOpenChange(false); onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit entry" : "Add portfolio entry"}</DialogTitle>
          <DialogDescription>This appears on your public profile shown to referring doctors.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PortfolioType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_META) as PortfolioType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Year</Label>
            <Input type="number" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value ? +e.target.value : null })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Title *</Label>
            <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Off-pump CABG, complex case (3-vessel)" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Your role</Label>
            <Input value={form.role ?? ""} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Lead surgeon, Co-investigator…" />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Description</Label>
            <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block text-xs">Outcomes</Label>
            <Input value={form.outcomes ?? ""} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} placeholder="e.g. 100% survival at 1y, 5% complication rate" />
          </div>
          <Field label="Link (optional)" v={form.link_url ?? ""} on={(v) => setForm({ ...form, link_url: v })} placeholder="https://…" />
          <Field label="Image URL (optional)" v={form.image_url ?? ""} on={(v) => setForm({ ...form, image_url: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
