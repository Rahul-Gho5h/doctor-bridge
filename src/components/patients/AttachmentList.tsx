import { useState } from "react";
import { FileText, Download, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type StoredAttachment, getSignedFileUrl, deletePatientFile, formatBytes } from "@/lib/storage";
import { toast } from "sonner";

interface Props {
  attachments: StoredAttachment[];
  canDelete?: boolean;
  onDelete?: (path: string) => void;
}

export function AttachmentList({ attachments, canDelete, onDelete }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const open = async (path: string) => {
    setBusy(path);
    try {
      const url = await getSignedFileUrl(path, 600);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (path: string) => {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setBusy(path);
    try {
      await deletePatientFile(path);
      onDelete?.(path);
      toast.success("File deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ul className="mt-3 space-y-1.5">
      {attachments.map((a) => (
        <li key={a.path} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{a.name}</div>
            <div className="text-[10px] text-muted-foreground">{formatBytes(a.size)} · {a.mime.split("/")[1] ?? a.mime}</div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => open(a.path)} disabled={busy === a.path}>
            {busy === a.path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
          {canDelete && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => remove(a.path)} disabled={busy === a.path}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
