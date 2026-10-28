# Urutan migrasi Cloud berdasarkan preflight nyata — 29 Oktober 2026

Status: **READ-ONLY / NO-GO untuk write produksi**, sampai backup restore teruji, audit external callers, dan persetujuan Owner.

## Fakta terukur
Koneksi Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf` (bukan Supabase Staging `bgtztcfbkcrvcipxbfti`).
- 11 transaksi, 15 pembayaran, 14 tamu. `price_snapshot` ada, 11/11 terisi, total Rp1.040.000.
- Training foundation belum ada: `finance_training_assignments` 0 relasi, `create_training_reservation` 0 RPC, `check_in_training_booking` 0 RPC.
- Extra Guest: `transactions.guest_count` tidak ada.
- Receipt: `payment_receipts` dan `receipt_template_versions` tidak ada; `issue_payment_receipt` 0 RPC.
- `next_transaction_number()` ada satu; `check_in_booking(uuid)` ada satu.
- `create_reservation` saat ini dua signature: 10 argumen dan 12 argumen. `record_transaction_payment` tiga signature: 3, 4, 5 argumen. **Jangan revoke 10/3/4** sebelum memastikan caller eksternal tak memakainya.

## File migration utama dalam GitHub main (cek dependency dan status eksekusi sebelumnya, jangan jalankan dua kali secara membabi buta)
1. `20261018000000_finance_training_enforcement.sql` — Training Foundation (bukti belum ada).
2. `20261019000000_owner_final_numbering.sql` — penomoran, **sebagian objek sudah ada**; harus audit versi/riwayat migrasi sebelum reaplikasi.
3. `20261019000001_harden_checkout_payment_settlement.sql` — check-out hardening; audit apakah sudah berlaku.
4. `20261022000000_extra_guest_receipt_foundation.sql` — Extra Guest dan fondasi receipt, bergantung Training.
5. `20261022000001_receipt_thermal_58mm.sql` — per-payment receipt, template, print API.
6. `20261022000002_booking_time_dashboard_enforcement.sql` — booking time enforcement; audit current function sebelum apply.
7. `20261022000003_extra_guest_receipt_hardening.sql` — hardening.
8. `20261022000004_revoke_legacy_rpc_execute.sql` — **HARUS PALING TERAKHIR**, setelah preflight/clearance 10/3/4, bukan otomatis satu paket.

## Gerbang sebelum migrasi
- Konfirmasi project Cloud dan akses restore. Screenshot backup UI 18–28 Okt menunjukkan backup tersedia, tetapi **uji restore terisolasi belum ada**.
- Baseline backup + bukti pemulihan / prosedur rollback teruji. Jangan memakai tombol Restore pada DB produksi untuk percobaan.
- Review version/DDL dan migration history agar perubahan parsial tidak dieksekusi dua kali.
- Preflight SELECT-only untuk ACL, RLS, signature, snapshot nilai historis, dependencies, serta caller API eksternal.
- Setelah izin Owner, gunakan migrasi bertahap dengan verifikasi post-stage dan smoke tests. Tidak ada SQL write dalam pemeriksaan yang mendasari dokumen ini.
