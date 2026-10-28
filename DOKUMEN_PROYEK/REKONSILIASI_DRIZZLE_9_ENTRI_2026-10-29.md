# Rekonsiliasi 9 entri Drizzle Cloud — 29 Oktober 2026

## Bukti langsung (SELECT-only, tidak mengubah Cloud)
- Cloud Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf`: `drizzle.__drizzle_migrations` memuat **9 entri** (ID 1–9).
- GitHub `main` `drizzle/migrations/meta/_journal.json` hanya memuat **6 entries** (idx 0–5); folder `drizzle/migrations` hanya memiliki 0000 s.d. 0005, beserta meta snapshots.
- **Timestamp 6 entri pertama cocok persis** dengan journal repo, bergeser ID +1:

| Cloud ID | created_at | Journal tag GitHub |
|---|---|---|
|1|1790567917357|0000_operational_foundation|
|2|1790567949052|0001_fix_audit_price_column_scope|
|3|1790568063938|0002_operational_permissions_and_number_safety|
|4|1790568140953|0003_package_price_reason_and_inactive_auth|
|5|1790568174308|0004_checkin_atomic_transaction|
|6|1790899725065|0005_booking_checkin_payments_and_duration|

## Tiga migration Drizzle belum terpetakan
| Cloud ID | created_at | Pemetaan repo |
|---|---|---|
|7|1792769178207|BELUM ditemukan pada journal GitHub main|
|8|1792791432980|BELUM ditemukan pada journal GitHub main|
|9|1792791812094|BELUM ditemukan pada journal GitHub main|

**Jangan menganggap 3 entri terakhir sebagai migration SQL Supabase tertentu tanpa bukti.** Id/hash Drizzle tidak langsung memberi nama file dan tidak menandakan file Supabase SQL diterapkan. Perlu memperoleh source/journal Lovable atau riwayat commit untuk 3 entri itu, lalu cocokkan hash dan schema nyata.

## Gate migrasi
- Source PR #12 masuk main, namun Training/Extra Guest/Receipt Cloud masih absen; cloud migration tetap NO-GO.
- Backup terdaftar di UI; restore terisolasi belum teruji.
- RPC legacy 10/3/4 masih ada, consumer eksternal belum diverifikasi.
- Tidak dilakukan DDL, DML, migration, atau restore dalam rekonsiliasi ini.
