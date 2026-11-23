# Release gate PR #136 · Penawaran Booking

Migrasi `supabase/pending/20261123084929_booking_quote_read_guards.sql` menambah dua RPC baca saja. `get_booking_quote_minimum_dp()` mengembalikan mode dan nilai DP saja. `check_booking_quote_schedule(uuid,uuid,timestamptz)` mengembalikan jadwal resmi dan indikator bentrok, tanpa identitas tamu, nominal pembayaran, atau ID transaksi. Keduanya memakai identitas sesi dan mengizinkan Owner atau karyawan aktif berposisi Receptionist/Supervisor. RLS `finance_settings` dan hak simpan Booking tetap mengikuti aturan yang sudah ada.

## Parity jadwal

`create_reservation` dan `create_reservation_combined` dalam repositori memeriksa Booking terjadwal dengan irisan ketat `mulai_lama < selesai_baru AND selesai_lama > mulai_baru`. Slot yang bersebelahan tidak bentrok. Guard Check-in juga mempertimbangkan transaksi `check_in` dengan interval aktual `started_at`–`ends_at`. Penawaran memakai irisan yang sama untuk kedua jenis. Untuk menghindari penawaran yang menyesatkan, penawaran diblokir bila jadwal aktif tidak lengkap, masa tinggal sudah melewati checkout dan masih berstatus `check_in`, atau kamar berstatus occupied tanpa catatan Check-in aktif. Kamar nonaktif ditolak. Checkout selesai tidak dihitung sebagai konflik. Pemeriksaan hanya membaca kondisi pada saat preview dan Booking resmi tetap memvalidasi ulang saat simpan.

## Preflight Cloud sebelum persetujuan pemasangan

Jalankan kueri berikut di target yang telah dicocokkan jika Owner mengotorisasi pemeriksaan Cloud. Gunakan akses baca saja. Dua kolom RPC baru dan skema baru harus kosong sebelum pemasangan pertama. Empat dependensi lain harus terisi.

```sql
select
  to_regclass('public.finance_settings') as finance_settings,
  to_regclass('public.rooms') as rooms,
  to_regclass('public.transactions') as transactions,
  to_regprocedure('public.calculate_scheduled_booking_times(uuid,timestamp with time zone)') as schedule_engine,
  to_regprocedure('public.get_booking_quote_minimum_dp()') as new_dp_rpc,
  to_regprocedure('public.check_booking_quote_schedule(uuid,uuid,timestamp with time zone)') as new_schedule_rpc,
  to_regnamespace('booking_quote_private') as new_private_schema;

select id, minimum_dp_mode, minimum_dp_value from public.finance_settings limit 0;
select id, banned_until from auth.users limit 0;
select id, active, status from public.rooms limit 0;
select room_id, status, scheduled_check_in, scheduled_check_out, started_at, ends_at
from public.transactions limit 0;

select policyname, roles, qual from pg_policies
where schemaname = 'public' and tablename = 'finance_settings';

select p.oid::regprocedure, pg_get_functiondef(p.oid)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('has_employee_position', 'create_reservation', 'create_reservation_combined', 'check_in_booking');
```

Pastikan helper posisi memerlukan role employee dan baris employee aktif, serta tinjau definisi Booking Cloud terhadap parity di atas. RPC juga menolak akun yang masih diblokir di Auth, termasuk saat token lama masih berlaku. Jika perilaku Cloud berbeda, hentikan pemasangan sampai perbedaannya ditinjau. Pastikan `booking_quote_private` tidak diekspos oleh Data API. Fungsi publik adalah invoker. Pembacaan terprivilege terbatas di skema private dengan `search_path` kosong dan semua relasi dikualifikasi.

## Urutan setelah persetujuan Owner

1. Pastikan PR tetap draft sampai hasil fokus dan preflight dinilai. Terapkan hanya migrasi pending ini dalam satu transaksi **sebelum** menerbitkan aplikasi yang membutuhkannya.
2. Verifikasi bahwa authenticated dapat memanggil dua RPC; anon tidak dapat. Dengan akun yang sudah ada, pastikan Owner, Receptionist aktif, dan Supervisor aktif memperoleh DP mode/nilai dan hasil bentrok. Pastikan Housekeeping dan karyawan nonaktif ditolak, serta Receptionist/Supervisor tetap tidak dapat membaca baris penuh `finance_settings`. Gunakan pemeriksaan baca saja, tanpa menyimpan Booking, mengirim WhatsApp, atau membuat transaksi uji.
3. Tinjau merge/publish secara terpisah. Jika perlu rollback, terbitkan versi aplikasi sebelumnya dan cabut EXECUTE authenticated dari kedua RPC publik serta dua fungsi terkait di `booking_quote_private`. Tidak diperlukan penghapusan data.

Tes terisolasi dapat diulang dengan perintah di deskripsi PR. Skrip PostgreSQL menjalankan proyeksi dan guard dalam transaksi read-only di cluster sementara setelah mengisi fixture lokal.
