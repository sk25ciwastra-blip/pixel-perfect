begin;

create table public.hk_supply_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  unit text not null check (length(btrim(unit)) between 1 and 40),
  quantity integer not null check (quantity >= 0),
  minimum integer check (minimum >= 0)
);
create unique index hk_supply_items_name_idx on public.hk_supply_items (lower(name));

create table public.hk_issue_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete restrict,
  room_number text,
  area text check (length(btrim(area)) between 1 and 100),
  supply_id uuid references public.hk_supply_items(id) on delete restrict,
  category text not null check (category in ('pemakaian', 'kekurangan', 'kerusakan', 'kebersihan', 'lainnya')),
  description text not null check (length(btrim(description)) between 1 and 2000),
  priority text not null check (priority in ('rendah', 'normal', 'tinggi', 'mendesak')),
  status text not null default 'DILAPORKAN' check (status in ('DILAPORKAN', 'DIPROSES', 'SELESAI')),
  reported_by uuid not null,
  reported_by_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  check (supply_id is null or category in ('pemakaian', 'kekurangan')),
  check ((room_id is null) = (room_number is null))
);
create index hk_issue_reports_room_idx on public.hk_issue_reports (room_id) where room_id is not null;
create index hk_issue_reports_supply_idx on public.hk_issue_reports (supply_id) where supply_id is not null;
create index hk_issue_reports_status_idx on public.hk_issue_reports (status, created_at desc, id desc);

create table public.hk_operational_events (
  actor_id uuid not null,
  request_id uuid not null,
  actor_name text not null,
  created_at timestamptz not null default clock_timestamp(),
  action text not null check (action in ('initial', 'adjust', 'minimum', 'report', 'follow_up')),
  supply_id uuid references public.hk_supply_items(id) on delete restrict,
  issue_id uuid references public.hk_issue_reports(id) on delete restrict,
  note text not null check (length(btrim(note)) between 1 and 2000),
  balance_before integer check (balance_before >= 0),
  balance_after integer check (balance_after >= 0),
  minimum_before integer check (minimum_before >= 0),
  minimum_after integer check (minimum_after >= 0),
  status_before text check (status_before in ('DILAPORKAN', 'DIPROSES', 'SELESAI')),
  status_after text check (status_after in ('DILAPORKAN', 'DIPROSES', 'SELESAI')),
  request_payload jsonb not null,
  primary key (actor_id, request_id),
  check (
    (action in ('initial', 'adjust', 'minimum') and supply_id is not null and issue_id is null)
    or (action in ('report', 'follow_up') and issue_id is not null and supply_id is null)
  )
);
create index hk_events_supply_idx on public.hk_operational_events (supply_id, created_at desc, actor_id, request_id)
  where supply_id is not null;
create index hk_events_issue_idx on public.hk_operational_events (issue_id, created_at desc, actor_id, request_id)
  where issue_id is not null;

alter table public.hk_supply_items enable row level security;
alter table public.hk_issue_reports enable row level security;
alter table public.hk_operational_events enable row level security;

revoke all on public.hk_supply_items, public.hk_issue_reports, public.hk_operational_events from public, anon, authenticated, service_role;
grant select on public.hk_supply_items, public.hk_issue_reports, public.hk_operational_events to authenticated;

create policy hk_supply_read on public.hk_supply_items for select to authenticated
  using ((select public.can_housekeeping(auth.uid())));
create policy hk_issue_read on public.hk_issue_reports for select to authenticated
  using ((select public.can_housekeeping(auth.uid())));
create policy hk_event_read on public.hk_operational_events for select to authenticated
  using ((select public.can_housekeeping(auth.uid())));

create schema hk_issue_133_private;
revoke all on schema hk_issue_133_private from public, anon, authenticated, service_role;
grant usage on schema hk_issue_133_private to authenticated;

create function hk_issue_133_private.record_action(_request_id uuid, _action text, _payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  owner_access boolean;
  actor_label text;
  previous public.hk_operational_events%rowtype;
  item public.hk_supply_items%rowtype;
  issue public.hk_issue_reports%rowtype;
  item_id uuid;
  issue_id uuid;
  room_ref uuid;
  room_label text;
  note_text text := btrim(_payload->>'note');
  minimum_value integer;
  quantity_value integer;
  next_balance bigint;
  next_status text;
begin
  if actor is null or not coalesce(public.can_housekeeping(actor), false) then
    raise exception 'Akses Housekeeping ditolak.' using errcode = '42501';
  end if;
  owner_access := coalesce(public.has_role(actor, 'owner'), false);
  if _action in ('initial', 'adjust', 'minimum') and not owner_access then
    raise exception 'Hanya Owner dapat mengubah stok.' using errcode = '42501';
  end if;
  if _action = 'follow_up' and not owner_access and not coalesce(
    public.has_employee_position(actor, array['supervisor']::public.employee_position[]), false
  ) then
    raise exception 'Tindak lanjut memerlukan Owner atau Supervisor.' using errcode = '42501';
  end if;

  if _request_id is null or _action is null or _action not in ('initial', 'adjust', 'minimum', 'report', 'follow_up')
    or jsonb_typeof(_payload) is distinct from 'object' or pg_column_size(_payload) > 16384
    or jsonb_typeof(_payload->'note') is distinct from 'string'
    or not coalesce(length(note_text) between 1 and 2000, false)
    or note_text !~ '[^[:space:]]'
  then
    raise exception 'Lengkapi catatan atau deskripsi (1–2000 karakter) dan periksa data formulir.' using errcode = '22023';
  end if;

  -- Serialize retries for the same authenticated actor and request before taking any row lock.
  perform pg_advisory_xact_lock(hashtextextended('hk133:' || actor::text || ':' || _request_id::text, 0));
  select * into previous from public.hk_operational_events where actor_id = actor and request_id = _request_id;
  if found then
    if previous.action <> _action or previous.request_payload <> _payload then
      raise exception 'ID permintaan sudah dipakai untuk data yang berbeda.' using errcode = '22023';
    end if;
    return coalesce(previous.supply_id, previous.issue_id);
  end if;

  select name into actor_label from public.employees
    where user_id = actor and active order by id limit 1;
  actor_label := coalesce(nullif(btrim(actor_label), ''), case when owner_access then 'Owner' end);
  if actor_label is null then
    raise exception 'Identitas petugas aktif tidak tersedia.' using errcode = '42501';
  end if;

  if _action in ('initial', 'minimum') then
    if not (_payload ? 'minimum') or (
      _payload->'minimum' <> 'null'::jsonb
      and (jsonb_typeof(_payload->'minimum') <> 'number' or _payload->>'minimum' !~ '^[0-9]+$')
    ) then
      raise exception 'Batas minimum harus berupa bilangan bulat nol atau lebih, atau dikosongkan.' using errcode = '22023';
    end if;
    minimum_value := (_payload->>'minimum')::integer;
  end if;

  if _action in ('initial', 'adjust') then
    if jsonb_typeof(_payload->'quantity') is distinct from 'number' or _payload->>'quantity' !~ '^-?[0-9]+$' then
      raise exception 'Jumlah stok harus berupa bilangan bulat.' using errcode = '22023';
    end if;
    quantity_value := (_payload->>'quantity')::integer;
  end if;

  if _action = 'initial' then
    if quantity_value < 0
      or jsonb_typeof(_payload->'name') is distinct from 'string'
      or not coalesce(length(btrim(_payload->>'name')) between 1 and 100, false)
      or _payload->>'name' !~ '[^[:space:]]'
      or jsonb_typeof(_payload->'unit') is distinct from 'string'
      or not coalesce(length(btrim(_payload->>'unit')) between 1 and 40, false)
      or _payload->>'unit' !~ '[^[:space:]]'
    then
      raise exception 'Isi nama, satuan, dan stok awal aktual (nol atau lebih).' using errcode = '22023';
    end if;
    insert into public.hk_supply_items (name, unit, quantity, minimum)
      values (btrim(_payload->>'name'), btrim(_payload->>'unit'), quantity_value, minimum_value)
      on conflict (lower(name)) do nothing returning id into item_id;
    if not found then
      raise exception 'Nama perlengkapan sudah terdaftar.' using errcode = '23505';
    end if;
    next_balance := quantity_value;
  elsif _action in ('adjust', 'minimum') then
    item_id := (_payload->>'supplyId')::uuid;
    select * into item from public.hk_supply_items where id = item_id for update;
    if not found then
      raise exception 'Perlengkapan tidak ditemukan.' using errcode = '22023';
    end if;
    if _action = 'adjust' then
      next_balance := item.quantity::bigint + quantity_value;
      if quantity_value = 0 or next_balance < 0 or next_balance > 2147483647 then
        raise exception 'Jumlah penyesuaian harus di atas nol dan saldo akhir harus antara 0 dan 2147483647.' using errcode = '22023';
      end if;
      minimum_value := item.minimum;
    else
      next_balance := item.quantity;
    end if;
    update public.hk_supply_items set quantity = next_balance, minimum = minimum_value where id = item_id;
  elsif _action = 'report' then
    if not coalesce(_payload->>'category' in ('pemakaian', 'kekurangan', 'kerusakan', 'kebersihan', 'lainnya'), false)
      or not coalesce(_payload->>'priority' in ('rendah', 'normal', 'tinggi', 'mendesak'), false)
      or coalesce(jsonb_typeof(_payload->'area') not in ('string', 'null'), false)
      or length(btrim(_payload->>'area')) > 100
    then
      raise exception 'Pilih kategori dan prioritas yang valid. Area maksimal 100 karakter.' using errcode = '22023';
    end if;
    room_ref := (_payload->>'roomId')::uuid;
    if room_ref is not null then
      select room_number into room_label from public.rooms where id = room_ref and active and room_number <> '01';
      if not found then
        raise exception 'Kamar operasional tidak ditemukan.' using errcode = '22023';
      end if;
    end if;
    if _payload->>'supplyId' is not null and (
      _payload->>'category' not in ('pemakaian', 'kekurangan') or not exists (
        select 1 from public.hk_supply_items where id = (_payload->>'supplyId')::uuid
      )
    ) then
      raise exception 'Pilih perlengkapan terdaftar untuk laporan pemakaian atau kekurangan.' using errcode = '22023';
    end if;
    insert into public.hk_issue_reports (
      room_id, room_number, area, supply_id, category, description, priority, reported_by, reported_by_name
    ) values (
      room_ref, room_label, nullif(btrim(_payload->>'area'), ''), (_payload->>'supplyId')::uuid,
      _payload->>'category', note_text, _payload->>'priority', actor, actor_label
    ) returning id, status into issue_id, next_status;
  else
    issue_id := (_payload->>'issueId')::uuid;
    select * into issue from public.hk_issue_reports where id = issue_id for update;
    if not found then
      raise exception 'Laporan tidak ditemukan.' using errcode = '22023';
    end if;
    next_status := _payload->>'status';
    if issue.status is distinct from _payload->>'expectedStatus' then
      raise exception 'Status laporan sudah berubah. Muat ulang sebelum menindaklanjuti.' using errcode = '22023';
    end if;
    if not coalesce(
      (issue.status = 'DILAPORKAN' and next_status in ('DILAPORKAN', 'DIPROSES'))
      or (issue.status = 'DIPROSES' and next_status in ('DIPROSES', 'SELESAI')), false
    ) then
      raise exception 'Perubahan status laporan tidak valid.' using errcode = '22023';
    end if;
    update public.hk_issue_reports set status = next_status where id = issue_id;
  end if;

  insert into public.hk_operational_events (
    actor_id, request_id, actor_name, action, supply_id, issue_id, note,
    balance_before, balance_after, minimum_before, minimum_after, status_before, status_after, request_payload
  ) values (
    actor, _request_id, actor_label, _action, item_id, issue_id, note_text,
    item.quantity, next_balance, item.minimum, minimum_value, issue.status, next_status, _payload
  );
  return coalesce(item_id, issue_id);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Data pilihan atau jumlah di luar batas yang diizinkan.' using errcode = '22023';
end;
$$;

create function public.record_hk_operational_action(_request_id uuid, _action text, _payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select hk_issue_133_private.record_action(_request_id, _action, _payload);
$$;

revoke all on function hk_issue_133_private.record_action(uuid, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.record_hk_operational_action(uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function hk_issue_133_private.record_action(uuid, text, jsonb) to authenticated;
grant execute on function public.record_hk_operational_action(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
