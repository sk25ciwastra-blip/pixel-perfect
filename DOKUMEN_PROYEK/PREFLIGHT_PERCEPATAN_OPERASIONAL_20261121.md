# Baturaden 25 Homestay — Percepatan Operasional Sabtu (preflight read-only)
Tanggal 21 November 2026, WIB. **Belum ada izin perubahan LIVE; status aktivasi NO-GO.**

## Hasil pembacaan langsung Lovable LIVE (read-only)
- Project Lovable ID: `017f6e78-15f2-4d07-a38c-87cb185279bf`.
- Database PostgreSQL 17.6, 39 tabel public, 39 RLS aktif, 97 fungsi public, 57 policies.
- TRUNCATE untuk anon/authenticated: 33 tabel; target ACL MD5 `b992406a39a1ca0142e56b017e45809b`.
- Default privileges MD5 `bed16621c84278837e08965943391d9b`.
- 17 transaksi DEMO: 6 booking, 4 check_in, 7 check_out.
- 12 kamar: 7 ready, 4 occupied, 1 dirty; 0 kamar dengan dua transaksi check_in aktif.
- 5 sesi kas: 3 FINAL, 2 OPEN.
- Belum ada `public.room_overtime_owner_releases` maupun index `public.room_single_active_checkin` (sesuai kondisi sebelum SQL overtime).
- `calculate_package_stay_times(uuid,timestamptz)` dan `finance_is_booking_operator(uuid)` tersedia.
- GitHub `main` dan Lovable commit terakhir sama: `e319d40d4089461ae20694eb06f66a588e3dac46`.

## Lima paket pengamanan (ada di GitHub main, belum dipasang di LIVE)
| Urutan | Berkas | Bukti preflight function source pada LIVE |
|---|---|---|
| 1 | `supabase/pending/20261113145045_booking_fixed_slot_boundary.sql` | `check_in_booking(uuid)` tersedia, dependensi tersedia |
| 2 | `supabase/pending/20261113150233_overtime_walkin_guard.sql` | Tidak ada hunian ganda, index & audit table belum ada |
| 3 | `supabase/pending/20261117081000_housekeeping_retry_after_room_lock.sql` | `complete_housekeeping_checklist(...)` MD5 `2756ae72d61632458a5688b037526d75` cocok guard |
| 4 | `supabase/pending/20261117100000_payment_retry_closing_identity.sql` | `record_transaction_payment(...)` MD5 `e39b532635f0aa14a30992c6a87b3de9` dan `close_finance_cash_session(...)` MD5 `2e6b21c915118dbf490796b0ecd86868` cocok guard |
| 5 | `supabase/pending/20261117104000_refund_retry_payload_guard.sql` | `create_finance_refund(...)` MD5 `695152a80fcd4e561759f34b27652c5a` cocok guard |

**Preflight ini hanya metadata/dependensi**; bukan tes penuh bisnis ataupun izin untuk eksekusi.

## Bukti backup privat
- Backup privat ZIP telah diverifikasi ulang di lingkungan Londo tanpa membagikan ke GitHub.
- `pixel-perfect-homestay-hub_261118.backup`, PGDMP, 918.976 byte, SHA256 `ce8801c1c4d65eea04f698df7aa8041ee8efdbcf3f935710ed8a6138f286a8d1`.
- Belum dapat menguji `pg_restore` di lingkungan Londo karena executable PostgreSQL 17 tidak tersedia dan Debian repo DNS gagal. Arsip juga tidak mencakup Storage binaries, Secrets, provider settings; full Supabase restore **belum PASS**.
- Backup hanya berisi snapshot 19 November, bukan keadaan LIVE saat ini. Sebelum perubahan LIVE direkomendasikan backup segar atau verifikasi backup platform yang relevan.

## Urutan kerja cepat jika Owner memberi persetujuan LIVE tersendiri
1. Pastikan kondisi tidak ada transaksi nyata aktif dan backup titik-kembali terkini.
2. Re-query fungsi, SHA/hashes, dependensi, dan hunian ganda tepat sebelum setiap paket.
3. Terapkan lima paket SQL **satu per satu** dengan transaksi internalnya; hanya lanjut bila postcheck aktual PASS. Jika salah satu gagal, STOP; jangan memaksakan atau menimpa hash.
4. ACL 33 tabel adalah **keputusan terpisah**, karena berkaitan dengan surface privileges. Uji dummy ACL dan rollback sudah PASS tetapi belum dijalankan di LIVE.
5. Bersihkan data DEMO dengan prosedur relasi/recovery tersendiri (jangan hapus akun, tarif, paket, kamar, atau konfigurasi), setelah instruksi Owner dan pembuktian cadangan.
6. Uji transaksi end-to-end LIVE terbatas, struk thermal 58mm, Booking→Check-in→Payment→Checkout→HK→Ready, Closing minus, no double room occupancy; lakukan acceptance karyawan dan baru putuskan GO/NO-GO.

## Batas saat ini
**TIDAK ADA SQL di-eksekusi ke LIVE atau Staging pada checkpoint ini.**
**Tidak ada merge, deploy, publish, pembersihan DEMO, atau biaya.**
