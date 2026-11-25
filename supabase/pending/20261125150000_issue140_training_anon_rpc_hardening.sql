-- Issue #140: Training RPCs must never be callable by unauthenticated clients.
-- Supabase's default PUBLIC EXECUTE can survive GRANT ... TO authenticated.
-- Retain existing authenticated grants; no data or function bodies are changed.
REVOKE EXECUTE ON FUNCTION
  public.check_in_training_booking(uuid,uuid),
  public.check_out_training_transaction(uuid,uuid),
  public.create_finance_training_assignment(uuid,uuid,date),
  public.create_training_finance_deposit(uuid,uuid,text,numeric,uuid,text),
  public.create_training_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid),
  public.get_finance_training_context(),
  public.get_training_finance_session_summary(uuid),
  public.record_training_finance_expense(uuid,uuid,numeric,text,text,text),
  public.record_training_transaction_payment(uuid,numeric,text,uuid,uuid),
  public.resolve_finance_training_assignment(uuid,text,text)
FROM PUBLIC, anon;
