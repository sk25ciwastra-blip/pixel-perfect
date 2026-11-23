begin;
set local lock_timeout = '5s';

revoke execute on function public.create_reservation_offer(uuid,text,text,text,uuid,uuid,timestamptz),
  public.read_reservation_offers(uuid,uuid,integer), public.search_reservation_guests(text,text),
  public.transition_reservation_offer(uuid,text,numeric,text,uuid,boolean)
  from authenticated;
revoke execute on function reservation_offer_private.create_offer(uuid,text,text,text,uuid,uuid,timestamptz),
  reservation_offer_private.read_offers(uuid,uuid,integer), reservation_offer_private.search_guests(text,text),
  reservation_offer_private.transition(uuid,text,numeric,text,uuid,boolean)
  from authenticated;

-- Stop official writes while restoring the methods that used literal lookup.
-- Refuse to replace a newer function definition.
do $rollback$
declare
  saved record;
  writer_oid oid;
begin
  if not exists (select 1 from reservation_offer_private.booking_originals) then
    raise exception 'Definisi asli Booking tidak tersedia.';
  end if;
  for saved in select * from reservation_offer_private.booking_originals order by signature
  loop
    writer_oid := to_regprocedure(saved.signature);
    if writer_oid is null or
      sha256(convert_to(pg_get_functiondef(writer_oid), 'UTF8')) is distinct from saved.patched_sha256
    then raise exception 'Definisi % berubah sejak patch; tinjau ulang rollback.', saved.signature; end if;
    execute saved.original_definition;
  end loop;
end $rollback$;

-- Literal lookup and the canonical constraint must be rolled back together.
drop index public.guests_offer_canonical_wa_idx;
alter table public.transactions disable trigger reservation_offers_invalidate;
notify pgrst, 'reload schema';
commit;
