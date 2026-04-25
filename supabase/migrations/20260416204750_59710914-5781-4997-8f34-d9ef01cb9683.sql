
CREATE OR REPLACE FUNCTION public.generate_mrn() RETURNS TEXT
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE chars TEXT := 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'; result TEXT := 'MRN-'; i INT;
BEGIN
  FOR i IN 1..8 LOOP result := result || substr(chars, (random()*length(chars))::int+1, 1); END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_referral_number() RETURNS TEXT
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result TEXT := 'REF-'; i INT;
BEGIN
  result := result || to_char(now(),'YYYYMMDD') || '-';
  FOR i IN 1..6 LOOP result := result || substr(chars, (random()*length(chars))::int+1, 1); END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number() RETURNS TEXT
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE chars TEXT := '0123456789'; result TEXT := 'INV-'; i INT;
BEGIN
  result := result || to_char(now(),'YYYYMM') || '-';
  FOR i IN 1..6 LOOP result := result || substr(chars, (random()*length(chars))::int+1, 1); END LOOP;
  RETURN result;
END; $$;
