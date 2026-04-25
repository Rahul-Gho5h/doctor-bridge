/**
 * useReminders — checks for due follow-up reminders on mount and every 5 minutes.
 * When a reminder is due it writes to the notifications table (visible in the bell)
 * and marks it as delivered.
 *
 * Approach: purely client-side polling (no server cron needed for MVP).
 * For production, replace/augment with a Supabase pg_cron job or Edge Function cron.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notifyUser } from "@/lib/notify";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useReminders(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const check = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("follow_up_reminders")
        .select("id,referral_id,message,reminder_type")
        .eq("created_by", userId)
        .lte("remind_at", now)
        .is("fired_at", null)
        .limit(10);

      if (!data || data.length === 0) return;

      for (const r of data) {

        // Write to notifications table so it appears in bell
        void notifyUser(userId, {
          type: "FOLLOW_UP_REMINDER",
          title: r.message,
          message: "Referral follow-up reminder",
          data: { referral_id: r.referral_id },
        });

        // Mark as fired so it never re-triggers
        void supabase
          .from("follow_up_reminders")
          .update({ fired_at: now })
          .eq("id", r.id);
      }
    };

    // Delay the first check by 10 s so it doesn't fire while the user is
    // still settling into the app after login. After that, poll every 5 min.
    const startup = setTimeout(() => {
      void check();
      const id = setInterval(check, POLL_INTERVAL_MS);
      // Store the interval id on the timeout ref so cleanup can reach it.
      // We close over `id` so the cleanup below handles it.
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      intervalRef = id;
    }, 10_000);

    let intervalRef: ReturnType<typeof setInterval> | undefined;

    return () => {
      clearTimeout(startup);
      if (intervalRef !== undefined) clearInterval(intervalRef);
    };
  }, [userId]);
}
