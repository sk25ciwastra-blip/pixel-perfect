\set ON_ERROR_STOP off
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
SELECT public.check_out_transaction('00000000-0000-0000-0000-000000003107');
