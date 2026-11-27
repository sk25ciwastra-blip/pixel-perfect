-- Disposable PostgreSQL only, after old calendar migrations 00011 + 00012.
-- Four tariff scenarios plus a future Owner override.
INSERT INTO public.operational_calendar
(calendar_date,holiday_name,is_national_holiday,owner_override,event_type)
VALUES
 ('2026-12-24','Cuti Bersama',false,NULL,'collective_leave'),
 ('2026-12-25','Hari Libur Nasional',true,NULL,'national_holiday'),
 ('2026-12-28',NULL,false,'weekend',NULL);

GRANT SELECT ON TABLE public.operational_calendar TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operational_day_mode(date) TO PUBLIC,anon,authenticated;

CREATE TABLE b25_maintenance_private.operational_calendar_backup_20261127
AS SELECT * FROM public.operational_calendar;
ALTER TABLE b25_maintenance_private.operational_calendar_backup_20261127 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON b25_maintenance_private.operational_calendar_backup_20261127 FROM PUBLIC,anon,authenticated;

CREATE TABLE b25_maintenance_private.operational_calendar_policy_backup_20261127
AS SELECT clock_timestamp() AS snapshot_at, jsonb_agg(to_jsonb(p)) AS policies
FROM pg_policies p WHERE p.schemaname='public' AND p.tablename='operational_calendar';
ALTER TABLE b25_maintenance_private.operational_calendar_policy_backup_20261127 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON b25_maintenance_private.operational_calendar_policy_backup_20261127 FROM PUBLIC,anon,authenticated;
