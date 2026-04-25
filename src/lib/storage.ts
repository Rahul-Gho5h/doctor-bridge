import { supabase } from "@/integrations/supabase/client";

export const MEDICAL_FILES_BUCKET = "medical-files";

export type StoredAttachment = {
  name: string;       // original filename
  path: string;       // storage path: {patientId}/{uuid}-{name}
  size: number;
  mime: string;
  uploaded_by: string;
  uploaded_at: string;
};

export async function uploadPatientFile(folder: string, file: File, uploadedBy: string): Promise<StoredAttachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(MEDICAL_FILES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return {
    name: file.name,
    path,
    size: file.size,
    mime: file.type || "application/octet-stream",
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
  };
}

export async function getSignedFileUrl(path: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(MEDICAL_FILES_BUCKET).createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function deletePatientFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(MEDICAL_FILES_BUCKET).remove([path]);
  if (error) throw error;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
