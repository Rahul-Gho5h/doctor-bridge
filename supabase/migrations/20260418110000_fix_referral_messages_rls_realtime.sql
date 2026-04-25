-- ============================================================
-- Fix: referral_messages realtime not delivering events
--
-- Root cause: the "Parties view referral messages" policy called
-- is_referral_party(), a SECURITY DEFINER function. When Supabase
-- realtime evaluates RLS for event delivery it runs the check as
-- the function owner, so auth.uid() returns NULL and every event
-- is silently dropped for the subscriber.
--
-- Fix: inline the same JOIN logic directly into the policy,
-- identical to how direct_messages RLS is written (which works).
-- ============================================================

DROP POLICY IF EXISTS "Parties view referral messages" ON public.referral_messages;

CREATE POLICY "Parties view referral messages"
ON public.referral_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.referrals r
    JOIN  public.doctor_profiles dp1 ON dp1.id = r.referring_doctor_id
    LEFT JOIN public.doctor_profiles dp2 ON dp2.id = r.specialist_id
    WHERE r.id = referral_messages.referral_id
      AND (dp1.user_id = auth.uid() OR dp2.user_id = auth.uid())
  )
);
