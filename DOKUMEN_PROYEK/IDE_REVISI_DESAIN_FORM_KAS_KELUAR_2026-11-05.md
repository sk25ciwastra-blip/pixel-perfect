# IDE REVISI DESAIN — FORM KAS KELUAR
**Baturaden 25 Homestay**  
**Tanggal keputusan Owner:** 5 November 2026 WIB  
**Status:** **KONSEP DISETUJUI OWNER — UNTUK REVISI LOVABLE; BELUM DIIMPLEMENTASIKAN**.

## Tujuan
Menyederhanakan pekerjaan Receptionist saat mencatat **Cash keluar dari laci kas**, sambil memungkinkan laporan Owner membedakan **Biaya Operasional** dari **Prive**. Konsep ini masuk antrean desain UI/UX Lovable; jangan otomatis memerintahkan Codex mengubah Finance yang sudah PASS atau menambah scope menuju Siap Operasional Sementara tanpa prioritas Owner.

## Struktur Form Kas Keluar — keputusan Owner

**Kategori utama wajib dipilih (dua kelompok):**
1. **Biaya Operasional**
2. **Prive**

**Pilihan tingkat kedua bergantung pada kategori utama:**
- Bila **Prive** → subkategori/penerima: **Owner**, **Istri Owner**, **Anak Owner**, **Lainnya**.
- Bila **Biaya Operasional** → subkategori jenis biaya; daftar rancangan: **Listrik/Air/Internet**, **Laundry**, **Amenities & Perlengkapan Tamu**, **Kebersihan**, **Perawatan & Perbaikan**, **Gaji Karyawan**, **Lainnya**. Daftar detail masih bisa disempurnakan sebelum implementasi, tetapi pengelompokan bertingkatnya sudah disetujui.

**Alur UI yang disarankan untuk Lovable:** pilih kategori utama → muncul subkategori relevan → masukkan nominal, deskripsi dan data pendukung yang memang sudah disyaratkan oleh sistem → simpan. Jangan menampilkan subkategori yang tidak sesuai. Prioritaskan kecepatan input, kejelasan status, dan kenyamanan staf; pertahankan tema Premium Dark & Gold serta bagian desain yang sudah disetujui.

## Definisi laporan yang wajib dipertahankan
- **Prive:** Cash dari laci kas yang digunakan untuk kebutuhan pribadi Owner; Receptionist yang bertugas melakukan pencatatan sesuai audit/sesi kas yang berlaku. Subkategori menentukan penerima/tujuan, **seluruhnya tetap digabung sebagai Total Prive**.
- **Biaya Operasional:** biaya menjalankan usaha; subtotal di laporan berdasarkan subkategori yang dipilih.
- **QRIS** yang langsung masuk Owner **tetap pendapatan usaha**, **bukan otomatis Prive** dan **bukan kas tunai laci**.
- Laporan Owner berisi garis besar **Total Pendapatan, Biaya Operasional, Prive**; metrik **Total Kamar, Tamu Baru, Tamu Lama** masih merupakan metrik operasional yang telah dibahas. Total Kamar menghitung setiap penjualan sewa **termasuk Extend**, tidak memakai jumlah nomor kamar unik ataupun nomorator pembayaran.
- Laporan untuk investor/kredit harus transparan; jangan menyembunyikan biaya. Item yang sebenarnya pembelian aset, pembayaran utang, refund atau arus kas non-operasional **tidak boleh dipaksa masuk Biaya Operasional/Prive**. Bila ada kebutuhan nyata, tangani di domain/alur keuangan yang benar tanpa merusak dua pilihan utama pada Form Kas Keluar yang sedang dirancang.

## Batas implementasi dan handoff
- **Lovable:** revisi struktur/keterbacaan UI/UX Form Kas Keluar sebagai bagian dari antrean desain tujuh fitur dan penyempurnaan Finance; tidak mengubah rule server, perhitungan, hak akses, atau migrasi secara diam-diam.
- **Codex:** hanya jika ada kebutuhan perubahan fungsi/data yang terbukti setelah inspeksi kategori dan mapping Finance existing; minta arahan/approval Owner sebelum memperluas scope.
- **Sebelum implementasi:** periksa form/kategori/otorisasi/struktur data yang sudah tersedia; hindari duplikasi kategori dan breaking Finance150; tentukan mapping kategori existing dan pengaruh pada laporan.
- **Belum ada tindakan produksi:** tidak ada perubahan Cloud, kode kas keluar, fitur flag, deploy atau publish dari dokumen ini.
- Protokol workspace: desain dikerjakan di workspace Lovable kerja bila tersedia, lalu setelah selesai dipindah ke workspace pribadi, verifikasi ulang GitHub/Supabase secara read-only, dan dokumentasikan perubahan.
- Saat obrolan baru dimulai, **jangan merancang ulang konsep yang sudah disetujui ini**. Lanjutkan dari checkpoint dan tanyakan hanya rincian implementasi yang memang belum ditetapkan.

**Prinsip Owner:** “jika ada yang mudah, kenapa harus sulit” dan “Sekali mendayung, dua tiga pulau terlampaui.”
