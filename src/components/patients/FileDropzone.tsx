import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadPatientFile, type StoredAttachment, formatBytes } from "@/lib/storage";
import { toast } from "sonner";

interface Props {
  patientId: string;
  uploadedBy: string;
  value: StoredAttachment[];
  onChange: (next: StoredAttachment[]) => void;
  maxSizeMb?: number;
}

export function FileDropzone({ patientId, uploadedBy, value, onChange, maxSizeMb = 25 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const next = [...value];
    for (const file of Array.from(files)) {
      if (file.size > maxSizeMb * 1024 * 1024) {
        toast.error(`${file.name}: exceeds ${maxSizeMb}MB`);
        continue;
      }
      try {
        const att = await uploadPatientFile(patientId, file, uploadedBy);
        next.push(att);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    onChange(next);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (path: string) => onChange(value.filter((a) => a.path !== path));

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
        {uploading ? "Uploading…" : "Attach files"}
      </Button>
      <p className="mt-1 text-[10px] text-muted-foreground">Max {maxSizeMb}MB per file. Stored privately and signed on access.</p>
      {value.length > 0 && (
        <ul className="mt-2 space-y-1">
          {value.map((a) => (
            <li key={a.path} className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1 text-xs">
              <span className="truncate">{a.name} · <span className="text-muted-foreground">{formatBytes(a.size)}</span></span>
              <button type="button" onClick={() => remove(a.path)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
