/**
 * Fire-and-forget helper for inserting a notification row.
 * Call with `void notifyUser(...)` — errors are swallowed so a
 * notification failure never interrupts the primary user action.
 */
import { supabase } from "@/integrations/supabase/client";

export async function notifyUser(
  recipientId: string,
  payload: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      recipient_id: recipientId,
      type:         payload.type,
      title:        payload.title,
      message:      payload.message,
      data:         payload.data ?? null,
      sent_at:      new Date().toISOString(),
    });
  } catch {
    // Notification failures are non-fatal — primary action already succeeded
  }
}
