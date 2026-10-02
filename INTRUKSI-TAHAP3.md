# ATURAN BACKEND & FORM POPUP TRANSAKSI - BATURADEN 25 HOMESTAY

Tolong selesaikan pembuatan Form Modal/Popup saat tombol "+ Buat Booking Baru" dan "+ Check-in Langsung" diklik:

1. FUNGSI FORM POPUP:
   - Hubungkan input pilihan paket (2/4/6/12/24 Jam) agar membaca data otomatis dari tabel `packages`.
   - Hubungkan nominal DP / Pelunasan agar masuk ke skema log tabel `payments` dengan relasi `transaction_id`.
   - Tambahkan fungsi otomatis agar ketika Form Check-in disimpan, status kamar (room_status) langsung berubah menjadi 'occupied' (TERISI) dan memicu fungsi SQL Sequence nomor transaksi `BTRD25-XXXXXX`.

2. SINKRONISASI SERVER:
   - Selesaikan penulisan fungsi handler di backend (`src/lib/data-live.ts` atau sejenisnya) agar Lovable Cloud bisa mengompilasi aksi form tersebut dengan lancar tanpa error type data.
