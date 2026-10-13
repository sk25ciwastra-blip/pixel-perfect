-- Task 2 — Harden checkout RPC privileges

revoke execute on function public.check_out_transaction(uuid) from public;
revoke execute on function public.check_out_transaction(uuid) from anon;
grant execute on function public.check_out_transaction(uuid) to authenticated;
