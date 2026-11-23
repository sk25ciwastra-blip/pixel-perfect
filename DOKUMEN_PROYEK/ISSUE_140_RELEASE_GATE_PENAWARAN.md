# Release gate Issue #140 · Penawaran Baturaden 25 Homestay

Basis implementasi `cb70f96` memuat PR #136/#137 untuk harga/jadwal/DP/WhatsApp dan PR #139 untuk notifikasi. Keputusan Owner ada di [Issue #140](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/140). Checkpoint akses No7I dan transisi DEMO/LIVE tetap berlaku. Patch berada dalam PR draft, dengan penyempurnaan visual di Lovable sebagai tahap terpisah.

## Data dan keamanan

- Aksi Cepat membuka formulir bersama Booking dan Check-in. Penawaran memakai dua tamu dan data harga resmi yang sama. Simpan menuliskan penawaran dan identitas tamu secara atomik, lalu membuka draf WhatsApp. Operator menandai pengiriman secara eksplisit. Jika tab diblokir, kartu antrean menyimpan akses draf dan salin pesan.
- RPC memvalidasi pengguna aktif dengan guard penawaran PR #136. Akses tabel langsung ditutup dan RLS aktif pada kedua tabel baru. Antrean berisi nama dan empat digit WA. Nomor lengkap serta alamat hanya tersedia di detail kartu aktif. Riwayat per tamu menyimpan hasil terminal dan referensi Booking resmi bila ada. Event lifecycle bersifat append-only melalui trigger.
- Nomor 08, 62, dan +62 berbagi satu identitas. Unique index mencegah duplikasi akibat dua sesi. Tamu lama tetap memakai data yang tersimpan. Data input untuk membandingkan retry disimpan sebagai sidik SHA-256, tanpa menyalin alamat/nama ke audit. Jumlah kunjungan tetap berasal dari Check-in atau Check-out.
- Penawaran memesan **nol** kapasitas. Booking/Check-in resmi yang bertabrakan mengubah penawaran aktif menjadi `FAILED_UNAVAILABLE` dalam transaksi yang sama. Irisan menggunakan batas ketat sehingga slot bersebelahan lolos. Read dan konfirmasi memeriksa ulang status kamar, jadwal lama, dan masa inap yang belum jelas akhir aktualnya. Kegagalan terminal tetap tercatat. Check-in penawaran yang sudah lewat menjadi `EXPIRED_SCHEDULE` terpisah dari bentrok. Tidak ada TTL 24 jam atau alur kamar pengganti.
- Konversi mengunci kamar sebelum baris penawaran, memvalidasi syarat harga, DP, waktu, identitas, pembayaran terverifikasi manual, serta metode dan sesi. Fungsi memanggil `create_reservation` resmi dan menautkan referensi transaksi dalam satu commit. Satu penawaran memakai satu ID idempotensi resmi yang disimpan terpisah dari ID antrean. Terapkan konversi dengan satu metode pembayaran yang benar-benar diterima. Training dapat menyiapkan penawaran sesuai role, tetapi konversi keuangan lewat antrean diblokir sampai alur Training untuk penawaran diotorisasi. Booking langsung/Training yang sudah ada tetap berjalan lewat guard semula.
- Trigger transaksi berjalan untuk penulisan Booking/Check-in resmi. Batas kegagalan mencakup jadwal yang tidak lengkap, kamar nonaktif, atau okupansi aktif yang tidak dapat dipastikan. Rekonsiliasi saat baca hanya dapat menutup penawaran, tanpa menyentuh tabel keuangan. Penguncian `SKIP LOCKED` pada rekonsiliasi menghindari menunggu penulisan penawaran yang sedang dikonversi. Aktivitas dari sesi lain diperbarui lewat subscription dan polling cadangan.

## Preflight untuk pemasangan terpisah

Owner harus menyetujui target staging yang terisolasi. Jangan jalankan SQL atau membuat fixture pada LIVE. Cocokkan definisi fungsi aktual dan baris finansial melalui inspeksi baca saja yang disetujui. Jalankan cek duplikasi berikut, yang mengeluarkan jumlah **tanpa nomor WA**. Jumlah harus nol. Bila ada duplikat, selesaikan melalui keputusan Owner terpisah sebelum pemasangan. Migrasi tidak menggabungkan atau menghapus data. Identitas dengan nomor legacy berseparator memakai lookup kanonis. Nomor yang tidak menghasilkan nomor WA Indonesia valid perlu diperiksa melalui alur edit resmi.

```sql
with digits as (
  select regexp_replace(phone, '[^0-9]', '', 'g') as phone from public.guests
), canonical as (
  select case when phone ~ '^0' then '62' || substr(phone, 2) else phone end as phone
  from digits
)
select count(*) as canonical_duplicate_groups
from (
  select phone from canonical where phone ~ '^62[1-9][0-9]{7,12}$'
  group by phone having count(*) > 1
) collisions;

select
  to_regprocedure('booking_quote_private.require_operator()') as quote_role_guard,
  to_regprocedure('public.get_booking_quote_minimum_dp()') as quote_dp,
  to_regprocedure('public.check_booking_quote_schedule(uuid,uuid,timestamp with time zone)') as quote_schedule,
  to_regprocedure('public.finance_training_is_restricted(uuid)') as training_guard,
  to_regprocedure('public.finance_is_booking_operator(uuid)') as booking_guard,
  to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamp with time zone,uuid,uuid,integer)') as booking_with_guest_count,
  to_regprocedure('public.create_reservation(text,uuid,uuid,text,text,text,numeric,text,text,timestamp with time zone,uuid,uuid)') as booking_legacy,
  to_regclass('public.reservation_offers') as existing_offer_table;
```

Verifikasi salah satu ABI Booking tersedia, mengembalikan nomor resmi, memakai `auth.uid()`, mengunci baris kamar, dan menjaga sesi/pembayaran. Bila kedua ABI tersedia, wrapper memilih ABI yang menerima jumlah tamu dan mengirim dua secara eksplisit. Periksa definisi status dan interval terbaru, trigger Booking/Check-in/reschedule, kebijakan tamu, permission pemilik fungsi terhadap tabel, dan kapasitas lock untuk pembuatan index `guests`. Skema `booking_quote_private` dan `reservation_offer_private` harus tetap di luar skema yang diekspos Data API.

## Urutan dan postcheck

1. Setelah persetujuan, uji migrasi quote-read #136 sebagai prasyarat bila belum terpasang pada target yang disetujui. Uji migrasi `supabase/pending/20261123101906_issue_140_offer_queue.sql` pada staging terisolasi, kemudian build aplikasi yang tepat.
2. Verifikasi pemberian EXECUTE, RLS/no direct writes, fungsi status, trigger dan unique index pada katalog. Gunakan fixture staging terisolasi bila pengujian mutasi disetujui terpisah. Catat commit, project ref dan hasil, tanpa menyertakan identitas/nomor WA. Profil staff nyata dan bukti visual browser masih menunggu persetujuan terpisah.
3. Owner menentukan keputusan merge dan publish setelah review. Tidak ada izin LIVE dari issue/PR draft ini.
4. Rollback aplikasi dengan menerbitkan commit sebelumnya. Jika perlu menghentikan akses, cabut EXECUTE pada RPC publik dan implementasi private untuk create/read/search/transition, dalam satu transaksi. Pertahankan data/audit dan trigger yang menjaga penawaran bersaing. Lepas trigger invalidasi atau index canonical hanya setelah penilaian terpisah atas dampak Booking/identitas. Tidak ada DROP data pada rollback standar.


## Checkpoint preflight staging — 23 November 2026 WIB (read-only)

Target **Baturaden-25-Staging**, ref `bgtztcfbkcrvcipxbfti`; bukan Lovable Cloud LIVE.
Pemeriksaan menggunakan query `SELECT` saja. Tidak ada migrasi, fixture, perubahan data, atau aktivasi fitur.

| Syarat | Hasil staging |
| --- | --- |
| Versi server | PostgreSQL 17 |
| Jumlah baris guests | 0 (tabel kosong; tidak membuktikan keamanan LIVE) |
| Duplikasi WA kanonis 08/62/+62 | 0 grup, **vacuous karena guests = 0** |
| `booking_quote_private.require_operator()` | **BELUM ADA** |
| `get_booking_quote_minimum_dp()` | **BELUM ADA** |
| `check_booking_quote_schedule(uuid,uuid,timestamptz)` | **BELUM ADA** |
| `finance_training_is_restricted(uuid)` | **BELUM ADA** |
| `finance_is_booking_operator(uuid)` | Ada |
| `create_reservation(...,uuid,uuid)` / 12-arg | Ada |
| `create_reservation(...,uuid,uuid,integer)` / 13-arg | Belum ada |
| `reservation_offers` | Belum ada (wajar sebelum migrasi) |

**Gate belum terpenuhi: HOLD.** PR #141 tidak boleh langsung menjalankan migrasi di staging;
identifikasi dan verifikasi seluruh prasyarat sebelum mengusulkan pemasangan terurut.
Definisi aktual fungsi Booking 12-arg staging sudah dibaca: ia mencari tamu dengan
`WHERE phone = _phone` (perbandingan literal), baru membuat `guests` baru.
Sementara migrasi penawaran membuat indeks unik berbasis canonical WA. Kedua
pendekatan berpotensi bentrok pada **jalur Booking/Check-in biasa yang memakai 08
vs 62/+62**, bukan hanya pada konversi penawaran. Sebelum aktivasi, Codex harus
memberikan patch kompatibilitas yang mempertahankan identitas tamu lama,
hak akses, idempotensi, dan perilaku transaksi. Jangan menggabung atau
menormalisasi ulang data historis tanpa keputusan Owner.

### Tindak lanjut Codex

1. Cocokkan **migration #136 quote-read** dan fungsi Training resmi yang masih
   absen pada staging; buat matriks dependensi dan urutan deploy *pending* saja.
2. Periksa dan perbaiki kompatibilitas `create_reservation` untuk
   `08xxxxxxxx`, `62xxxxxxxx`, dan `+62xxxxxxxx` bersama indeks kanonis;
   audit juga fungsi direct Check-in dan update tamu supaya tidak gagal ketika
   pengguna memasukkan format alternatif. Jangan melemahkan uniqueness.
3. Tambah tes terfokus untuk tamu lama dalam ketiga format, tidak membuat
   duplikasi, tidak kehilangan data dan tidak menciptakan transaksi parsial;
   sertakan guard role, minimal DP, idempotensi, bentrok jadwal, serta
   rollback jalur resmi.
4. Validasi ABI, lock order, dan permission menggunakan definisi staging
   saat ini; perbarui checklist role dan `pre/postcheck`, tanpa mengeksekusi
   migrasi atau menambah fixture di Cloud.
5. Kirim commit koreksi pada **PR #141 yang sama**. Pertahankan DRAFT/HOLD sampai
   Owner menyetujui preflight dan urutan migrasi; tidak ada pengulangan suite
   lama yang sudah PASS. Pemeriksaan LIVE memerlukan preflight non-PII
   tersendiri; hasil staging tidak boleh digeneralisasikan menjadi PASS LIVE.

## Addendum kompatibilitas setelah checkpoint 76ed06e

Pemeriksaan lanjutan menggunakan katalog staging dan definisi fungsi saja. Penulis tamu untuk reservasi yang terdeteksi di staging hanya `create_reservation` 12 argumen, pemilik `postgres`, SECURITY DEFINER, EXECUTE untuk `authenticated` dan tanpa anon. Fungsi mengunci baris idempotensi sebelum mengunci kamar, mempertahankan `auth.uid()`, lalu membuat transaksi dan pembayaran dalam satu panggilan. Trigger `finance_prepare_payment_trigger` memvalidasi sesi OPEN, mengunci sesi, dan menjaga kepemilikan atau delegasi Supervisor/Owner. `payments_transaction_state_guard_trigger` juga hadir. Kolom snapshot harga/DP tersedia. Check-in dari Booking memakai transaksi yang sama; penulis tamu untuk Check-in langsung adalah cabang `check_in` pada `create_reservation`. `create_reservation_combined` dan kedua wrapper Training belum terpasang di staging.

Authenticated memiliki grant SELECT dengan RLS untuk `guests`, `rooms`, `room_types`, `packages`, `package_room_type_prices` dan `finance_settings`; anon tidak memiliki grant SELECT pada keenam tabel. Policy tamu mengizinkan cakupan baca yang sudah ada, termasuk Inspector, dan policy pengaturan keuangan tetap Owner-only. Kedua skema private tidak boleh terekspos di Data API. Fungsi penawaran dimiliki role migrasi yang dapat menjalankan helper resmi. Penyimpan definisi asli dan helper lookup tamu tidak memberikan EXECUTE atau SELECT tambahan kepada klien. Grant baca-saja anon lama pada helper kalender/perhitungan paket dicatat sebagai perbedaan baseline staging; patch ini tidak memperluas grant tersebut.

Patch pending #140 mengganti hanya blok SELECT/INSERT tamu yang pola dan ABI-nya telah ditinjau. Seluruh definisi resmi direkonstruksi dari katalog dengan `CREATE OR REPLACE`, mempertahankan owner, hak EXECUTE, default argumen, fingerprint, guard, dan transaksi. Single 12 argumen dan combined dari repositori diuji lokal. ABI 13 argumen diterima hanya bila blok yang sama cocok; bila berbeda, migrasi batal. Wrapper Training yang sudah terpasang harus mendelegasikan ke writer resmi yang sesuai. Satu helper memakai nomor 08/62/+62 yang sama di Booking, Check-in langsung, combined, dan penawaran. Konversi menerima nomor historis berseparator tanpa mengubah baris tamu. Edit eksplisit pada tamu yang sama tetap boleh mengganti format; konflik lintas identitas tetap ditolak. Konversi memakai key resmi acak tersendiri yang hanya ada di tabel private-by-grant, sehingga kode penawaran yang terlihat klien tidak dapat dipakai sebagai key resmi untuk mengambil lock idempotensi di jalur langsung.

### Urutan staging yang harus direview Owner

1. Identifikasi target ref `bgtztcfbkcrvcipxbfti`. Simpan snapshot definisi dan ACL aktual RPC, trigger, serta kebijakan Training dan Booking, dan cocokkan hash/versi sebelum perubahan. Ledger staging berisi 10 versi bertanggal 2026-10-19 dengan ID yang berbeda dari repo. Gunakan definisi dan kontrak katalog untuk rekonsiliasi, tanpa menjalankan push seluruh riwayat migrasi. Hitung duplikasi WA dan jumlah tamu tanpa PII. Angka 0 pada tabel staging kosong tidak berlaku untuk LIVE.
2. Jadikan migration **`supabase/migrations/20261018000000_finance_training_enforcement.sql`** baseline Training resmi yang ditinjau. Staging tidak memiliki dua tabel Training maupun fungsi guard. Tabel finance yang dirujuk untuk sesi, settings, komisi, bank, alokasi, handoff, charge, refund, expenses, dan deposits ada. RPC yang dipanggil untuk Check-in Booking, checkout, payment, expense, deposit dan summary ada. Tinjau kontrak kolom, trigger dan ACL dengan diff, terutama definisi `finance_prepare_payment` dan `finance_is_booking_operator` yang diganti migration tersebut. Lakukan replay seluruh baseline Training pada clone terisolasi setelah persetujuan terpisah. Cek dampak terhadap sesi, pembayaran dan policy sebelum pemasangan staging. Tidak ada guard tiruan. Review ACL Training yang dipersiapkan di `supabase/pending/20261122000004_training_internal_rpc_anon_acl_review.sql` terhadap hash yang diharapkan sebelum mempertimbangkan penerapannya. Jangan jalankan patch berbasis hash jika baseline berbeda.
3. Jika target **sudah memerlukan** combined sesuai konfigurasi yang disetujui, verifikasi prasyarat kolom jumlah tamu dan install baseline resmi yang relevan sebelum #140, termasuk `supabase/migrations/20261104000000_atomic_combined_payments.sql`. Staging yang diperiksa belum memiliki batch idempotency atau kolom jumlah tamu. Untuk baseline single 12 argumen ini, pertahankan combined dalam keadaan semula. Jika dipasang pada tahap lain, review dan patch writer baru sebelum mengaktifkannya.
4. Setelah baseline Training tervalidasi, pasang **`supabase/pending/20261123084929_booking_quote_read_guards.sql`** dari #136. Verifikasi helper Auth dan posisi aktif, akses pemilik ke settings/jadwal, READ/EXECUTE proyeksi DP serta jadwal untuk peran operasional, dan penolakan anon. Pemasangan #140 menolak prasyarat yang masih absen sebelum membuat objek.
5. Dalam jendela pemasangan yang disetujui Owner, terapkan **`supabase/pending/20261123101906_issue_140_offer_queue.sql`**. Patch writer, unique index canonical dan tabel/trigger/RPC dipasang dalam satu transaksi. Jalankan postcheck katalog di bawah, lalu postcheck fixture pada clone/staging hanya bila mutasinya diotorisasi. Baru pertimbangkan rilis aplikasi. LIVE memerlukan preflight terpisah, termasuk perbandingan ABI 13 argumen bila ada dan collision count pada data nyata tanpa menampilkan nomor.
6. Jika #140 dibatalkan sebelum pemasangan, tahan rilis aplikasi. Untuk backout sesudah instalasi, hentikan trafik tulis terkait pada jendela yang disetujui, terbitkan versi aplikasi sebelumnya, lalu gunakan **`supabase/rollback/20261123_issue_140_booking_phone.sql`**. Backout atomik menutup RPC #140, mengembalikan definisi writer yang tepat, menonaktifkan trigger invalidasi dan melepas constraint index canonical agar writer literal tetap kompatibel. Tabel tamu, penawaran dan audit dipertahankan. Rollback berhenti bila definisi writer sudah berubah setelah patch. Baseline Training dan #136 adalah tahap tersendiri; rollback tahap tersebut hanya lewat backup/diff dan keputusan Owner terpisah.

### Postcheck katalog #140

```sql
select signature,
  sha256(convert_to(pg_get_functiondef(to_regprocedure(signature)), 'UTF8')) = patched_sha256 as definition_ok
from reservation_offer_private.booking_originals order by signature;

select
  to_regclass('public.guests_offer_canonical_wa_idx') as canonical_index,
  has_function_privilege('authenticated','reservation_offer_private.resolve_guest(text,text,text)','EXECUTE') as client_resolver,
  has_function_privilege('anon','public.create_reservation_offer(uuid,text,text,text,uuid,uuid,timestamp with time zone)','EXECUTE') as anon_offer,
  has_table_privilege('authenticated','public.reservation_offers','SELECT,INSERT,UPDATE,DELETE') as client_offer_table,
  has_function_privilege('authenticated','public.read_reservation_offers(uuid,uuid,integer)','EXECUTE') as staff_rpc;
```

Pastikan index ada dan semua definisi cocok. Tiga nilai akses langsung harus `false`; grant RPC staf harus `true` dan body tetap menolak role yang tidak berhak. Verifikasi kasus lintas format dan rollback modul pada fixture terisolasi, bukan dengan data tamu LIVE. Release gate tetap **HOLD**.
## Rehearsal clone PR #141 · BLOCKED sebelum migrasi

Checkpoint yang diperiksa adalah `76ed06e` dan `36e7cce`, dengan persetujuan Owner terbatas pada clone PostgreSQL 17. Baseline yang harus direproduksi adalah Baturaden-25-Staging pada checkpoint tersebut. Pemeriksaan kali ini hanya melihat inventaris lokal dan daftar objek arsip melalui `pg_restore --list`. Arsip tidak dipulihkan dan data tamu/pembayaran tidak dibaca.

| Tahap | Hasil | Bukti atau blocker |
| --- | --- | --- |
| Persiapan dan parity clone | **BLOCKED** | Snapshot schema-only yang cocok dan manifest katalog staging belum tersedia. Arsip lokal 21 Oktober (PG 17.6) memuat Booking 10 argumen. Arsip 20 November (PG 17.6) memuat Training serta Booking 10, 12, dan 13 argumen. Checkpoint staging mencatat Booking 12 argumen dan belum memiliki Training. Metadata staging 15 Oktober mendahului baseline Finance yang dimaksud. |
| Training `20261018000000` | **BLOCKED** | Tidak dijalankan karena parity clone belum terbukti. |
| Quote-read #136 | **BLOCKED** | Tidak dijalankan karena baseline Training pada clone yang cocok belum terverifikasi. |
| Issue #140 | **BLOCKED** | Tidak dijalankan karena kedua prasyarat belum diverifikasi pada clone yang cocok. |
| Postcheck dan fixture | **BLOCKED** | Tidak ada clone target yang telah dimigrasikan. Suite PASS lama tidak diulang. |
| Rollback #140 | **BLOCKED** | Tidak ada instalasi #140 pada clone target yang dapat di-rollback. Rollback Training dan #136 merupakan lingkup terpisah. |

PG 17.6 di atas adalah versi sumber yang tercantum pada arsip. Runtime clone, hash skema dan hash fungsi baseline belum dapat dicatat karena belum ada snapshot yang cocok. Tidak ada tahap yang dilaporkan FAIL karena belum ada migrasi yang dijalankan.

Pemeriksaan lokal minimal yang dilakukan adalah `pg_restore --list <arsip-lokal>` dengan filter nama fungsi Booking dan Training, serta pencarian snapshot schema-only di workspace dan inventaris cadangan lokal. Pekerjaan dapat dilanjutkan setelah tersedia snapshot schema-only tersanitasi dari checkpoint staging yang cocok, beserta manifest peran, owner/ACL, RLS, trigger, dan fungsi Auth/sesi. Restore hanya pada cluster disposable PG17. Bandingkan katalog clone dengan manifest sebelum menjalankan urutan di addendum, lalu catat hash fungsi sebelum dan sesudah serta hasil postcheck. Jika manifest tidak cocok, berhenti sebelum DDL.

**Release gate tetap HOLD.** Staging dan LIVE tidak dihubungi untuk rehearsal ini. Tidak ada restore, SQL Cloud, penulisan data operasional, merge, atau publish.

## Ekspor titik pemeriksaan staging · alat siap, akses BLOCKED

Konektor katalog tidak menyediakan transport `pg_dump`. Sesi kerja tidak mempunyai koneksi PostgreSQL staging yang diotorisasi. Tidak ada ekspor atau DDL staging yang dijalankan. Rehearsal dan semua tahap setelahnya tetap **BLOCKED**.

Diperlukan akses jaringan ke `db.bgtztcfbkcrvcipxbfti.supabase.co:5432` dan role login staging yang disetujui untuk membaca katalog dan mengambil lock ACCESS SHARE yang diperlukan `pg_dump --schema-only`. Gunakan PostgreSQL client 17, TLS verify-full dengan CA tepercaya, serta autentikasi sementara lewat `PGPASSFILE` lokal berizin ketat atau prompt interaktif. Jalankan dari shell terpisah dengan `PGUSER` yang diotorisasi. Jangan menyalin kredensial ke chat, GitHub, argumen URL, atau repositori. Jika jaringan hanya mendukung IPv4/pooler, Owner dapat menyediakan ekspor dari jalur resmi yang terverifikasi untuk ref staging yang sama, tanpa memakai skrip direct-host di bawah.

```powershell
pwsh -NoProfile -File scripts/issue-140-export-staging-schema.ps1 -PgBin '<folder PG17 client>' -OutputDirectory '<folder privat baru di luar repo>'
```

Skrip menetapkan transaksi read-only dan endpoint staging, memeriksa ABI checkpoint sebelum ekspor, lalu menjalankan `pg_dump --schema-only --no-owner --no-privileges`. Manifest katalog dicatat sebelum dan sesudah, dan output ditolak bila berbeda. Hasil yang diharapkan adalah `staging-schema.sql`, `staging-catalog.json`, dan `staging-export.json` berisi hash SHA-256. Generator manifest mencakup owner, ACL, role, membership, RLS, trigger, index, extension, dan hash definisi fungsi termasuk fungsi Auth/sesi. Definisi fungsi berada dalam DDL. Tidak ada pembacaan baris pengguna atau transaksi.

Ekspor lokal berstatus belum ditinjau sampai Owner/operator memastikan tidak ada rahasia tertanam dalam DDL dan metadata. Foreign servers memblokir skrip dan subscription dihilangkan untuk menghindari connection string. Jika sumber memakai subscription yang relevan, catat kontrak tersanitasi dan tahan parity sampai ditinjau. Setting PostgREST efektif harus dikonfirmasi dari konfigurasi resmi staging jika tidak ditemukan dalam katalog, tanpa menyalin rahasia API. Setelah restore PG17 disposable, pulihkan owner/ACL dan role yang diperlukan dari manifest tanpa password, gunakan `scripts/issue-140-staging-manifest.sql` dengan `search_path=pg_catalog` di clone, lalu cocokkan objek, hash, RLS, trigger dan lingkup API sebelum DDL. Jalur Approved tetap Training → #136 → #140 → postcheck → rollback. Release gate **HOLD**.
