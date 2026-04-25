CREATE OR REPLACE FUNCTION public.compute_patient_identity_hash(_phone text, _dob date)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(regexp_replace(coalesce(_phone,''), '\D', '', 'g') || '|' || _dob::text, 'sha256'), 'hex');
$$;