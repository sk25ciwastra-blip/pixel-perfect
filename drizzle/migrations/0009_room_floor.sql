alter table public.rooms
  add column if not exists lantai smallint;

comment on column public.rooms.lantai is
  'Lantai kamar; kosong bila belum dicatat.';