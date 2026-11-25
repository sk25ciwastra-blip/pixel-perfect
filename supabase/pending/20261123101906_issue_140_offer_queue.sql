begin;
set local lock_timeout = '5s';

do $preflight$
declare
  prerequisite text;
begin
  foreach prerequisite in array array[
    'booking_quote_private.require_operator()',
    'public.get_booking_quote_minimum_dp()',
    'public.check_booking_quote_schedule(uuid,uuid,timestamp with time zone)',
    'public.finance_training_is_restricted(uuid)',
    'public.finance_is_booking_operator(uuid)',
    'public.get_operational_day_mode(date)'
  ] loop
    if to_regprocedure(prerequisite) is null then
      raise exception 'Prasyarat penawaran belum terpasang: %', prerequisite;
    end if;
  end loop;
end $preflight$;

create schema reservation_offer_private;
revoke all on schema reservation_offer_private from public, anon, authenticated, service_role;
grant usage on schema reservation_offer_private to authenticated;

-- Preflight must resolve existing canonical duplicates before this can succeed.
create function reservation_offer_private.canonical_wa(value text)
returns text language sql immutable strict set search_path = '' as $$
  select case when digits ~ '^0' then '62' || substr(digits, 2) else digits end
  from (select regexp_replace(value, '[^0-9]', '', 'g') as digits) d
$$;
create unique index guests_offer_canonical_wa_idx on public.guests
  (reservation_offer_private.canonical_wa(phone))
  where reservation_offer_private.canonical_wa(phone) ~ '^62[1-9][0-9]{7,12}$';

-- Shared by the three reservation routes and offer creation. Called inside the
-- official transaction, after its room lock. It can never update a guest.
create function reservation_offer_private.resolve_guest(_name text, _phone text, _address text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  normalized text := reservation_offer_private.canonical_wa(_phone);
  indonesian boolean := coalesce(normalized ~ '^62[1-9][0-9]{7,12}$', false);
  guest uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('offer-guest:' || case when indonesian then normalized else _phone end, 0));
  for attempt in 1..2 loop
    if indonesian then
      select g.id into guest from public.guests g
      where reservation_offer_private.canonical_wa(g.phone) = normalized
        and reservation_offer_private.canonical_wa(g.phone) ~ '^62[1-9][0-9]{7,12}$';
    else
      select g.id into guest from public.guests g where g.phone = _phone;
    end if;
    if found then return guest; end if;
    -- A manual guest write may have won after lookup. Recheck once.
    if attempt = 2 then exit; end if;
    if length(trim(coalesce(_address,''))) = 0 then raise exception 'Alamat wajib diisi untuk tamu baru'; end if;
    insert into public.guests(full_name, address, phone) values (trim(_name), trim(_address), _phone)
      on conflict do nothing returning id into guest;
    if found then return guest; end if;
  end loop;
  raise exception 'Identitas WhatsApp berubah bersamaan. Coba lagi.' using errcode = '40001';
end $$;

-- Store the exact original definitions for an atomic rollback. Function
-- ownership, grants, argument defaults, guards and payment logic stay intact.
create table reservation_offer_private.booking_originals (
  signature text primary key,
  original_definition text not null,
  patched_sha256 bytea not null
);
revoke all on reservation_offer_private.booking_originals from public, anon, authenticated, service_role;

do $patch$
declare
  writer record;
  definition text;
  old_block text;
  patched text;
  reviewed_legacy constant text := 'SELECT id INTO selected_guest FROM public.guests WHERE phone = _phone; IF selected_guest IS NULL THEN IF length(trim(coalesce(_address, ''''))) = 0 THEN RAISE EXCEPTION ''Alamat wajib diisi untuk tamu baru''; END IF; INSERT INTO public.guests (full_name, address, phone) VALUES (trim(_name), trim(_address), _phone) RETURNING id INTO selected_guest; END IF;';
  reviewed_combined constant text := 'SELECT id INTO selected_guest FROM public.guests WHERE phone = _phone; IF selected_guest IS NULL THEN IF length(trim(coalesce(_address, ''''))) = 0 THEN RAISE EXCEPTION ''Alamat wajib diisi untuk tamu baru''; END IF; INSERT INTO public.guests(full_name, address, phone) VALUES(trim(_name), trim(_address), _phone) RETURNING id INTO selected_guest; END IF;';
  block_pattern constant text := 'SELECT id INTO selected_guest FROM public\.guests WHERE phone = _phone;[[:space:]]+IF selected_guest IS NULL THEN[[:space:]]+IF [^;]+;[[:space:]]*END IF;[[:space:]]+INSERT INTO public\.guests[^;]+;[[:space:]]*END IF;';
  count_single integer := 0;
begin
  for writer in
    select p.oid, p.proname, p.prosrc, p.prosecdef, p.proowner,
           format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and (p.proname in ('create_reservation','create_reservation_combined',
            'create_training_reservation','create_training_reservation_combined')
        or p.prosrc ~* 'insert[[:space:]]+into[[:space:]]+(public\.)?guests([[:space:]]|\()')
  loop
    if writer.proname in ('create_training_reservation','create_training_reservation_combined') then
      if writer.prosrc ~* 'insert[[:space:]]+into[[:space:]]+(public\.)?guests([[:space:]]|\()'
        or writer.prosrc !~* ('public\.' || replace(writer.proname,'_training_','_') || '[[:space:]]*\(') then
        raise exception 'Tinjau ulang delegasi Training % sebelum migrasi penawaran.', writer.signature;
      end if;
      continue;
    end if;
    -- LIVE retains a reviewed legacy 10-argument delegator to the 12-argument
    -- official Booking writer. It does not insert guests and must stay intact.
    -- Pin its exact LIVE definition hash, owner and SECURITY DEFINER metadata
    -- rather than widening the allowlist for guest-writing functions.
    if writer.signature =
       'public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamp with time zone)' then
      if writer.prosrc ~* 'insert[[:space:]]+into[[:space:]]+(public\.)?guests([[:space:]]|\()'
        or not writer.prosecdef
        or writer.proowner is distinct from (select oid from pg_roles where rolname = current_user)
        or sha256(convert_to(pg_get_functiondef(writer.oid), 'UTF8')) is distinct from
          decode('2dec54022b5b5164c6c1c0b4af8f42af4c8337202549a8f373a1cb6ee1cb39be', 'hex')
      then
        raise exception 'Delegator Booking legacy 10 argumen berbeda dari checkpoint. Hentikan instalasi: %', writer.signature;
      end if;
      continue;
    end if;
    if writer.signature not in (
      'public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamp with time zone, uuid, uuid)',
      'public.create_reservation(text, uuid, uuid, text, text, text, numeric, text, text, timestamp with time zone, uuid, uuid, integer)',
      'public.create_reservation_combined(text, uuid, uuid, text, text, text, jsonb, text, timestamp with time zone, uuid, text, uuid, integer)'
    ) or not writer.prosecdef or writer.proowner is distinct from (select oid from pg_roles where rolname = current_user) then
      raise exception 'Tinjau ABI dan pemilik penulis tamu % sebelum migrasi penawaran.', writer.signature;
    end if;
    definition := pg_get_functiondef(writer.oid);
    old_block := (regexp_match(definition, block_pattern))[1];
    if old_block is null or regexp_replace(old_block, '[[:space:]]+', ' ', 'g') not in (reviewed_legacy, reviewed_combined)
      or (select count(*) from regexp_matches(definition, block_pattern, 'g')) <> 1
      or (select count(*) from regexp_matches(writer.prosrc, 'insert[[:space:]]+into[[:space:]]+(public\.)?guests([[:space:]]|\()', 'gi')) <> 1 then
      raise exception 'Blok lookup tamu pada % berbeda dari checkpoint. Hentikan pemasangan.', writer.signature;
    end if;
    patched := replace(definition, old_block, 'selected_guest := reservation_offer_private.resolve_guest(_name, _phone, _address);');
    execute patched;
    insert into reservation_offer_private.booking_originals values
      (writer.signature, definition, sha256(convert_to(pg_get_functiondef(writer.oid), 'UTF8')));
    if writer.proname = 'create_reservation' then count_single := count_single + 1; end if;
  end loop;
  if count_single = 0 then raise exception 'ABI Booking resmi belum tersedia.'; end if;
end $patch$;

create table public.reservation_offers (
  id uuid primary key check (id <> '00000000-0000-0000-0000-000000000000'),
  booking_key uuid not null unique default gen_random_uuid(),
  guest_id uuid not null references public.guests(id),
  room_id uuid not null references public.rooms(id),
  package_id uuid not null references public.packages(id),
  room_number text not null,
  room_type text not null,
  package_name text not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz not null check (check_out_at > check_in_at),
  day_mode text not null check (day_mode in ('weekday','weekend')),
  guest_count integer not null default 2 check (guest_count = 2),
  total numeric not null check (total > 0),
  minimum_dp_mode text not null check (minimum_dp_mode in ('PERCENTAGE','AMOUNT')),
  minimum_dp_value numeric not null check (minimum_dp_value >= 0),
  minimum_dp numeric not null check (minimum_dp between 0 and total),
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','CONVERTING','CONVERTED','FAILED_UNAVAILABLE','EXPIRED_SCHEDULE','CANCELLED')),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid not null,
  request_fingerprint bytea not null,
  guest_phone_canonical text not null,
  sent_marked_at timestamptz,
  sent_marked_by uuid,
  failed_at timestamptz,
  reason text,
  converted_at timestamptz,
  transaction_id uuid unique references public.transactions(id),
  cancelled_at timestamptz,
  cancelled_by uuid
);
create index reservation_offers_room_active_idx on public.reservation_offers(room_id, check_in_at, check_out_at)
  where status in ('DRAFT','SENT');
create index reservation_offers_active_order_idx on public.reservation_offers(created_at desc, id desc)
  where status in ('DRAFT','SENT');
create index reservation_offers_guest_idx on public.reservation_offers(guest_id, created_at desc, id desc);
create table public.reservation_offer_events (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.reservation_offers(id),
  status text not null,
  actor_id uuid,
  occurred_at timestamptz not null default clock_timestamp(),
  reason text
);
create index reservation_offer_events_offer_idx on public.reservation_offer_events(offer_id);
alter table public.reservation_offers enable row level security;
alter table public.reservation_offer_events enable row level security;
revoke all on public.reservation_offers, public.reservation_offer_events from public, anon, authenticated, service_role;

-- Same ACL as the read-only Booking quote checks. Restricted Training can quote
-- but must use the existing Training flow separately; this RPC cannot debit it.
create function reservation_offer_private.terms(room uuid, pkg uuid, starts timestamptz)
returns table (ends timestamptz, conflict boolean, day text, total numeric, dp_mode text, dp_value numeric, dp numeric,
               room_number text, room_type text, package_name text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  select s.scheduled_check_out, s.has_conflict into ends, conflict
  from public.check_booking_quote_schedule(room, pkg, starts) s;
  day := public.get_operational_day_mode((starts at time zone 'Asia/Jakarta')::date);
  select r.room_number, rt.name, p.name, case day when 'weekday' then pr.weekday_price when 'weekend' then pr.weekend_price end
  into room_number, room_type, package_name, total
  from public.rooms r join public.room_types rt on rt.id = r.room_type_id
  join public.packages p on p.id = pkg and p.active
  join public.package_room_type_prices pr on pr.package_id = p.id and pr.pricing_group = rt.pricing_group
  where r.id = room and r.active;
  select s.minimum_dp_mode, s.minimum_dp_value into dp_mode, dp_value from public.get_booking_quote_minimum_dp() s;
  dp := ceil(case dp_mode when 'PERCENTAGE' then total * dp_value / 100 when 'AMOUNT' then dp_value end);
  if ends is null or conflict is null or total is null or total <= 0 or dp is null or dp < 0 or dp > total then
    raise exception 'Harga, jadwal, atau minimum DP resmi tidak tersedia.';
  end if;
  return next;
end $$;

create function reservation_offer_private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'CONVERTING' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    insert into public.reservation_offer_events(offer_id, status, actor_id, reason)
    values (new.id, new.status, auth.uid(), new.reason);
  end if;
  return new;
end $$;
create trigger reservation_offers_audit after insert or update of status on public.reservation_offers
for each row execute function reservation_offer_private.audit();

create function reservation_offer_private.conflict(room uuid, starts timestamptz, ends timestamptz)
returns boolean language sql stable security invoker set search_path = '' as $$
  select
    not exists (select 1 from public.rooms r where r.id = room and r.active)
    or exists (
      select 1 from public.transactions tr where tr.room_id = room and (
        (tr.status = 'booking' and (tr.scheduled_check_in is null or tr.scheduled_check_out is null
          or tr.scheduled_check_out <= tr.scheduled_check_in
          or (tr.scheduled_check_in < ends and tr.scheduled_check_out > starts)))
        or (tr.status = 'check_in' and (tr.started_at is null or tr.ends_at is null
          or tr.ends_at <= tr.started_at
          or (tr.started_at < ends and (tr.ends_at > starts or tr.ends_at <= now()))))
      )
    )
    or exists (select 1 from public.rooms r where r.id = room and r.status = 'occupied'
      and not exists (select 1 from public.transactions tr where tr.room_id = room and tr.status = 'check_in'))
$$;

create function reservation_offer_private.invalidate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('booking','check_in') then
    update public.reservation_offers q set status = 'FAILED_UNAVAILABLE',
      failed_at = clock_timestamp(), reason = 'Jadwal beririsan dengan Booking atau Check-in resmi.'
    where q.room_id = new.room_id and q.status in ('DRAFT','SENT')
      and q.check_in_at > statement_timestamp()
      and (case when new.status = 'booking' then
        new.scheduled_check_in is null or new.scheduled_check_out is null or new.scheduled_check_out <= new.scheduled_check_in
        or (new.scheduled_check_in < q.check_out_at and new.scheduled_check_out > q.check_in_at)
      else
        new.started_at is null or new.ends_at is null or new.ends_at <= new.started_at
        or (new.started_at < q.check_out_at and (new.ends_at > q.check_in_at or new.ends_at <= now()))
      end);
  end if;
  return new;
end $$;
create trigger reservation_offers_invalidate after insert or update of status, room_id, scheduled_check_in, scheduled_check_out, started_at, ends_at
on public.transactions for each row execute function reservation_offer_private.invalidate();

create function reservation_offer_private.payload(q public.reservation_offers, full_identity boolean, effective_status text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', q.id, 'guest_name', g.full_name, 'phone_last4', right(regexp_replace(g.phone, '[^0-9]', '', 'g'), 4),
    'room_id', q.room_id, 'package_id', q.package_id, 'room_number', q.room_number, 'room_type', q.room_type,
    'package_name', q.package_name, 'scheduled_check_in', q.check_in_at, 'scheduled_check_out', q.check_out_at,
    'day_mode', q.day_mode, 'guest_count', q.guest_count, 'total', q.total, 'minimum_dp', q.minimum_dp,
    'minimum_dp_mode', q.minimum_dp_mode, 'minimum_dp_value', q.minimum_dp_value,
    'status', effective_status, 'created_at', q.created_at, 'sent_marked_at', q.sent_marked_at,
    'transaction_number', tr.transaction_number,
    'reason', coalesce(q.reason, case when effective_status = 'EXPIRED_SCHEDULE' then 'Jadwal check-in telah lewat.'
      when effective_status = 'FAILED_UNAVAILABLE' then 'Ketersediaan kamar tidak dapat dipastikan.' end)
  ) || case when full_identity then jsonb_build_object('phone', g.phone, 'address', g.address) else '{}'::jsonb end
  from public.guests g left join public.transactions tr on tr.id = q.transaction_id
  where g.id = q.guest_id
$$;

create function reservation_offer_private.create_offer(_id uuid, _name text, _phone text, _address text, _room uuid, _package uuid, _start timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  canonical text := reservation_offer_private.canonical_wa(_phone);
  fingerprint bytea := sha256(convert_to(jsonb_build_array(trim(_name), canonical, trim(_address),
    _room, _package, extract(epoch from _start))::text, 'UTF8'));
  quote public.reservation_offers%rowtype;
  guest uuid;
  t record;
begin
  perform booking_quote_private.require_operator();
  if _id is null or canonical is null or canonical !~ '^62[1-9][0-9]{7,12}$'
    or trim(_phone) !~ '^\+?[0-9[:space:]().-]+$'
    or not coalesce(length(trim(_name)) between 1 and 100 and length(trim(_address)) between 1 and 500, false)
  then raise exception 'Periksa nama, alamat, dan WhatsApp Indonesia.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('offer:' || _id::text, 0));
  select * into quote from public.reservation_offers where id = _id;
  if found then
    if quote.created_by is distinct from auth.uid() or quote.request_fingerprint is distinct from fingerprint then
      raise exception 'Permintaan penawaran sudah dipakai untuk data lain.';
    end if;
    return reservation_offer_private.payload(quote, true, quote.status);
  end if;
  if _start is null or not isfinite(_start) or _start <= statement_timestamp() then
    raise exception 'Jadwal check-in penawaran harus di masa depan.';
  end if;

  -- Official creation serializes on the room row. Take it before the quote and guest.
  perform 1 from public.rooms where id = _room and active for update;
  if not found then raise exception 'Kamar tidak aktif.'; end if;
  select * into t from reservation_offer_private.terms(_room, _package, _start);
  guest := reservation_offer_private.resolve_guest(_name, canonical, _address);

  insert into public.reservation_offers(id, guest_id, room_id, package_id, room_number, room_type, package_name,
    check_in_at, check_out_at, day_mode, total, minimum_dp_mode, minimum_dp_value, minimum_dp, created_by, request_fingerprint, guest_phone_canonical,
    status, failed_at, reason)
  values (_id, guest, _room, _package, t.room_number, t.room_type, t.package_name, _start, t.ends,
    t.day, t.total, t.dp_mode, t.dp_value, t.dp, auth.uid(), fingerprint, canonical,
    case when t.conflict then 'FAILED_UNAVAILABLE' else 'DRAFT' end,
    case when t.conflict then clock_timestamp() end,
    case when t.conflict then 'Jadwal bentrok atau okupansi tidak dapat dipastikan.' end)
  returning * into quote;
  return reservation_offer_private.payload(quote, true, quote.status);
end $$;

create function reservation_offer_private.read_offers(_guest uuid, _id uuid, _page integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform booking_quote_private.require_operator();
  if _page is null or _page < 0 or _page > 100000 then raise exception 'Halaman penawaran tidak valid.'; end if;
  -- Reconcile conditions that do not emit a transaction event, such as elapsed
  -- check-in or an overdue stay. Terminal statuses never return to the queue.
  with candidates as materialized (
    select q.id from public.reservation_offers q
    where q.status in ('DRAFT','SENT') and (_guest is null or q.guest_id = _guest) and (_id is null or q.id = _id)
      and (q.check_in_at <= statement_timestamp() or reservation_offer_private.conflict(q.room_id, q.check_in_at, q.check_out_at))
    order by q.id for update skip locked
  )
  update public.reservation_offers q
    set status = case when q.check_in_at <= statement_timestamp() then 'EXPIRED_SCHEDULE' else 'FAILED_UNAVAILABLE' end,
      failed_at = case when q.check_in_at > statement_timestamp() then clock_timestamp() end,
      reason = case when q.check_in_at <= statement_timestamp() then 'Jadwal check-in telah lewat.'
        else 'Jadwal bentrok atau okupansi tidak dapat dipastikan.' end
    from candidates c where q.id = c.id;
  if _id is not null then
    -- Full identity is needed only for an active card and its conversion.
    select reservation_offer_private.payload(q, true, q.status) into result from public.reservation_offers q
    where q.id = _id and q.status in ('DRAFT','SENT') and q.check_in_at > statement_timestamp()
      and not reservation_offer_private.conflict(q.room_id, q.check_in_at, q.check_out_at);
    return result;
  end if;
  with eligible as materialized (
    select q, case when q.status not in ('DRAFT','SENT') then q.status
      when q.check_in_at <= statement_timestamp() then 'EXPIRED_SCHEDULE'
      when reservation_offer_private.conflict(q.room_id, q.check_in_at, q.check_out_at) then 'FAILED_UNAVAILABLE'
      else q.status end as state
    from public.reservation_offers q
    where (_guest is not null and q.guest_id = _guest) or (_guest is null and q.status in ('DRAFT','SENT'))
  ), filtered as materialized (
    select e.q, e.state from eligible e where _guest is not null or e.state in ('DRAFT','SENT')
  ), page as (
    select f.q, f.state from filtered f order by (f.q).created_at desc, (f.q).id desc offset (_page * 15) limit 15
  )
  select jsonb_build_object('count', (select count(*) from filtered),
    'failed_count', case when _guest is not null then (select count(*) from filtered where state = 'FAILED_UNAVAILABLE') end,
    'rows', coalesce(jsonb_agg(reservation_offer_private.payload(p.q, false, p.state)
      order by (p.q).created_at desc, (p.q).id desc), '[]'::jsonb))
  into result from page p;
  return result;
end $$;

create function reservation_offer_private.transition(_id uuid, _action text, _amount numeric, _method text, _session uuid, _payment_verified boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.reservation_offers%rowtype;
  g public.guests%rowtype;
  t record;
  number text;
  txn uuid;
  target_room uuid;
begin
  perform booking_quote_private.require_operator();
  if _action is null or _action not in ('sent','cancel','convert') then raise exception 'Aksi penawaran tidak valid.'; end if;
  if _action = 'cancel' and not public.has_role(auth.uid(), 'owner'::public.app_role) then
    raise exception 'Hanya Owner dapat membatalkan penawaran.' using errcode = '42501';
  end if;
  select room_id into target_room from public.reservation_offers where id = _id;
  if not found then raise exception 'Penawaran tidak ditemukan.'; end if;

  -- Keep lock order aligned with official Booking and its invalidation trigger.
  perform 1 from public.rooms where id = target_room for update;
  select * into strict q from public.reservation_offers where id = _id for update;
  if q.status not in ('DRAFT','SENT') then
    return reservation_offer_private.payload(q, false, q.status);
  end if;
  if _action = 'cancel' then
    update public.reservation_offers set status = 'CANCELLED', reason = 'Dibatalkan oleh Owner.',
      cancelled_at = clock_timestamp(), cancelled_by = auth.uid() where id = q.id returning * into q;
  elsif q.check_in_at <= clock_timestamp() then
    update public.reservation_offers set status = 'EXPIRED_SCHEDULE', reason = 'Jadwal check-in telah lewat.'
      where id = q.id returning * into q;
  elsif reservation_offer_private.conflict(q.room_id, q.check_in_at, q.check_out_at) then
    update public.reservation_offers set status = 'FAILED_UNAVAILABLE', reason = 'Jadwal bentrok atau okupansi tidak dapat dipastikan.',
      failed_at = clock_timestamp() where id = q.id returning * into q;
  elsif _action = 'sent' then
    if q.status = 'DRAFT' then
      update public.reservation_offers set status = 'SENT', sent_marked_at = clock_timestamp(), sent_marked_by = auth.uid()
        where id = q.id returning * into q;
    end if;
  else
    if public.finance_training_is_restricted(auth.uid()) then
      raise exception 'Konversi penawaran belum tersedia pada sesi Training.' using errcode = '42501';
    end if;
    if not coalesce(public.finance_is_booking_operator(auth.uid()), false) then
      raise exception 'Akses Booking resmi ditolak.' using errcode = '42501';
    end if;
    perform 1 from public.finance_settings where id = true for share;
    select * into t from reservation_offer_private.terms(q.room_id, q.package_id, q.check_in_at);
    if t.conflict then
      update public.reservation_offers set status = 'FAILED_UNAVAILABLE', reason = 'Jadwal resmi bentrok.',
        failed_at = clock_timestamp() where id = q.id returning * into q;
      return reservation_offer_private.payload(q, false, q.status);
    end if;
    if t.ends is distinct from q.check_out_at or t.day is distinct from q.day_mode or t.total is distinct from q.total
      or t.dp_mode is distinct from q.minimum_dp_mode or t.dp_value is distinct from q.minimum_dp_value then
      raise exception 'Jadwal, tarif, atau aturan DP berubah. Siapkan penawaran baru.';
    end if;
    if _payment_verified is distinct from true or _session is null or _method is null or _method not in ('Cash','QRIS','Transfer')
      or _amount is null or _amount <= 0 or _amount < t.dp or _amount > t.total
    then raise exception 'Verifikasi sesi kas, metode, dan nominal pembayaran sesuai DP resmi.'; end if;
    select * into strict g from public.guests where id = q.guest_id for share;
    if reservation_offer_private.canonical_wa(g.phone) is distinct from q.guest_phone_canonical
      or not coalesce(length(trim(g.full_name)) between 1 and 100 and length(trim(g.address)) between 1 and 500, false)
    then raise exception 'Identitas tamu berubah atau tidak valid. Periksa Detail Tamu dan buat penawaran baru.'; end if;
    update public.reservation_offers set status = 'CONVERTING' where id = q.id;
    if to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamptz,uuid,uuid,integer)') is not null then
      number := public.create_reservation(
        'booking', q.room_id, q.package_id, g.full_name, q.guest_phone_canonical, g.address,
        _amount, _method, t.day, q.check_in_at, q.booking_key, _session, 2);
    else
      number := public.create_reservation(
        'booking', q.room_id, q.package_id, g.full_name, q.guest_phone_canonical, g.address,
        _amount, _method, t.day, q.check_in_at, q.booking_key, _session);
    end if;
    select tr.id into strict txn from public.transactions tr where tr.transaction_number = number
      and tr.guest_id = q.guest_id and tr.room_id = q.room_id and tr.package_id = q.package_id
      and tr.status = 'booking' and tr.price_snapshot = q.total
      and tr.scheduled_check_in = q.check_in_at and tr.scheduled_check_out = q.check_out_at;
    update public.reservation_offers set status = 'CONVERTED', converted_at = clock_timestamp(),
      transaction_id = txn where id = q.id returning * into q;
  end if;
  return reservation_offer_private.payload(q, false, q.status);
end $$;

-- Public wrappers are invoker. Private implementations independently authorize every call.
create function reservation_offer_private.search_guests(_field text, _term text)
returns table (id uuid, full_name text, phone text, address text)
language plpgsql stable security definer set search_path = '' as $$
declare
  term text := lower(trim(_term));
  digits text := regexp_replace(_term, '[^0-9]', '', 'g');
begin
  perform booking_quote_private.require_operator();
  if not coalesce(length(term) between 2 and 100, false) then return; end if;
  if _field = 'name' then
    return query select g.id, g.full_name, g.phone, g.address from public.guests g
    where strpos(lower(g.full_name), term) > 0 order by lower(g.full_name), g.id limit 6;
  elsif _field = 'phone' and length(digits) >= 3 then
    return query select g.id, g.full_name, g.phone, g.address from public.guests g
    cross join lateral (select reservation_offer_private.canonical_wa(g.phone) as canonical) w
    where strpos(w.canonical, digits) > 0
       or (w.canonical like '62%' and strpos('0' || substr(w.canonical,3), digits) > 0)
    order by (w.canonical = reservation_offer_private.canonical_wa(digits)) desc, g.full_name, g.id limit 6;
  end if;
end $$;
create function public.search_reservation_guests(_field text, _term text)
returns table (id uuid, full_name text, phone text, address text)
language sql stable security invoker set search_path = '' as $$
  select * from reservation_offer_private.search_guests(_field,_term)
$$;

create function public.create_reservation_offer(_id uuid, _name text, _phone text, _address text, _room uuid, _package uuid, _start timestamptz)
returns jsonb language sql security invoker set search_path = '' as $$
  select reservation_offer_private.create_offer(_id,_name,_phone,_address,_room,_package,_start)
$$;
create function public.read_reservation_offers(_guest uuid default null, _id uuid default null, _page integer default 0)
returns jsonb language sql security invoker set search_path = '' as $$
  select reservation_offer_private.read_offers(_guest,_id,_page)
$$;
create function public.transition_reservation_offer(_id uuid, _action text, _amount numeric default null, _method text default null,
  _session uuid default null, _payment_verified boolean default false)
returns jsonb language sql security invoker set search_path = '' as $$
  select reservation_offer_private.transition(_id,_action,_amount,_method,_session,_payment_verified)
$$;

revoke all on all functions in schema reservation_offer_private from public, anon, authenticated, service_role;
revoke all on function public.create_reservation_offer(uuid,text,text,text,uuid,uuid,timestamptz),
  public.read_reservation_offers(uuid,uuid,integer),
  public.search_reservation_guests(text,text),
  public.transition_reservation_offer(uuid,text,numeric,text,uuid,boolean) from public, anon, authenticated, service_role;
-- The immutable phone normalizer is needed by the expression index on guest writes.
grant execute on function reservation_offer_private.canonical_wa(text),
  reservation_offer_private.create_offer(uuid,text,text,text,uuid,uuid,timestamptz),
  reservation_offer_private.read_offers(uuid,uuid,integer),
  reservation_offer_private.search_guests(text,text),
  reservation_offer_private.transition(uuid,text,numeric,text,uuid,boolean),
  public.create_reservation_offer(uuid,text,text,text,uuid,uuid,timestamptz),
  public.read_reservation_offers(uuid,uuid,integer),
  public.search_reservation_guests(text,text),
  public.transition_reservation_offer(uuid,text,numeric,text,uuid,boolean) to authenticated;
grant usage on schema reservation_offer_private to service_role;
grant execute on function reservation_offer_private.canonical_wa(text) to service_role;

notify pgrst, 'reload schema';
commit;
