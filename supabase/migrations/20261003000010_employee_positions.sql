-- Task 1.6 — Extend employee positions
-- Existing enum values and employee records are preserved.

alter type public.employee_position add value if not exists 'supervisor';
alter type public.employee_position add value if not exists 'inspector';
alter type public.employee_position add value if not exists 'investor';
