-- Task 2 — Atomic checkout foundation

alter table public.transactions
  add column if not exists checked_out_at timestamptz;

create or replace function public.check_out_transaction(_transaction_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  selected_transaction record;
begin
  if not public.can_frontdesk(auth.uid()) then
    raise exception 'Akses ditolak';
  end if;

  select
    id,
    transaction_number,
    room_id,
    status
  into selected_transaction
  from public.transactions
  where id = _transaction_id
  for update;

  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;

  if selected_transaction.status <> 'check_in' then
    raise exception 'Hanya transaksi CHECK-IN yang dapat di-check-out';
  end if;

  update public.rooms
  set status = 'dirty'
  where id = selected_transaction.room_id
    and status = 'occupied';

  if not found then
    raise exception 'Kamar transaksi tidak berstatus TERISI';
  end if;

  update public.transactions
  set
    status = 'check_out',
    checked_out_at = now()
  where id = selected_transaction.id;

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    description
  )
  values (
    auth.uid(),
    'check_out',
    'transaction',
    selected_transaction.id,
    'Check-out transaksi ' || selected_transaction.transaction_number
  );

  return selected_transaction.transaction_number;
end;
$function$;

revoke all on function public.check_out_transaction(uuid) from public;
grant execute on function public.check_out_transaction(uuid) to authenticated;
