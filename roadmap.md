# Revisi tampilan Baturaden 25 Homestay

## Revisi Dashboard saat ini
- [x] Tambahkan garis pemisah vertikal emas redup (1px, ±13%) antar kolom tabel Status Kamar, sejajar dari kepala sampai baris terbawah dan ikut ter-scroll; garis horizontal antar baris dipertahankan, ukuran/padding/font/urutan kolom tidak berubah; komputer/HP terverifikasi.
- [x] Rapikan hanya tabel Status Kamar menjadi sembilan kolom ringkas sesuai referensi; timer bertanda, komputer/HP, pengujian dan build lulus tanpa mengubah aturan. Persiapan, Perlu Tindakan dan pembatasan khusus pemilik belum didukung; perlu pekerjaan terpisah bila diminta.
- [x] Samakan kapsul pencarian Daftar Transaksi dengan milik Daftar Tamu ("Cari Nomor Transaksi...", teks 16px), rapikan tombol "+ Check-in Langsung", kembalikan ukuran teks pencarian Tamu, ratakan kiri nama beserta jumlah kunjungan, dan ganti tombol Tamu menjadi "+ Tambah Tamu"; komputer/HP terverifikasi.
- [x] Sesuaikan teks aksi cepat/pencarian/sapaan, tanggal singkat, tabel rata tengah/logo WhatsApp, dan tampilan formulir pengeluaran; komputer/HP dan ketiga formulir terverifikasi tanpa menyimpan transaksi.
- [x] Ganti label aksi cepat ketiga menjadi "Kas Keluar" (dua baris), hapus empat kotak ringkasan status di halaman Kamar, samakan kolom pencarian Daftar Tamu dengan gaya Dashboard ("Cari Nama atau Nomor Whatsapp...."), dan ratakan tengah kolom tabel tamu; komputer/HP terverifikasi.
- [x] Susun Aksi Cepat pertama dan tiga ringkasan sejajar bawah, redupkan latar kutipan, hapus brand di atas sapaan, tambahkan pencarian dan verifikasi komputer/HP serta rincian transaksi nyata.
- [x] Rapikan batas tabel, tampilkan timer, samakan panorama dengan Login, tampilkan Pengaturan dan hapus identitas footer sidebar.
- [x] Verifikasi Dashboard dengan sesi Owner dan uji timer.

- [x] Terapkan identitas ungu, sidebar desktop, dan navigasi bawah HP.
- [x] Tata ulang Ringkasan, Kamar, Booking, Tamu, Transaksi, Housekeeping, Keuangan, Karyawan, dan Pengaturan.
- [x] Siapkan tampilan bertahap Check-in dan informasi waktu sewa contoh.
- [x] Periksa hasil visual HP dan desktop serta kesalahan aplikasi.

# Tahap 1 — Fondasi operasional

- [ ] Siapkan autentikasi, peran terpisah, izin dan data demo aman.
- [ ] Buat struktur data kamar, tipe, paket, tamu, transaksi dan aktivitas dengan aturan akses.
- [ ] Hubungkan halaman yang ada ke data tersimpan serta tindakan pengelolaan dasar.
- [ ] Uji penyimpanan, validasi, izin, dan tampilan tanpa mengubah desain.
# Tahap 2 — Tindakan pemesanan dan check-in

- [ ] Baca INTRUKSI-TAHAP2.md dari repositori dan cocokkan dengan data tersimpan.
- [ ] Tambahkan tombol + Buat Booking Baru pada /booking beserta formulirnya.
- [ ] Tambahkan tombol + Check-in Langsung pada /transaksi beserta formulirnya.
- [ ] Uji kedua alur tanpa mengubah desain yang ada.

- [x] Sampaikan nama pengguna akun demo Owner kepada pengguna.

# P0 — Penyempurnaan Dashboard saat ini
- [x] Rapikan tabel kamar, KPI, tinggi daftar transaksi, dan tiga panel analitik tanpa mengubah aturan.
- [x] Periksa Dashboard 1580×900 dan Booking serta halaman operasional dengan data tersedia, tanpa membuat transaksi.

# Redesain "Malam Keemasan Modern"
- [x] Tahap 1: fondasi tema, sidebar/header/navigasi HP, halaman Masuk, tombol & isian bersama.
- [ ] Tahap 2: Dashboard (menunggu persetujuan Owner).
- [ ] Tahap 3: Kamar (hapus 4 kartu ringkasan di Semua Kamar), Booking, Transaksi, Tamu.
- [ ] Tahap 4: Housekeeping, Keuangan, Laporan, Tim & Akses, detail.


# CHECKPOINT OPERASIONAL SEMENTARA — 21 Oktober 2026

Status: **PERSIAPAN / BELUM BOLEH TRANSAKSI NYATA**. Keputusan Owner: 90% desain Dashboard telah disetujui; sisa 10% perbaikan visual isi fitur **ditunda** sampai operasional aman. Jangan mengulang pekerjaan yang telah selesai. Identitas resmi harus selalu ditulis **Baturaden 25 Homestay**.

## Pencapaian terkonfirmasi
- [x] Proyek Lovable yang sama dipindahkan dari workspace pinjaman ke workspace pribadi **Kozan's Lovable** (project ID tetap `017f6e78-15f2-4d07-a38c-87cb185279bf`).
- [x] Owner melaporkan Dashboard normal pasca-pemindahan; desain final Malam Keemasan Modern diterima.
- [x] GitHub resmi `sk25ciwastra-blip/pixel-perfect` terhubung; HEAD GitHub diverifikasi sama dengan Lovable `0179aa27a8c739ee6e4117b7a9259a856a4cc148` sebelum pekerjaan dokumen cabang ini.
- [x] Situs telah dipublikasikan dengan audiens **Hanya Undangan / custom**, bukan publik bebas: `https://pixel-perfect-homestay-hub.lovable.app/`.
- [x] Supervisor (istri Owner) berhasil masuk melalui HP pada situs tayang.
- [x] Halaman Keuangan Supervisor menampilkan kontrol **Buka Sesi Kas**.
- [x] Pengujian pertama menemukan blocker backend saat membuka sesi: `Could not find the function public.open_finance_cash_session(_opening_cash) in the schema cache`.

## TEMUAN KRITIS: backend tidak sinkron
Audit baca-saja pada 21 Oktober 2026:
- Database Supabase staging `bgtztcfbkcrvcipxbfti` (**Baturaden-25-Staging**) dilaporkan ACTIVE_HEALTHY; memiliki **30 tabel publik** dan RPC `public.open_finance_cash_session(_opening_cash numeric)`.
- Database yang dapat diakses melalui koneksi database **proyek Lovable** menunjukkan **17 tabel publik** dan **tidak ada** RPC `open_finance_cash_session`.
- Kode terkini `src/routes/keuangan.tsx` menggunakan `rpc('open_finance_cash_session', { _opening_cash: angka(openingCash) })`, dan `src/lib/data-live.ts` meneruskan ke klien Supabase `src/integrations/supabase/client.ts` yang menggunakan variabel lingkungan `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Dengan demikian, **tidak benar** menganggap dua koneksi backend identik hanya karena keduanya bertipe Supabase. Perlu pembuktian endpoint yang dipakai **situs terpublikasi** dan pemetaan schema/migrasi. Jangan langsung mengasumsikan solusi cukup `NOTIFY pgrst, 'reload schema'`.
- Halaman Dashboard berhasil dimuat **tidak membuktikan** transaksi, RLS, pembayaran, sesi kas, atau hak Supervisor telah aman.
- Saat audit staging sebelumnya: 11 kamar, 4 tipe kamar, 9 paket, 27 konfigurasi harga, 1 entri user_roles, 0 employees, 0 transaksi, 0 pembayaran, 0 finance_cash_sessions; ini **hanya data staging**, bukan klaim mengenai seluruh backend aktif.

## Langkah teknis wajib (untuk Codex / tim teknis)
1. **READ-ONLY FIRST**: identifikasi host dan project ref Supabase yang dipakai browser situs terpublikasi, Lovable DB connector, dan staging; jangan bocorkan API key/token. Cocokkan ketiga endpoint secara aman, bandingkan fungsi, skema, RLS, grants, migrasi dan Auth identity untuk Owner/Supervisor. Tidak boleh membuat data transaksi uji dulu.
2. Tentukan **SATU sumber data operasional resmi** bersama Owner. Jangan mengarahkan aplikasi langsung ke staging tanpa review Auth, RLS, data, dan dampak terhadap akun Supervisor yang baru berhasil login.
3. Audit daftar fungsi/relasi minimum: buka/tutup sesi kas, alokasi kas, booking, check-in/out, pembayaran, housekeeping, laporan, roles/training dan RLS. Catat gap versus kode Lovable dan migrasi GitHub; hindari refactor, migrasi global, penambahan tipe `any`, atau memperbarui harga/aturan Owner.
4. Buat **proposal perubahan terpisah (PR/diff + rollback + verifikasi)**; belum boleh menjalankan DDL/DML pada database aktif tanpa review Owner atas target backend dan risiko akses. Backup/restore plan harus ada sebelum perubahan.
5. Baru setelah backend cocok, uji berurutan **login Supervisor → izin → buka sesi kas → booking → check-in → pembayaran → check-out → housekeeping → closing/laporan**, dengan data uji terisolasi, cleanup terkontrol, tanpa mencampur ke pembukuan nyata.
6. Periksa izin Owner membantu sesi Supervisor (`Bantu Sesi Aktif`), operator identity vs session owner identity, tanpa mengambil alih otorisasi atau membuka sesi ganda.
7. Evaluasi kesiapan: *no go* jika RPC hilang, role/RLS tidak benar, pembayaran/closing tidak balance, atau integrasi belum terverifikasi. Desain yang sudah disetujui **tetap dibekukan** sepanjang pekerjaan keamanan backend.

## Instruksi kerja permanen
- Jangan mengerjakan ulang pekerjaan selesai; instruksi ke Codex harus utuh dan satu tujuan, bukan potongan berulang.
- Aturan Owner yang sudah ada merupakan sumber kebenaran; perubahan operasional perlu disepakati bila kontradiksi.
- Tidak ada SQL migrasi, penggantian host proyek, pemindahan akses, penghapusan data, atau penerbitan ulang tanpa izin Owner dan rencana rollback.
- Setiap checkpoint wajib menyatakan progres **terverifikasi**, blocker, dan langkah selanjutnya, tanpa mengarang persentase lulus.
