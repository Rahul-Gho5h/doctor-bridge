import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Package, Plus, Search, X, AlertTriangle,
  Pill, Wrench, ShoppingBag, ChevronDown, ChevronUp,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, Pencil, Trash2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Doctor Bridge" }] }),
  component: InventoryPage,
});

type Category = "MEDICATION" | "SUPPLIES" | "EQUIPMENT" | "OTHER";
type TxType = "PURCHASE" | "USAGE" | "ADJUSTMENT" | "RETURN" | "EXPIRED" | "DAMAGED";

interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  min_quantity: number;
  unit: string;
  sku: string | null;
  supplier: string | null;
  cost_price: number | null;
  expiry_date: string | null;
  is_active: boolean;
  description: string | null;
}

interface Transaction {
  id: string;
  item_id: string;
  type: TxType;
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reason: string | null;
  created_at: string;
  item_name?: string;
}

const CAT_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  MEDICATION: { label: "Medication", icon: Pill, color: "text-info-foreground bg-info/15" },
  SUPPLIES:   { label: "Supplies",   icon: ShoppingBag, color: "text-success-foreground bg-success/15" },
  EQUIPMENT:  { label: "Equipment",  icon: Wrench, color: "text-warning-foreground bg-warning/20" },
  OTHER:      { label: "Other",      icon: Package, color: "text-muted-foreground bg-muted" },
};

const TX_META: Record<TxType, { label: string; sign: 1 | -1; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  PURCHASE:   { label: "Purchase",   sign: 1,  icon: ArrowUpCircle,   color: "text-success" },
  USAGE:      { label: "Usage",      sign: -1, icon: ArrowDownCircle, color: "text-destructive" },
  ADJUSTMENT: { label: "Adjustment", sign: 1,  icon: RefreshCw,       color: "text-info" },
  RETURN:     { label: "Return",     sign: 1,  icon: ArrowUpCircle,   color: "text-warning-foreground" },
  EXPIRED:    { label: "Expired",    sign: -1, icon: Trash2,          color: "text-destructive" },
  DAMAGED:    { label: "Damaged",    sign: -1, icon: Trash2,          color: "text-destructive" },
};

const EMPTY_FORM = {
  name: "", category: "MEDICATION" as Category, unit: "units",
  min_quantity: "10", sku: "", supplier: "", cost_price: "", expiry_date: "", description: "",
};

function CategoryBadge({ cat }: { cat: Category }) {
  const { label, icon: Icon, color } = CAT_META[cat];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", color)}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

function StockBar({ qty, min }: { qty: number; min: number }) {
  const low = qty <= min;
  const critical = qty === 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-medium",
      critical ? "text-destructive" : low ? "text-warning-foreground" : "text-success-foreground",
    )}>
      {critical && <AlertTriangle className="h-3.5 w-3.5" />}
      {low && !critical && <AlertTriangle className="h-3.5 w-3.5" />}
      {qty}
    </span>
  );
}

function ItemForm({
  open, onClose, onSaved, clinicId, existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clinicId: string;
  existing?: InventoryItem | null;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        category: existing.category,
        unit: existing.unit,
        min_quantity: String(existing.min_quantity),
        sku: existing.sku ?? "",
        supplier: existing.supplier ?? "",
        cost_price: existing.cost_price != null ? String(existing.cost_price) : "",
        expiry_date: existing.expiry_date ? existing.expiry_date.slice(0, 10) : "",
        description: existing.description ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [existing, open]);

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      clinic_id: clinicId,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit || "units",
      min_quantity: Number(form.min_quantity) || 0,
      sku: form.sku || null,
      supplier: form.supplier || null,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      expiry_date: form.expiry_date || null,
      description: form.description || null,
    };
    const { error } = existing
      ? await supabase.from("inventory_items").update(payload).eq("id", existing.id)
      : await supabase.from("inventory_items").insert({ ...payload, quantity: 0 });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(existing ? "Item updated" : "Item added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit item" : "Add inventory item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Amoxicillin 500mg" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as Category }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CAT_META) as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>{CAT_META[c].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={set("unit")} placeholder="units / boxes / vials" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Min quantity (reorder)</Label>
              <Input type="number" min={0} value={form.min_quantity} onChange={set("min_quantity")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Cost price (optional)</Label>
              <Input type="number" min={0} step="0.01" value={form.cost_price} onChange={set("cost_price")} placeholder="0.00" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>SKU (optional)</Label>
              <Input value={form.sku} onChange={set("sku")} placeholder="SKU-001" />
            </div>
            <div className="grid gap-1.5">
              <Label>Expiry date (optional)</Label>
              <Input type="date" value={form.expiry_date} onChange={set("expiry_date")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier (optional)</Label>
            <Input value={form.supplier} onChange={set("supplier")} placeholder="Supplier name" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({
  open, onClose, onSaved, item,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item: InventoryItem | null;
}) {
  const [type, setType] = useState<TxType>("PURCHASE");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setType("PURCHASE"); setQty(""); setReason(""); }
  }, [open]);

  const save = async () => {
    if (!item) return;
    const n = Number(qty);
    if (!n || n <= 0) { toast.error("Enter a positive quantity"); return; }
    setSaving(true);
    const sign = TX_META[type].sign;
    const newQty = Math.max(0, item.quantity + sign * n);
    const { error: txErr } = await supabase.from("inventory_transactions").insert({
      item_id: item.id,
      type,
      quantity: n,
      previous_qty: item.quantity,
      new_qty: newQty,
      reason: reason || null,
    });
    if (txErr) { toast.error(txErr.message); setSaving(false); return; }
    const { error: upErr } = await supabase
      .from("inventory_items")
      .update({ quantity: newQty })
      .eq("id", item.id);
    setSaving(false);
    if (upErr) { toast.error(upErr.message); return; }
    toast.success(`Stock updated → ${newQty} ${item.unit}`);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock — {item?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Transaction type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TxType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TX_META) as TxType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TX_META[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Quantity</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
          <div className="grid gap-1.5">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Monthly restock, expired, etc." />
          </div>
          {item && qty && Number(qty) > 0 && (
            <p className="text-xs text-muted-foreground">
              Stock: {item.quantity} → <strong>{Math.max(0, item.quantity + TX_META[type].sign * Number(qty))} {item.unit}</strong>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Confirm"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [lowOnly, setLowOnly] = useState(false);
  const [showTx, setShowTx] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const clinicId = profile?.clinic_id ?? "";

  const load = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    const { data } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("name");
    setItems((data as InventoryItem[]) ?? []);
    setLoading(false);
  }, [clinicId]);

  const loadTxs = useCallback(async () => {
    if (!clinicId) return;
    const { data: itemRows } = await supabase
      .from("inventory_items")
      .select("id,name")
      .eq("clinic_id", clinicId);
    const ids = (itemRows ?? []).map((i) => i.id);
    if (!ids.length) return;
    const nameMap = new Map((itemRows ?? []).map((i) => [i.id, i.name]));
    const { data } = await supabase
      .from("inventory_transactions")
      .select("*")
      .in("item_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    setTxs(((data ?? []) as Transaction[]).map((t) => ({ ...t, item_name: nameMap.get(t.item_id) })));
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (showTx) loadTxs(); }, [showTx, loadTxs]);

  const handleSaved = () => { load(); if (showTx) loadTxs(); };

  const filtered = items.filter((it) => {
    if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "ALL" && it.category !== catFilter) return false;
    if (lowOnly && it.quantity > it.min_quantity) return false;
    return true;
  });

  const lowCount = items.filter((it) => it.quantity <= it.min_quantity).length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Inventory"
        description="Medications, supplies, and equipment."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Add item
          </Button>
        }
      />

      {/* Summary cards */}
      {!loading && (
        <div className="mb-5 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Total items", value: items.length },
            { label: "Low / out of stock", value: lowCount, warn: lowCount > 0 },
            { label: "Medications", value: items.filter((i) => i.category === "MEDICATION").length },
            { label: "Equipment", value: items.filter((i) => i.category === "EQUIPMENT").length },
          ].map(({ label, value, warn }) => (
            <div key={label} className={cn(
              "rounded-xl border bg-card p-4 shadow-card",
              warn && "border-warning/40 bg-warning/5",
            )}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("mt-1 text-2xl font-semibold", warn && "text-warning-foreground")}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <Select value={catFilter} onValueChange={(v) => setCatFilter(v as Category | "ALL")}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {(Object.keys(CAT_META) as Category[]).map((c) => (
              <SelectItem key={c} value={c}>{CAT_META[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => setLowOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors",
            lowOnly
              ? "bg-warning/20 border-warning/40 text-warning-foreground font-medium"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Low stock
          {lowCount > 0 && (
            <span className="rounded-full bg-warning text-warning-foreground px-1.5 py-0 text-xs font-bold">{lowCount}</span>
          )}
        </button>
      </div>

      {/* Items table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No items found</p>
            {!search && !lowOnly && catFilter === "ALL" && (
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add first item
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 text-right font-medium">Min</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Expiry</th>
                  <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Cost</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((it) => {
                  const low = it.quantity <= it.min_quantity;
                  const expired = it.expiry_date && new Date(it.expiry_date) < new Date();
                  return (
                    <tr key={it.id} className={cn("hover:bg-muted/30 transition-colors", low && "bg-warning/5")}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{it.name}</div>
                        {it.sku && <div className="text-xs text-muted-foreground font-mono">{it.sku}</div>}
                      </td>
                      <td className="px-4 py-3"><CategoryBadge cat={it.category} /></td>
                      <td className="px-4 py-3 text-right">
                        <StockBar qty={it.quantity} min={it.min_quantity} />
                        <span className="ml-1 text-xs text-muted-foreground">{it.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{it.min_quantity}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{it.supplier ?? "—"}</td>
                      <td className={cn("px-4 py-3 hidden md:table-cell text-xs", expired ? "text-destructive font-medium" : "text-muted-foreground")}>
                        {it.expiry_date ? new Date(it.expiry_date).toLocaleDateString("en-GB") : "—"}
                        {expired && " (expired)"}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-right text-xs text-muted-foreground">
                        {it.cost_price != null ? `$${it.cost_price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAdjustItem(it)}>
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditItem(it)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction log toggle */}
      <button
        className="mt-5 flex w-full items-center justify-between rounded-xl border bg-card px-5 py-3 text-sm font-medium shadow-card hover:bg-muted/30 transition-colors"
        onClick={() => setShowTx((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" /> Recent transactions
        </span>
        {showTx ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showTx && (
        <div className="mt-1 rounded-xl border bg-card shadow-card overflow-hidden">
          {txs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Before → After</th>
                    <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Reason</th>
                    <th className="px-4 py-3 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {txs.map((tx) => {
                    const m = TX_META[tx.type];
                    return (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium">{tx.item_name ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", m.color)}>
                            <m.icon className="h-3.5 w-3.5" />{m.label}
                          </span>
                        </td>
                        <td className={cn("px-4 py-2.5 text-right font-mono text-xs font-semibold", m.color)}>
                          {m.sign > 0 ? "+" : "−"}{tx.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground font-mono">
                          {tx.previous_qty} → {tx.new_qty}
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-muted-foreground">{tx.reason ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-GB")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ItemForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={handleSaved}
        clinicId={clinicId}
      />
      <ItemForm
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onSaved={handleSaved}
        clinicId={clinicId}
        existing={editItem}
      />
      <AdjustDialog
        open={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        onSaved={handleSaved}
        item={adjustItem}
      />
    </DashboardLayout>
  );
}
