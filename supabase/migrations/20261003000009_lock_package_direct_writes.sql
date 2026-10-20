-- Package catalog writes must go through the approved SECURITY DEFINER RPCs.
-- Keep SELECT access unchanged for authenticated application users.
-- Keep service_role privileges unchanged.

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.packages
FROM authenticated;
