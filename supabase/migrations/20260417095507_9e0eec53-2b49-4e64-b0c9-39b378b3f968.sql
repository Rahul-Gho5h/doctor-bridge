-- Add FELLOWSHIP to portfolio enum
ALTER TYPE public.portfolio_item_type ADD VALUE IF NOT EXISTS 'FELLOWSHIP';

-- DM thread helper RPC
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _a uuid;
  _b uuid;
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _other THEN RAISE EXCEPTION 'Cannot DM yourself'; END IF;
  -- canonical ordering so (a,b) and (b,a) collapse
  IF _me < _other THEN _a := _me; _b := _other; ELSE _a := _other; _b := _me; END IF;

  SELECT id INTO _id FROM public.direct_threads WHERE user_a = _a AND user_b = _b LIMIT 1;
  IF _id IS NULL THEN
    INSERT INTO public.direct_threads (user_a, user_b) VALUES (_a, _b) RETURNING id INTO _id;
  END IF;
  RETURN _id;
END;
$$;

-- Allow participants to create direct threads via the RPC (RPC bypasses RLS via SECURITY DEFINER, but add policy for safety)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_threads' AND policyname='Participants create thread') THEN
    CREATE POLICY "Participants create thread" ON public.direct_threads
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IN (user_a, user_b));
  END IF;
END $$;