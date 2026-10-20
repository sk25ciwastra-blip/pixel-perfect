# Konsultasi Redesain Total Identitas Visual — Baturaden 25 Homestay

## 1. Apakah redesain total aman?
Bisa, asalkan yang diubah hanya tampilan: warna, huruf, tata letak, kartu, sidebar, ikon, form/modal, dan versi HP. Data live, aturan bisnis, peran/izin, penomoran, transaksi, booking/check-in/check-out, keuangan, training, housekeeping, harga, dan laporan tetap tidak disentuh. Tidak ada perubahan database atau backend.

Batasannya:
- Struktur informasi Booking yang sudah disetujui tetap sama (kotak kamar di kiri, identitas/TRX di tengah, tindakan di kanan, pengelompokan). Yang boleh diubah hanya tampilannya.
- Isi popup aksi cepat tetap sama; hanya warna dan huruf yang mengikuti tema baru, tanpa menyusun ulang isinya.
- Isi Dashboard yang wajib tetap ada: tabel Kamar Terisi dengan hitung mundur, Transaksi Terbaru, diagram Cash/QRIS/Transfer/Pengeluaran, grafik dengan skala Owner, dan target omzet.
- Kamar tetap tanpa foto dan tanpa harga.
- Halaman yang perlu login hanya bisa saya potret jika sesi Owner disetujui. Jika tidak, saya akan menyampaikannya dengan jujur.

## 2. Pemilihan tiga konsep bawaan
Fitur pemilihan tiga konsep di awal pembuatan proyek tidak tersedia untuk proyek yang sudah berjalan. Ada dua cara pengganti:
- **A. Hemat:** Owner memilih dari deskripsi tiga arah desain di bawah. Ini tidak memerlukan pembangunan apa pun dan hanya memakai kredit pesan ini.
- **B. Draf paralel:** Lovable bisa membuat **draf**, yaitu salinan proyek terpisah yang tidak mengubah proyek utama. Saya bisa membuat tiga draf, masing-masing hanya berisi **halaman Masuk + Dashboard** dengan satu arah desain. Owner melihatnya lewat tombol draf di kiri atas, di sebelah nama proyek (di HP: menu `...` kanan bawah → Drafts). Setelah itu Owner menekan **Accept** pada draf yang dipilih. Biaya kredit kira-kira tiga kali satu putaran pembangunan. Jumlah pastinya tidak bisa saya perkirakan karena tergantung tingkat kerumitan.

## 3. Tiga arah identitas visual

**Opsi 1 — "Malam Keemasan Modern" (penyempurnaan arah sekarang)**
Latar hitam pekat, emas champagne yang dipakai lebih hemat, huruf serif elegan untuk judul, dan banyak ruang kosong. Panorama kota hanya dipakai sebagai lapisan halus. Kesan: hotel bintang lima di malam hari. Risiko terkecil karena paling dekat dengan tampilan yang sudah disetujui.

**Opsi 2 — "Batu & Hutan Baturaden" (alam pegunungan mewah)**
Latar arang hangat dengan aksen hijau lumut tua dan perunggu, sentuhan tekstur batu, dan sudut yang lebih membulat. Kesan: resort pegunungan yang tenang dan sesuai identitas Baturaden. Warna hijau, merah, dan amber untuk status tetap dipertahankan dan dibuat lebih mudah dibedakan dari aksen.

**Opsi 3 — "Meja Konsierge" (terang, rapi, fokus kerja)**
Latar gading dan krem, aksen emas tua, garis tipis, kartu datar dengan kontras tinggi, dan tabel yang padat. Kesan: buku tamu hotel klasik versi digital. Paling nyaman dibaca di siang hari dan di HP. Opsi ini meninggalkan tema hitam, sehingga aturan tema "hitam + champagne gold" harus dicabut oleh Owner.

| | Opsi 1 | Opsi 2 | Opsi 3 |
|---|---|---|---|
| Perubahan dari sekarang | Kecil–sedang | Besar | Sangat besar |
| Keterbacaan siang/HP | Baik | Baik | Terbaik |
| Kesan mewah | Tinggi | Tinggi, khas lokal | Klasik |
| Perlu mencabut aturan tema | Tidak | Sebagian (aksen emas → perunggu) | Ya |

## 4. Tahapan paling hemat kredit
1. Owner memilih satu opsi (cara A), atau memilih cara B dengan tiga draf Masuk + Dashboard.
2. **Tahap 1:** fondasi tema (warna, huruf, kartu, tombol, form/modal) + sidebar + halaman Masuk. **Titik kontrol Owner.**
3. **Tahap 2:** Dashboard. **Titik kontrol Owner.**
4. **Tahap 3:** Kamar (empat kartu ringkasan status di Semua Kamar dihilangkan, submenu tetap), Booking, Daftar Transaksi, Daftar Tamu.
5. **Tahap 4:** Housekeeping, Keuangan, Laporan Operasional, Tim & Akses, serta tampilan detail. Pemeriksaan akhir di desktop dan HP.

Karena tahap 1 menyiapkan fondasi yang dipakai ulang, tahap berikutnya jauh lebih murah.

## 5. Yang membutuhkan persetujuan Owner
- Pilihan opsi desain, dan cara A atau B.
- Mencabut atau mengubah aturan tema hitam + emas (wajib untuk Opsi 3, sebagian untuk Opsi 2).
- Mengizinkan popup aksi cepat ikut berganti warna dan huruf tanpa menyusun ulang isinya.
- Mengizinkan tampilan Booking berubah tanpa mengubah strukturnya.
- Menyetujui sesi Owner untuk pemeriksaan visual halaman yang perlu login.
- Persetujuan di setiap titik kontrol sebelum lanjut ke tahap berikutnya.

## Catatan teknis
Perubahan hanya di `src/styles.css` (token), `src/components/kerangka.tsx`, komponen tampilan, dan berkas tampilan di `src/routes/*`. Data live dan logika tetap dari `data-live.ts` dan fungsi yang ada. Opsi yang dipilih dan keputusan penghapusan kartu ringkasan Kamar akan disimpan ke memori proyek saat implementasi.
