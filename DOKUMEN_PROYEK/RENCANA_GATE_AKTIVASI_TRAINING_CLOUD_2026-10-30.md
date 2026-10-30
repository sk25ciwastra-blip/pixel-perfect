# Gerbang aktivasi Training → Extra Guest/Receipt Cloud — 30 Oktober 2026

**Proyek:** Baturaden 25 Homestay  
**Status:** **RENCANA SAJA / CLOUD NO-GO / tidak menjalankan migrasi**.  
**Lingkungan target:** Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf`; **bukan** Supabase staging.

## Bukti yang sudah tersedia (jangan ulang tanpa regresi)

- Source `main` diperiksa pada 30 Oktober: 56 berkas `src/**/*.ts(x)` non-UI. Pemanggilan frontend `create_reservation` pada `src/components/formulir-pemesanan.tsx` memakai `_guest_count`, `_idempotency_key`, `_session_id` dan `_scheduled_check_in` opsional. Pemanggilan `record_transaction_payment` di `src/routes/booking.tsx` memakai lima argumen, termasuk `_idempotency_key` dan `_session_id`. Tidak ditemukan callsite langsung legacy pada source tersebut. **Ini bukan bukti tidak ada klien eksternal.**
- Cloud Lovable: `pg_stat_statements` tersedia; `pg_stat_statements.track=top`, `track_functions=none`, `stats_reset=2026-09-28 02:10:59+00`. Baris statistik yang teksnya memuat `create_reservation`: 29 bentuk/58 panggilan; `record_transaction_payment`: 17 bentuk/46 panggilan. **Ini agregat query yang menyebut nama fungsi, bukan jumlah transaksi maupun panggilan signature legacy.** Bucket teks `_guest_count`/ `_session_id` juga tidak boleh dipakai menyimpulkan caller legacy karena query SQL bisa merujuk nama fungsi tanpa parameter tersebut.
- Checkpoint terpisah `CHECKPOINT_ACL_RPC_LOVABLE_CLOUD_2026-10-30.md`: `authenticated` masih memiliki EXECUTE untuk signature legacy; preflight eksternal belum clear.
- `CHECKPOINT_DEPENDENSI_TRAINING_RECEIPT_CLOUD_2026-10-30.md`: objek dasar tersedia, objek Training/Receipt baru belum ada.
- Export Lovable 30 Okt telah diuji pada PostgreSQL lokal 17.11: hitungan data 11 transaksi, 15 pembayaran, 12 kamar, 14 tamu, 11 `auth.users`, 59/59 FK `public` valid; server lab sudah berhenti. **Restore seluruh stack Supabase belum PASS** (`supabase_vault` tidak terpasang pada PostgreSQL biasa). Dokumentasi detail terpisah pada PR #15, belum otomatis merged.

## Urutan migration yang direncanakan (belum dijalankan)

1. `20261018000000_finance_training_enforcement.sql` — Training; **tidak murni additive**, karena selain membuat tabel/fungsi juga mengubah fungsi/hook yang sudah ada dengan `CREATE OR REPLACE` dan trigger. Perlu review perbedaan perilaku aktif.
2. `20261022000000_extra_guest_receipt_foundation.sql` — kolom Extra Guest, fondasi Receipt, kontrak reservasi.
3. `20261022000001_receipt_thermal_58mm.sql` — struk 58 mm.
4. `20261022000002_booking_time_dashboard_enforcement.sql` — jadwal, checkout, dashboard.
5. `20261022000003_extra_guest_receipt_hardening.sql` — pengamanan.
6. `20261022000004_revoke_legacy_rpc_execute.sql` — **tahap terpisah**, tidak boleh dijalankan bersama 1–5; tunggu bukti migrasi semua caller.

Guard offline `npm run test:cloud-order` dari PR #14 sudah PASS pada checkpoint sebelumnya; tidak perlu diulang tanpa perubahan.


## Dampak konkret migration Training terhadap fungsi Cloud aktif (read-only 30 Okt)

Migration mendefinisikan 29 fungsi `CREATE OR REPLACE FUNCTION`. Dari nama fungsi tersebut, **6 sudah ada** di Lovable Cloud dengan signature yang sama dan karena itu akan menerima penggantian body; **23 nama belum ada** pada katalog Cloud yang diperiksa:

| Fungsi yang sudah aktif | Signature Cloud | Return | Security |
| --- | --- | --- | --- |
| `can_frontdesk` | `(_user_id uuid)` | boolean | DEFINER, stable |
| `is_receptionist` | `(_user_id uuid)` | boolean | DEFINER, stable |
| `finance_is_owner_or_supervisor` | `(_user_id uuid)` | boolean | DEFINER, stable |
| `finance_is_booking_operator` | `(_user_id uuid)` | boolean | DEFINER, stable |
| `finance_prepare_payment` | `()` | trigger | DEFINER, volatile |
| `get_finance_session_summary` | `(_session_id uuid)` | jsonb | DEFINER, volatile |

Semua enam fungsi memiliki EXECUTE untuk `authenticated` saat diperiksa. File migrasi juga mendefinisikan dua tabel Training dan 17 `CREATE TRIGGER`; ini adalah area perubahan perilaku aktif, bukan operasi penambahan kolom sederhana. Signature/return pada definisi pengganti enam fungsi sesuai jenis yang terlihat di katalog, tetapi **kesetaraan perilaku body belum dinyatakan PASS**. Audit hak akses lengkap dan integrasi setelah migrasi tetap menjadi gate terpisah.

## Stop conditions sebelum write Lovable Cloud

- Persetujuan Owner yang **spesifik** untuk migrasi produksi, setelah review SQL dan dampak `CREATE OR REPLACE`.
- Putuskan standar pemulihan yang cukup: hasil restore data aplikasi lokal **bukan** verifikasi seluruh stack Supabase. Tinjau rencana pemulihan/rollback yang nyata tanpa memakai tombol Restore produksi secara tidak sengaja.
- Preflight schema/ACL serta dependensi tepat sebelum migrasi; jika baseline drift, **STOP**.
- Buktikan UI/klien yang akan dipakai sudah kompatibel; statistik SQL `top` tidak membuktikan nol pemanggil eksternal. Jangan revoke legacy sampai diverifikasi atau ada rencana transisi terkontrol yang disetujui.
- Tahap produksi lakukan satu migration dalam satu waktu, verifikasi hasilnya, berhenti jika ada error; jangan memaksakan batch penuh atau deploy frontend otomatis.
- Jangan menganggap source `main` otomatis sudah dipublikasikan di Lovable Cloud. Cocokkan commit/build deployed sebelum mengganti signature.

**Larangan:** Tidak ada DDL/DML/REVOKE/restore production/deploy dari dokumen ini. Tidak menaruh data Auth, hash, nama tamu, token, atau backup di GitHub.
