# Gate migrasi backend Cloud — audit read-only 3 November 2026

**Baturaden 25 Homestay — NO-GO aktivasi.** Tidak ada DDL/DML/merge/deploy/publish. Referensi source: GitHub `main` setelah PR #25, merge `a00c70f54b4340fbf519551237d0feb68864f285`. Target: Lovable project `017f6e78-15f2-4d07-a38c-87cb185279bf`.

## Bukti SQL read-only aktual
- `pg_proc`: `public.create_reservation` tersedia hanya versi **10 dan 12 argumen**. Versi 13 argumen termasuk `_guest_count integer` **belum ada**. Keduanya masih `EXECUTE` untuk `authenticated`.
- `pg_proc`: `get_finance_session_summary(_session_id uuid)` ada dan executable authenticated.
- Tidak terdapat `issue_payment_receipt`, `request_receipt_print`, `record_receipt_print_result`.
- `information_schema.tables`: `transactions` dan `payments` ada; tidak ada tabel bernama Receipt.
- `transactions`: `price_snapshot` ada; **belum ada** `guest_count`, `extra_guest_count`, `extra_guest_charge`, `base_price_snapshot`. Jangan membaca ketiadaan kolom sebagai kegagalan historis: migrasi Extra Guest memang belum diterapkan.
- Live Standard P4 sudah Rp90.000 weekday / Rp100.000 weekend dari pengecekan terpisah (3 Nov); migrasi koreksi katalog lokal bersifat idempotent.

## Implikasi
1. Frontend GitHub PR #25 sudah memiliki jalur `_guest_count` dan Receipt; kedua fitur **OFF jika salah satu** dari flag fitur, backend-ready, dan Owner-approved bukan string `true`.
2. Source Lovable masih commit `4ea0dcf...` yang hanya membuat `src/lib/fitur.ts` dan tes; tidak sama dengan GitHub dan memakai mekanisme env berbeda. **Jangan mengaktifkan sakelar Lovable itu**.
3. Existing frontend Lovable memerlukan `create_reservation` 12 argumen hingga source dipindah. **Jangan jalankan** `20261022000004_revoke_legacy_rpc_execute.sql`: preflight mengharuskan fungsi Training dan reservasi 13 argumen; perubahan akan mencabut akses signature lama sebelum caller aktual terverifikasi.
4. Migrasi Training/Finance dan Receipt memiliki dependensi fungsi/tabel. Wajib audit urutan, hak eksekusi `PUBLIC/anon/authenticated`, dan kompatibilitas sesi kas/operator aktual pada database terisolasi sebelum Cloud write.
5. Harga/snapshot historis harus dipertahankan; jangan melakukan UPDATE terhadap transaksi lampau.

## Checklist sebelum usulan Cloud write (persetujuan Owner terpisah)
- Cocokkan urutan dan checksums migrasi GitHub `main` dengan schema target read-only, terutama Extra Guest, Receipt, Training, Finance; identifikasi dependensi eksplisit, jangan asumsikan semua migrasi repo perlu dijalankan.
- Siapkan SQL preflight SELECT-only tentang definisi/proprivilege RPC caller, RLS tabel baru dan status snapshot. Hindari membaca isi data tamu yang tidak perlu.
- Simulasikan migrasi pada PostgreSQL **terisolasi** dengan fixture yang relevan; pastikan old 10/12-arg `create_reservation` masih dipakai dengan sukses saat flags OFF, dan 13-arg hanya aktif setelah persetujuan.
- Verifikasi tidak ada PUBLIC/anon EXECUTE atas fungsi sensitif, dan akses authenticated mensyaratkan pemeriksaan peran/operator di body RPC.
- Review diff source GitHub vs Lovable untuk desain ketika fitur ON, lalu rencanakan mekanisme sinkronisasi non-publish.
- Gate persetujuan Owner khusus untuk setiap batch Cloud, dengan rollback dan postcheck; jangan revoke RPC legacy hingga seluruh pemanggil kompatibel.

**Status: AUDIT SKEMA READ-ONLY SELESAI / MIGRATION READINESS NO-GO.** Tidak ada mutasi Cloud.
