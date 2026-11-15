CREATE OR REPLACE FUNCTION public.enforce_short_package_checkin_windows()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.name = 'Paket 2 Jam' THEN
  NEW.checkin_start_time := TIME '06:00'; NEW.checkin_end_time := TIME '23:30';
 ELSIF NEW.name = 'Paket 4 Jam' THEN
  NEW.checkin_start_time := TIME '06:00'; NEW.checkin_end_time := TIME '21:30';
 ELSIF NEW.name = 'Paket 6 Jam' THEN
  NEW.checkin_start_time := TIME '04:30'; NEW.checkin_end_time := TIME '19:30';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_short_package_checkin_windows() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER short_package_checkin_windows BEFORE INSERT OR UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.enforce_short_package_checkin_windows();