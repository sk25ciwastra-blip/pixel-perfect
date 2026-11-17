CREATE OR REPLACE FUNCTION public.validate_room_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
