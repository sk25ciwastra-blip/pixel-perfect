# Preflight read-only Cloud Lovable — Extra Guest & Receipt 58 mm

**Proyek:** Baturaden 25 Homestay — 3 November 2026. **Status:** **NO-GO untuk migrasi/aktivasi**. Pemeriksaan menggunakan hanya SELECT terhadap Cloud Lovable; tidak menjalankan perubahan schema, RPC, data, deployment, atau publish.

## Bukti Cloud yang diperiksa

Project Lovable `017f6e78-15f2-4d07-a38c-87cb185279bf`.

- `public.create_reservation` tersedia sebagai overload **10** dan **12** parameter; overload dengan `_guest_count` **tidak ada**.
- Kedua overload `create_reservation`, `check_in_booking(uuid)`, dan `get_finance_session_summary(uuid)` berjalan dengan `SECURITY DEFINER`. `anon` EXECUTE = false, `authenticated` EXECUTE = true, berdasarkan `has_function_privilege` pada Cloud. Pemeriksaan ACL hanya mencakup fungsi tersebut, bukan keseluruhan RPC.
- `issue_payment_receipt`, `request_receipt_print`, dan `record_receipt_print_result` tidak ada.
- Tabel `payments` dan `transactions` ada; tidak ditemukan tabel bernama dengan pola receipt.
- `transactions` memiliki `price_snapshot`, `minimum_dp_amount_snapshot`, `minimum_dp_mode_snapshot`, `minimum_dp_value_snapshot`, serta snapshot komisi. Kolom `guest_count`, `extra_guest_count`, dan `extra_guest_charge` **tidak ditemukan**.
- `finance_settings` memiliki `minimum_dp_mode` dan `minimum_dp_value`.
- Pemeriksaan ini berbasis metadata; **belum membuktikan** kompatibilitas pemanggil eksternal, data historis, keamanan setiap RPC, maupun readiness pemulihan.

## Urutan gate aman (belum izin eksekusi)

1. Peta versi frontend yang **betul-betul deployed** di Lovable vs GitHub `main`; pastikan jalur `create_reservation` 10/12-argumen masih digunakan pelanggan dan tetap backward-compatible.
2. Review SQL forward-only Extra Guest: alter columns dengan default/backfill aman, overload 13 argumen, konsistensi DP grand total, audit operator dan sesi kas, idempotency, no overwrite `price_snapshot` lama.
3. Review SQL Receipt: relasi payment→receipt, sequence copy/print per payment, RLS/grants/authorization, no implicit print success, serta rollback/recovery.
4. Jalankan migration + tests pada PostgreSQL **terisolasi** dengan data dummy, bukan staging/Cloud; buktikan legacy 10/12 tetap PASS. Jangan jalankan migration revoke legacy `20261022000004_revoke_legacy_rpc_execute.sql`.
5. Verifikasi source Lovable dan desain dengan flags OFF; harmonisasi sakelar Lovable `src/lib/fitur.ts` (satu env) vs GitHub `src/lib/feature-flags.ts` (3 env) harus selesai sebelum publish.
6. Setelah bukti tes dan checklist recovery, minta persetujuan Owner **terpisah** untuk Cloud migration; deployment/publish dan aktivasi fitur memerlukan gate tersendiri.

## Larangan

Tidak boleh menganggap merge GitHub sebagai deploy Lovable. Jangan migrasi Cloud, publish, mengaktifkan flag, mengubah transaksi historis, mereset data, atau mencabut RPC legacy tanpa persetujuan eksplisit dan bukti kompatibilitas.
