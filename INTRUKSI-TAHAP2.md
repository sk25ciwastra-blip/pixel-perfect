# IMPLEMENTASI FORM CHECK-IN & BOOKING - BATURADEN 25 HOMESTAY

Tolong hidupkan fungsi pada halaman `/booking` dan `/transaksi` tanpa merubah tema warna, font, dan layout dasar aplikasi.

1. HALAMAN BOOKING:
   - Tambahkan satu tombol bergaya modern bertuliskan "+ Buat Booking Baru".
   - Jika diklik, munculkan Form/Modal Input: Nama Tamu, Nomor WA (dengan validasi pencarian data lama untuk mencegah duplikasi), Pilih Kamar (dropdown kamar READY), Pilih Paket Demo (2/4/6/12/24 Jam), Nominal DP, dan Metode Pembayaran (Cash/QRIS/Transfer).
   - Simpan status awal sebagai '🟡 BOOKING'.

2. HALAMAN TRANSAKSI:
   - Tambahkan satu tombol bertuliskan "+ Check-in Langsung".
   - Jika diklik, buat Form/Modal yang mirip, namun langsung mengubah status kamar menjadi 'TERISI' (OCCUPIED) dan memicu countdown waktu otomatis berdasarkan menit paket yang dipilih.
   - Gunakan format penomoran otomatis unik dari backend: `BTRD25-000001`, `BTRD25-000002`, dst.

3. KONEKSI DATA:
   - Hubungkan form-form tersebut langsung ke skema tabel `transactions` dan `payments` di database yang sudah kita siapkan.
