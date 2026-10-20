-- Booking reference-data privilege correction.
-- RLS remains authoritative; authenticated users receive read-only access only.

BEGIN;

GRANT SELECT ON TABLE public.package_room_type_prices TO authenticated;
GRANT SELECT ON TABLE public.operational_calendar TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_day_mode(date) TO authenticated;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.package_room_type_prices, public.operational_calendar
FROM PUBLIC, anon, authenticated;

COMMIT;
