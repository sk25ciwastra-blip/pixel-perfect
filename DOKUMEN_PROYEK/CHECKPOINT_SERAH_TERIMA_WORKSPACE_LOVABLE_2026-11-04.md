# CHECKPOINT SERAH-TERIMA WORKSPACE LOVABLE — Baturaden 25 Homestay
**Dicatat:** 4 November 2026 WIB  
**Maksud:** dokumen tunggal untuk melanjutkan pekerjaan ketika chat, akun/workspace Lovable, browser, dan terminal ditutup. **Jangan audit ulang hal yang telah PASS tanpa alasan perubahan/regresi.**  
**Status:** DOKUMENTASI TRANSISI; bukan persetujuan deploy/merge/migrasi Cloud.

## 1. Alur kerja Owner — jangan diubah
- Owner **mengerjakan desain terlebih dahulu di workspace Lovable kerja/sementara** seperti alur sebelumnya.
- Setelah revisi desain selesai, Owner akan **memindahkan proyek ke workspace Lovable pribadi**.
- Perpindahan workspace berpotensi memerlukan **penyambungan ulang GitHub dan Supabase**. Jangan berasumsi koneksi otomatis ikut berpindah, namun juga jangan membuat proyek/database baru atau menjalankan ulang migrasi secara otomatis.
- Peran: **Codex = kode/fungsi/RPC/SQL/tes**; **Lovable = desain/UI/UX**; ChatGPT = koordinasi, review, dokumentasi, aksi GitHub/Supabase yang tersedia sesuai izin.
- **Selama fase desain:** pertahankan konsep aplikasi **Premium Dark & Gold**. Fokus kecepatan kerja staf, kejelasan informasi, lebih sedikit klik, tidak membosankan; elemen yang sudah Owner setujui tidak dirombak. Tidak memindahkan workspace atau mengubah koneksi sampai tahapan aman dan dipastikan oleh Owner.

## 2. Tujuh target desain Owner (bukan sekadar revisi Booking lama)
1. **Kirim Bukti Pembayaran / Invoice Digital:** konsep final horizontal putih–emas, logo bunga emas lama, dua panel informasi, payment history, status PAID, PNG WhatsApp (PDF opsional), **jangan membuat sketsa baru yang mengubah layout disetujui**. Implementasi desain belum terverifikasi.
2. **Booking:** revisi tampilan agar ringkas, mudah ditindaklanjuti resepsionis, tanpa submenu, warm-white isi, background dasar tetap, tanpa foto kamar; mockup terbaru yang benar tetap memerlukan tinjauan Owner.
3. **Housekeeping:** sebagian konsep sudah ada, sempurnakan alur kerja petugas, jangan ganti elemen yang sudah disukai.
4. **Laporan:** konsep/sketsa ada; terapkan setelah memastikan referensi desain Owner dan status implementasi.
5. **Kamar:** revisi tampilan navigasi/daftar kamar untuk operasional; konsep baru belum final; tetap ikuti tipe resmi dan kebutuhan status kamar.
6. **Tim & Akses:** desain yang menjelaskan peran dan izin dengan jelas, **tidak mengubah aturan hak akses**.
7. **Pengaturan:** desain ringkas dan jelas, khususnya pengaturan sensitif Owner-only; **tidak mengubah aturan bisnis atau nilai produksi**.

**Tujuan desain:** visual rapi/premium dan **membantu pekerjaan karyawan**, bukan hanya kosmetik. Setiap konsep harus menjelaskan status/aksi penting, siapa penggunanya, beban klik, serta elemen yang dilarang berubah. Pisahkan KONSEP, DISETUJUI, DITERAPKAN LOKAL, DITERAPKAN LOVABLE, dan PUBLISHED.

## 3. Pekerjaan fungsi terakhir yang sudah PASS — berdasarkan laporan Codex/Owner, lokal saja
- Repo GitHub: `sk25ciwastra-blip/pixel-perfect`. Baseline source implementasi gabungan sebelumnya: `397fa8f303fe33d979e8d125cddfc4fd4b19aa6d` **historis, bukan jaminan main terkini**.
- Worktree lokal Codex **jangan di-reset/overwrite**: `C:\tmp\pixel-perfect-combined-payment`, branch `feat/combined-payments-20261104`, implementasi gabungan **belum commit/push/PR** menurut laporan terakhir.
- Lab PostgreSQL 17.11: Booking DP dua metode, pelunasan, Check-in dua metode, atomic rollback/retry/tamper, Receipt SQL 58 mm, dan dua-klien concurrency sama-key **PASS lokal**. Log concurrency `C:\tmp\combined-bootstrap-20261104-055303-541\concurrency-20261104-064817`; cluster berhenti.
- Finance lanjutan (laporan Codex 4 Nov 2026 22:47): **PASS** komisi persentase Rp200.000 x 8% = Rp16.000; refund parsial Rp20.000 mengurangi komisi Rp2.000 menjadi Rp14.000; refund 100% net Rp0. Komisi per kamar Rp15.000 sekali meski dua payment, refund parsial tetap Rp15.000, refund penuh Rp0.
- Rekonsiliasi Cash Rp110.000 + QRIS Rp110.000 **PASS**; operator Owner dan pemilik sesi Receptionist tetap terpisah; closing expected cash Rp122.345; refund Owner Funds tidak mengubah snapshot sesi FINAL; kekurangan kas ditolak.
- Log Finance terakhir: `C:\tmp\combined-finance-lab-20261104-070000\finance-runtime-test-final.log`. Harness `scripts/combined-payments-finance-runtime-tests.sql`. Kedua cluster PostgreSQL berhenti. Codex tidak mengubah source/migrasi dan tidak commit/push/PR.
- **BELUM PASS:** pengujian **otorisasi jalur combined payment** Owner/Supervisor/Receptionist/Training, QA desain nyata, printer fisik; produk tidak dianggap ready Cloud/GO-LIVE.
- Peringatan: dokumen `CHECKPOINT_PEMBAYARAN_GABUNGAN_2026-11-04.md` tidak tersedia dalam worktree yang dilihat Codex. Jangan gunakan ketidakhadiran lokal sebagai alasan menghapus histori GitHub atau mengulang tes.

## 4. Gerbang sebelum Lovable menyentuh kode / koneksi
1. **Amankan kerja Codex dirty** dengan inventaris `git status --short --branch` dan back-up/commit terkontrol pada branch tersendiri jika Owner menyetujui; **jangan reset**, jangan merge otomatis. Bedakan checkpoint dokumentasi dan commit implementasi.
2. Periksa koneksi repo GitHub ↔ Lovable saat ini (repo, branch, hak akses) dan target Supabase (project ID, environment) secara **read-only**; jangan berasumsi workspace lama = workspace baru.
3. Untuk desain, pilih jalur yang **tidak menimpa perubahan kode payment gabungan** (misalnya desain/workspace terpisah, PR review diff; jangan sinkronisasi dua arah sembrono).
4. Simpan screenshot/mocking keputusan desain per fitur dengan status Owner. Sebelum migrasi workspace pribadi, bekukan checkpoint desain, commit/PR yang disetujui, daftar dependensi dan status konektor.
5. Sesudah pemindahan workspace pribadi: verifikasi identitas proyek, koneksi GitHub branch dan arah sinkronisasi, Supabase URL/project **tanpa membocorkan secret**, dan fitur flag/migration history. Pengujian konektivitas awal **read-only**, bukan memigrasikan data ulang.
6. Tindakan **merge, migrasi Cloud, publish, deploy, aktivasi flags, memindahkan workspace, revoke RPC legacy** memerlukan persetujuan Owner masing-masing. Dilarang menyalin data tamu rahasia ke dokumen.

## 5. Panduan meneruskan chat / alat tertutup
- Buka dan baca file ini **lebih dahulu** beserta `DOKUMEN_PROYEK/PANDUAN_MULAI_OBROLAN_BARU.md` dan `02_ATURAN_BISNIS.md`.
- Tanyakan **hanya posisi tugas yang benar-benar belum diketahui**, bukan ulang pertanyaan / tes PASS. Tetapkan fokus aktif: **desain 7 fitur Lovable**; pengujian authorization gabungan tersimpan sebagai gate fungsi berikutnya sebelum PR implementasi.
- Lokasi worktree Codex: `C:\tmp\pixel-perfect-combined-payment`. Mulai Windows PowerShell: `cd 'C:\tmp\pixel-perfect-combined-payment'` lalu `git status --short --branch`; Codex CLI `C:\Users\USER\.codex\.sandbox-bin\codex.exe`. Jangan mengubah worktree jika sedang merancang UI.
- Untuk keputusan desain, catat tanggal, fitur, screenshot/sketsa, perubahan yang disetujui, scope yang tidak boleh disentuh, status implementasi, commit/branch/PR bila ada, dan langkah berikutnya.
- **Satu langkah desain pertama:** review fungsi/visual yang sedang digunakan di workspace Lovable kerja, pilih satu dari 7 fitur menurut Owner; buat sketsa, persetujuan, lalu perubahan UI saja dengan review diff.
- Motto: **“jika ada yang mudah, kenapa harus sulit.”**
