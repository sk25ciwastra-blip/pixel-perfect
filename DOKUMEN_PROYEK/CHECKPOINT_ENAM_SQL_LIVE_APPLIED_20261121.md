# Baturaden 25 Homestay — Checkpoint Aktivasi Enam SQL Lovable LIVE

**Tanggal:** 21 November 2026 WIB  
**Izin Owner:** secara eksplisit mengizinkan enam transaksi terpisah secara berurutan di LIVE, dengan preflight/postcheck dan STOP bila gagal; melarang pembersihan DEMO, merge, deploy, publish, dan perubahan Staging. Owner menerima risiko terbatas bahwa full restore Supabase belum PASS.  
**Status:** **6/6 SQL LIVE DITERAPKAN DAN POSTCHECK PASS**. **Operasional tamu nyata masih NO-GO** hingga verifikasi lanjutan dan keputusan GO Owner terpisah.

## Database sasaran dan pemeriksaan

- Lovable project ID: `017f6e78-15f2-4d07-a38c-87cb185279bf`.
- Database `postgres`, PostgreSQL **17.6** (server_version_num 170006).
- Koneksi resmi: Lovable `query_database`; **tidak ada koneksi ke Supabase Staging**.
- Sumber SQL adalah versi yang diambil langsung dari GitHub, bukan teks hasil salinan manual. Setiap berkas memiliki `BEGIN; ... COMMIT;` sendiri dan dieksekusi dalam pemanggilan terpisah.
- Tidak ada perubahan pada source GitHub `main`, deploy, publish, atau merge selama aktivasi.
- Tiap tahap memeriksa metadata LIVE sebelum menjalankan SQL, lalu membaca ulang perubahan setelahnya.

## Hasil transaksi terpisah

| # | Paket | Blob SHA sumber GitHub | Preflight | Bukti postcheck |
|---|---|---|---|---|
| 1 | Booking fixed-slot, `supabase/pending/20261113145045_booking_fixed_slot_boundary.sql` | `461ccb3262e947dac4e4bf07174ba5f0aa703d37` | `check_in_booking(uuid)` MD5 `7aaf581931c92b9d37747ca718943f58`, dependensi tersedia | PASS. Hash baru `fb29b1e4d72c71f5895ef8a1a1767387`. Isi fungsi dibandingkan dengan kandidat dan sama setelah trim. |
| 2 | Overtime / hunian ganda, `supabase/pending/20261113150233_overtime_walkin_guard.sql` | `cc6f8fbc7ac0a7f294bbcaa05bdd07be58222120` | Tidak ada hunian ganda; index, tabel audit, override function, trigger belum ada | PASS. Index `room_single_active_checkin` UNIQUE, trigger aktif, fungsi Owner override dan guard tersedia; tabel audit dengan RLS, anon/authenticated TRUNCATE=false. |
| 3 | Housekeeping retry, `supabase/pending/20261117081000_housekeeping_retry_after_room_lock.sql` | `bcf2defd31e6704b7452b1d33082f95b217a7e53` | MD5 `2756ae72d61632458a5688b037526d75` + SECURITY DEFINER/search_path sesuai | PASS. MD5 `8c9dbcabf70646f89c047291cd81c0f2`; definer/search_path tetap sesuai. |
| 4 | Payment & Closing, `supabase/pending/20261117100000_payment_retry_closing_identity.sql` | `8a4ef8860080bc7da8a6c0cf5a3c302505cfb485` | Payment `e39b532635f0aa14a30992c6a87b3de9`; Closing `2e6b21c915118dbf490796b0ecd86868` | PASS. Payment MD5 `e9e88c3e70c76450ecc89744adc78471`; Closing MD5 `e994975f0e77a0c692ba3d89e5772538`. |
| 5 | Refund retry, `supabase/pending/20261117104000_refund_retry_payload_guard.sql` | `62babbbc03ad7840648592a0a18b3a66c14ec64e` | MD5 `695152a80fcd4e561759f34b27652c5a` | PASS. MD5 `80bcdeabfc038907ee6dcea4d9d0e714`; jumlah refund & alokasi tetap 0. |
| 6 | Table TRUNCATE ACL 33, `scripts/acl/revoke_33_review_only.sql` (review branch) | `cd7f44114b7942728f130578e215c96ef5d43117` | 40 tabel public, 33 target; target MD5 `b992406a39a1ca0142e56b017e45809b`, default MD5 `bed16621c84278837e08965943391d9b` | PASS. 0 tabel memberi TRUNCATE efektif ke anon/authenticated; default privilege MD5 tetap `bed16621c84278837e08965943391d9b`; fingerprint *seluruh grant selain dua TRUNCATE itu* tetap `ad0d8635cbccfe44bcdc3da6debae1dd`. |

### Verifikasi gabungan sesudah keenam transaksi

- `public`: **40** tabel, **40** RLS enabled, **58** policies, **99** fungsi.
- **0/40** tabel memberi privilege TRUNCATE efektif ke role `anon`/`authenticated`.
- Trigger `room_overtime_checkin_guard`: **1**; indeks unik anti-hunian-ganda terpasang; 0 kamar dengan dua `check_in` aktif.
- Data operasional DEMO **tidak disentuh**: 17 transaksi, 24 payments, 2 sesi kas OPEN, 4 kamar occupied, 0 refunds.
- Fungsi baru tetap tersedia, dan pembatasan `EXECUTE` untuk `anon` pada Booking, Payment, Closing, Refund, dan dua fungsi overtime tidak terbuka.

### Catatan keamanan yang belum selesai

- `complete_housekeeping_checklist(...)` saat ini **memiliki GRANT EXECUTE untuk anon** dan bersifat `SECURITY DEFINER`. Source diawali cek `IF NOT public.can_housekeeping(auth.uid()) THEN RAISE EXCEPTION 'Akses ditolak'; END IF;`, sehingga secara kode ada pemeriksaan identitas sebelum akses data. **Uji pemanggilan dengan role anon belum dilakukan**; perubahan REVOKE EXECUTE pada fungsi ini **tidak termasuk** dalam enam SQL yang disetujui dan karenanya tidak dilakukan.
- **Default privileges** untuk tabel baru masih sama dan berisiko; pakailah REVOKE TRUNCATE dalam transaksi pembuatan tabel baru, dan lakukan review tersendiri sebelum mengubah default ACL.
- SQL telah dieksekusi langsung, bukan melalui migrasi Supabase yang merekam version history. **Jangan jalankan ulang** file `pending` tanpa rekonsiliasi. Simpan checkpoint ini sebagai bukti pemasangan di LIVE.
- Backup ZIP privat telah lolos integritas, tetapi **full restore Supabase**, Auth, Storage, permissions recovery, RLS role test, dan alur transaksi staf belum PASS. Jangan menyatakan kesiapan GO atas dasar 6 instalasi SQL ini.
- Perlu pengujian alur **Booking → Check-in → Payment → Check-out → Housekeeping → READY**, komisi/refund, closing minus, race/duplikasi, dan struk 58 mm pada konfigurasi final.
- Pembersihan DEMO **tidak dilakukan** dan butuh persetujuan Owner terpisah. Tidak ada transaksi tamu nyata yang diizinkan oleh checkpoint ini.

**Keputusan checkpoint:** Pengamanan database LIVE **6/6 PASS pemasangan**. **Status operasional sementara tetap NO-GO**, pending verifikasi data/operasional/Owner GO.
