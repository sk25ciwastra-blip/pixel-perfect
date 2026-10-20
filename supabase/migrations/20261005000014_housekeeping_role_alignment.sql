-- Task 2 — Housekeeping role alignment and RPC hardening

create or replace function public.advance_room_cleaning(_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_status public.room_status;
begin
  if not public.can_housekeeping(auth.uid()) then
    raise exception 'Akses ditolak';
  end if;

  select status
  into current_status
  from public.rooms
  where id = _room_id
  for update;

  if not found then
    raise exception 'Kamar tidak ditemukan';
  end if;

  if current_status = 'dirty' then
    update public.rooms
    set status = 'cleaning'
    where id = _room_id;

  elsif current_status = 'cleaning' then
    update public.rooms
    set status = 'ready'
    where id = _room_id;

  else
    raise exception 'Status kamar tidak dapat diubah';
  end if;
end;
$function$;

revoke execute on function public.advance_room_cleaning(uuid) from public;
revoke execute on function public.advance_room_cleaning(uuid) from anon;
grant execute on function public.advance_room_cleaning(uuid) to authenticated;
