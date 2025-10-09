-- Node 2 bootstrap: accepts only site_id = 2 for local writes
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id INT NOT NULL CHECK (site_id IN (1,2)),
  email TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.enforce_site_write()
RETURNS trigger AS $$
BEGIN
  IF NEW.site_id NOT IN (1,2) THEN
    RAISE EXCEPTION 'site_id inválido: %', NEW.site_id;
  END IF;
  -- This node is owner of site_id = 2
  IF TG_ARGV[0]::INT = 1 AND NEW.site_id <> 1 THEN
    RAISE EXCEPTION 'Este nodo solo acepta site_id=1';
  END IF;
  IF TG_ARGV[0]::INT = 2 AND NEW.site_id <> 2 THEN
    RAISE EXCEPTION 'Este nodo solo acepta site_id=2';
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_site ON public.accounts;
CREATE TRIGGER trg_enforce_site
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_site_write('2');