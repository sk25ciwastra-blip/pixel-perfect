BEGIN;

REVOKE INSERT ON TABLE public.transactions FROM anon, authenticated;

DROP POLICY IF EXISTS transactions_insert ON public.transactions;

COMMIT;
