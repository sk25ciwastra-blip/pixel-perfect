# Release gate Issue #140 · Penawaran Baturaden 25 Homestay

Basis implementasi `cb70f96` memuat PR #136/#137 untuk harga/jadwal/DP/WhatsApp dan PR #139 untuk notifikasi. Keputusan Owner ada di [Issue #140](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/140). Checkpoint akses No7I dan transisi DEMO/LIVE tetap berlaku. Patch berada dalam PR draft, dengan penyempurnaan visual di Lovable sebagai tahap terpisah.

## Data dan keamanan

- Aksi Cepat membuka formulir bersama Booking dan Check-in. Penawaran memakai dua tamu dan data harga resmi yang sama. Simpan menuliskan penawaran dan identitas tamu secara atomik, lalu membuka draf WhatsApp. Operator menandai pengiriman secara eksplisit. Jika tab diblokir, kartu antrean menyimpan akses draf dan salin pesan.
- RPC memvalidasi pengguna aktif dengan guard penawaran PR #136. Akses tabel langsung ditutup dan RLS aktif pada kedua tabel baru. Antrean berisi nama dan empat digit WA. Nomor lengkap serta alamat hanya tersedia di detail kartu aktif. Riwayat per tamu menyimpan hasil terminal dan referensi Booking resmi bila ada. Event lifecycle bersifat append-only melalui trigger.
- Nomor 08, 62, dan +62 berbagi satu identitas. Unique index mencegah duplikasi akibat dua sesi. Tamu lama tetap memakai data yang tersimpan. Data input untuk membandingkan retry disimpan sebagai sidik SHA-256, tanpa menyalin alamat/nama ke audit. Jumlah kunjungan tetap berasal dari Check-in atau Check-out.
- Penawaran memesan **nol** kapasitas. Booking/Check-in resmi yang bertabrakan mengubah penawaran aktif menjadi `FAILED_UNAVAILABLE` dalam transaksi yang sama. Irisan menggunakan batas ketat sehingga slot bersebelahan lolos. Read dan konfirmasi memeriksa ulang status kamar, jadwal lama, dan masa inap yang belum jelas akhir aktualnya. Kegagalan terminal tetap tercatat. Check-in penawaran yang sudah lewat menjadi `EXPIRED_SCHEDULE` terpisah dari bentrok. Tidak ada TTL 24 jam atau alur kamar pengganti.
- Konversi mengunci kamar sebelum baris penawaran, memvalidasi syarat harga, DP, waktu, identitas, pembayaran terverifikasi manual, serta metode dan sesi. Fungsi memanggil `create_reservation` resmi dan menautkan referensi transaksi dalam satu commit. Satu penawaran memakai satu ID idempotensi resmi. Terapkan konversi dengan satu metode pembayaran yang benar-benar diterima. Training dapat menyiapkan penawaran sesuai role, tetapi konversi keuangan lewat antrean diblokir sampai alur Training untuk penawaran diotorisasi. Booking langsung/Training yang sudah ada tetap berjalan lewat guard semula.
- Trigger transaksi berjalan untuk penulisan Booking/Check-in resmi. Batas kegagalan mencakup jadwal yang tidak lengkap, kamar nonaktif, atau okupansi aktif yang tidak dapat dipastikan. Rekonsiliasi saat baca hanya dapat menutup penawaran, tanpa menyentuh tabel keuangan. Penguncian `SKIP LOCKED` pada rekonsiliasi menghindari menunggu penulisan penawaran yang sedang dikonversi. Aktivitas dari sesi lain diperbarui lewat subscription dan polling cadangan.

## Preflight untuk pemasangan terpisah

Owner harus menyetujui target staging yang terisolasi. Jangan jalankan SQL atau membuat fixture pada LIVE. Cocokkan definisi fungsi aktual dan baris finansial melalui inspeksi baca saja yang disetujui. Jalankan cek duplikasi berikut, yang mengeluarkan jumlah **tanpa nomor WA**. Jumlah harus nol. Bila ada duplikat, selesaikan melalui keputusan Owner terpisah sebelum pemasangan. Migrasi tidak menggabungkan atau menghapus data. Inspeksi juga nomor legacy berformat yang tidak cocok dengan validasi `create_reservation`, yang akan ditolak saat konversi sampai identitas dikoreksi melalui edit resmi.

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
