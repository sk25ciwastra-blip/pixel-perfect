begin;

create schema booking_quote_private;
revoke all on schema booking_quote_private from public, anon, authenticated, service_role;
grant usage on schema booking_quote_private to authenticated;

create function booking_quote_private.require_operator()
returns void
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from auth.users u
    where u.id = actor and (u.banned_until is null or u.banned_until <= now())
  ) or not coalesce(
    public.has_role(actor, 'owner'::public.app_role)
    or public.has_employee_position(actor, array['receptionist','supervisor']::public.employee_position[]), false
  ) then
    raise exception 'Akses penawaran Booking ditolak.' using errcode = '42501';
  end if;
end;
$$;

create function booking_quote_private.minimum_dp()
returns table (minimum_dp_mode text, minimum_dp_value numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform booking_quote_private.require_operator();
  return query
    select s.minimum_dp_mode, s.minimum_dp_value from public.finance_settings s where s.id = true;
end;
$$;

create function booking_quote_private.schedule(_room_id uuid, _package_id uuid, _scheduled_check_in timestamptz)
returns table (scheduled_check_in timestamptz, scheduled_check_out timestamptz, has_conflict boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  room_state public.room_status;
  planned_start timestamptz;
  planned_end timestamptz;
begin
  perform booking_quote_private.require_operator();

  select r.status into room_state from public.rooms r where r.id = _room_id and r.active;
  if not found then
    raise exception 'Kamar tidak aktif atau tidak ditemukan.';
  end if;

  select t.scheduled_check_in, t.scheduled_check_out
    into planned_start, planned_end
    from public.calculate_scheduled_booking_times(_package_id, _scheduled_check_in) t;
  if planned_start is null or planned_end is null or planned_end <= planned_start then
    raise exception 'Jadwal Booking tidak valid.';
  end if;

  -- Booking creation uses strict overlap for scheduled stays. Also guard against
  -- live occupancy, including incomplete records and overdue stays with unknown end.
  has_conflict := exists (
    select 1 from public.transactions tr
    where tr.room_id = _room_id and (
      (tr.status = 'booking' and (
        tr.scheduled_check_in is null or tr.scheduled_check_out is null
        or tr.scheduled_check_out <= tr.scheduled_check_in
        or (tr.scheduled_check_in < planned_end and tr.scheduled_check_out > planned_start)
      ))
      or (tr.status = 'check_in' and (
        tr.started_at is null or tr.ends_at is null or tr.ends_at <= tr.started_at
        or (tr.started_at < planned_end and (tr.ends_at > planned_start or tr.ends_at <= now()))
      ))
    )
  ) or (room_state = 'occupied' and not exists (
    select 1 from public.transactions tr where tr.room_id = _room_id and tr.status = 'check_in'
  ));
  scheduled_check_in := planned_start;
  scheduled_check_out := planned_end;
  return next;
end;
$$;

create function public.get_booking_quote_minimum_dp()
returns table (minimum_dp_mode text, minimum_dp_value numeric)
language sql stable security invoker
set search_path = ''
as $$
  select * from booking_quote_private.minimum_dp();
$$;

create function public.check_booking_quote_schedule(_room_id uuid, _package_id uuid, _scheduled_check_in timestamptz)
returns table (scheduled_check_in timestamptz, scheduled_check_out timestamptz, has_conflict boolean)
language sql stable security invoker
set search_path = ''
as $$
  select * from booking_quote_private.schedule(_room_id, _package_id, _scheduled_check_in);
$$;

revoke all on function booking_quote_private.require_operator(),
  booking_quote_private.minimum_dp(), booking_quote_private.schedule(uuid, uuid, timestamptz),
  public.get_booking_quote_minimum_dp(), public.check_booking_quote_schedule(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function booking_quote_private.minimum_dp(),
  booking_quote_private.schedule(uuid, uuid, timestamptz),
  public.get_booking_quote_minimum_dp(), public.check_booking_quote_schedule(uuid, uuid, timestamptz)
  to authenticated;

notify pgrst, 'reload schema';
commit;
