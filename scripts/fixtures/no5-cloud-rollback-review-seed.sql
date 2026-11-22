-- Disposable PostgreSQL 17 only. Synthetic actors/price and session for
-- validating the Owner-approved-later Cloud ROLLBACK script's SQL path.
-- Never run on the real Lovable Cloud. This is NOT a real auth.users fixture.
INSERT INTO public.employees(user_id,name,employee_id,active,position) VALUES
('00000000-0000-4000-8000-000000000002','Fixture Receptionist','B25EMP-002',true,'receptionist'),
('00000000-0000-4000-8000-000000000003','Fixture Housekeeping','TEST-HK',true,'housekeeping');
INSERT INTO public.room_types(id,pricing_group) VALUES
('11000000-0000-4000-8000-000000000005','standard');
INSERT INTO public.packages(id,name,active,time_mode,duration_minutes) VALUES
('20000000-0000-4000-8000-000000000001','Paket 2 Jam',true,'duration',120);
INSERT INTO public.package_room_type_prices(package_id,pricing_group,weekday_price,weekend_price) VALUES
('20000000-0000-4000-8000-000000000001','standard',200000,200000);
INSERT INTO public.finance_cash_sessions(id,opened_by,opening_cash,status) VALUES
('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',0,'OPEN');
INSERT INTO public.finance_settings(minimum_dp_mode,minimum_dp_value)
VALUES('PERCENTAGE',40);
