-- Add updated_at to affiliation_requests and keep it current via trigger.
-- The column is used by hospital.doctors.tsx to surface when a doctor joined.

ALTER TABLE affiliation_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill: prefer decided_at (when the request was accepted/declined), else created_at.
UPDATE affiliation_requests
SET updated_at = COALESCE(decided_at, created_at);

-- Reuse or create the generic set_updated_at trigger function.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER affiliation_requests_set_updated_at
  BEFORE UPDATE ON affiliation_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
