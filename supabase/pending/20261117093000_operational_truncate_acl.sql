-- PENDING OWNER APPROVAL: direct SQL role TRUNCATE bypasses RLS.
-- No application row or policy changes. Never apply automatically.
BEGIN;
SET LOCAL lock_timeout='5s';
REVOKE TRUNCATE ON public.rooms,public.transactions,public.housekeeping_history,public.housekeeping_checklists FROM anon,authenticated;
COMMIT;
