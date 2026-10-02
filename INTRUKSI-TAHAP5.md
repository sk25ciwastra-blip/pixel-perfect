# ATURAN PAKET BERDASARKAN JAM OPERASIONAL & PERBAIKAN DASHBOARD TIMER

Tolong perbarui skema tabel packages dan frontend form "+ Tambah Paket" serta logika check-in:

1. KETENTUAN DATA MASTER (DATABASE):
   - Tambahkan dua field opsional baru pada tabel `packages`: `start_time` (format TIME, contoh: 08:30) dan `end_time` (format TIME, contoh: 16:00).
   - Jika `start_time` dan `end_time` diisi oleh Owner, paket tersebut hanya boleh dipilih atau berlaku di jam operasional tersebut. Jika kosong, berarti paket durasi bebas (fleksibel).

2. TAMPILAN UI FORM POPUP "+ TAMBAH PAKET":
   - Tambahkan dua kolom input baru di bawah form "Durasi (menit)" yaitu: "Jam Mulai (Opsional)" dan "Jam Selesai (Opsional)" dengan format Time Picker (HH:MM) agar Owner bisa mengatur seperti Paket Pagi/Malam.

3. LOGIKA CHECK-IN & TIMER DASHBOARD:
   - Jika tamu mengambil paket ber-slot jam (misal Paket Pagi), waktu checkout otomatis langsung dikunci ke `end_time` (jam 16.00), bukan ditambah dari menit check-in awal.
   - Perbaiki variabel pembaca sisa waktu pada `src/routes/index.tsx` (Dashboard) agar membaca state data dari `b.remaining_time` atau hasil kalkulasi selisih checkout time di real-time Supabase agar countdown langsung muncul di halaman depan.
