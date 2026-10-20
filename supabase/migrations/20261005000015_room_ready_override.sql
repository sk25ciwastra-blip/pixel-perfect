-- Task 2 — Controlled room READY override for Owner/Supervisor

create or replace function public.validate_room_transition()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  allow_ready_override boolean;
begin
  allow_ready_override :=
    coalesce(current_setting('app.room_ready_override', true), '') = 'true';

  if NEW.status <> OLD.status
     and not (
       (OLD.status = 'ready' and NEW.status = 'occupied')
       or (OLD.status = 'occupied' and NEW.status = 'dirty')
       or (OLD.status = 'dirty' and NEW.status = 'cleaning')
       or (OLD.status = 'cleaning' and NEW.status = 'ready')
       or (
         allow_ready_override
         and OLD.status in ('dirty', 'cleaning')
         and NEW.status = 'ready'
       )
     )
  then
    raise exception 'Perubahan status kamar tidak sesuai urutan';
  end if;

  return NEW;
end;
$function$;


create or replace function public.override_room_ready(_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  current_status public.room_status;
begin
  if not (
    public.has_role(auth.uid(), 'owner')
    or public.has_employee_position(
      auth.uid(),
      array['supervisor'::public.employee_position]
    )
  ) then
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

  if current_status not in ('dirty', 'cleaning') then
    raise exception 'Override READY hanya untuk kamar yang perlu atau sedang dibersihkan';
  end if;

  perform set_config('app.room_ready_override', 'true', true);

  update public.rooms
  set status = 'ready'
  where id = _room_id;

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    description
  )
  values (
    auth.uid(),
    'override_ready',
    'rooms',
    _room_id,
    'Kamar dijadikan READY melalui override Owner/Supervisor'
  );
end;
$function$;

revoke execute on function public.override_room_ready(uuid) from public;
revoke execute on function public.override_room_ready(uuid) from anon;
grant execute on function public.override_room_ready(uuid) to authenticated;
