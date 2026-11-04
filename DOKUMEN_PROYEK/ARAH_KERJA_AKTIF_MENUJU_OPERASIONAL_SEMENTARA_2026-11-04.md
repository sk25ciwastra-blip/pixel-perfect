# ARAH KERJA AKTIF — MENUJU 100% SIAP OPERASIONAL SEMENTARA
**Baturaden 25 Homestay — keputusan Owner 4 November 2026 WIB**  
**Status:** ARAH KERJA AKTIF / DOKUMENTASI SAJA (tidak menjalankan kode, migrasi Cloud, atau deploy)

## ATURAN KERJA OWNER TERBARU — CATAT UNTUK CHAT BARU (5 NOVEMBER 2026 WIB)

**Prinsip:** "Jika ada yang mudah, kenapa harus sulit" dan **"Sekali mendayung, dua tiga pulau terlampaui."**

1. Ketika Owner menulis **"Codex sedang bekerja"**, artinya instruksi sudah diberikan dan Codex masih memproses. **Jangan kirim tugas Codex baru, mengulang tugas PASS, atau bertanya ulang hal yang sudah dijawab.** Tunggu laporan terakhirnya.
2. Fokus **100% Siap Operasional Sementara**, bukan menambah fitur nonkritis, desain besar, atau audit menyeluruh. Pekerjaan baru harus terkait gap nyata; uji ulang bagian yang berubah saja.
3. Jika ada tugas yang dapat ChatGPT lakukan langsung melalui akses GitHub/Supabase/Lovable yang tersedia, **kerjakan sendiri dahulu**; jangan melemparkannya ke Codex atau Owner. Tindakan berisiko/Cloud/merge/deploy memerlukan persetujuan Owner.
4. **Format jawaban:** selesaikan **Bagian 1 (pekerjaan utama, hasil nyata/checkpoint/gate berikutnya)**, lalu **Bagian 2 (obrolan santai ide/desain)** bila berguna. Diskusi santai berlangsung paralel saat Codex bekerja, **tanpa membuat Codex menunggu atau mengganggu tugasnya**.
5. Pemilik workspace Lovable sementara belum merespons; jangan memulai perpindahan atau reconnection yang belum tersedia. Saat tersedia, perbarui checkpoint serah-terima sebelum pindah.

### Ide laporan untuk pembahasan santai — belum persetujuan implementasi

- Tujuan Owner: **dokumen profesional untuk calon investor atau pengajuan kredit bank**, bukan hanya laporan internal resepsionis.
- Indikator inti: **Total Pendapatan**, **Total Kamar**, **Total Tamu Baru**, **Total Tamu Lama**. **Tanpa Saldo Awal**, saldo berjalan, atau saldo akhir seperti rekening koran.
- **Total Kamar = jumlah kejadian penjualan sewa kamar selama periode yang dipilih, termasuk Extend; bukan jumlah nomor kamar unik maupun sekadar nomorator transaksi.** DP + pelunasan satu sewa tidak boleh dihitung sebagai dua kamar terjual.
- Arah visual: cetak rapi profesional terinspirasi rekening koran; **format final BELUM diputuskan**.
- Pembicaraan awal tentang pengeluaran: Owner khawatir besarnya biaya terlihat mengejutkan investor. **Jangan memanipulasi, menghapus biaya yang material dari laporan laba-rugi, atau menampilkan omzet sebagai laba.** Opsi yang akan dibahas: **(A) Laporan Kinerja Pendapatan/Operasional** dengan KPI dan penjualan saja, secara jelas dilabeli bukan laba-rugi; **(B) Laporan Laba Rugi dan arus kas pendukung yang transparan** untuk due diligence/bank. Jangan klaim template atau dokumen sudah diterima bank.
- Status: **KONSEP DISKUSI SANTAI**; jangan beri tugas Codex/implementasi baru untuk laporan selama tugas operasional kritis berjalan.

## UPDATE GATE AUTHORIZATION — 4 NOVEMBER 2026, 23:40 WIB

**11/11 PASS LOKAL (laporan Codex):** Owner, Supervisor bantu Receptionist, Receptionist, Training Day 1/Day 2, ACL authenticated/anon; direct RPC trainee tanpa wrapper, sesi Owner yang salah, trainee buka sesi sendiri, Housekeeping, dan Supervisor menunjuk Owner semuanya ditolak sesuai aturan. Dual identity operator/sesi dan rollback tanpa data parsial **PASS**. PostgreSQL tes berhenti aman. **Bukan PASS Cloud.**

**BACA CHECKPOINT BARU:** [CHECKPOINT_AUTHORIZATION_COMBINED_PAYMENTS_2026-11-04.md](./CHECKPOINT_AUTHORIZATION_COMBINED_PAYMENTS_2026-11-04.md).

**PEKERJAAN BERIKUTNYA BERUBAH:** jangan mengulang Finance/concurrency/auth. **Review diff worktree lokal `C:\tmp\pixel-perfect-combined-payment`, branch `feat/combined-payments-20261104`**, pisahkan source implementasi dari file log/temp, identifikasi risiko tersisa dan siapkan rencana satu PR. **Jangan commit, push, buat PR, merge, deploy atau migrasi Cloud tanpa keputusan Owner berikutnya.** Lovable workspace masih ditunda sampai pemilik merespons; tujuan 100% Siap Operasional Sementara tetap berlaku.

## Perintah utama jika berpindah obrolan
**Lanjutkan proyek Baturaden 25 Homestay menuju 100% target _Siap Operasional Sementara_.** Jangan mengartikan ini sebagai 100% fitur masa depan atau status GO-LIVE yang sudah tercapai. Baca checkpoint dan hasil PASS sebelumnya, kemudian kerjakan **satu gap kritis yang belum PASS**. Jangan memulai audit/bootstrap/tes yang sudah PASS tanpa indikasi regresi. Jangan mengulang permintaan keputusan Owner yang sudah disahkan.

**Urutan membaca:**
1. Dokumen ini — tujuan dan satu langkah berikutnya.
2. `DOKUMEN_PROYEK/CHECKPOINT_SERAH_TERIMA_WORKSPACE_LOVABLE_2026-11-04.md` — metode pindah workspace, tujuh ide desain, aturan penyambungan ulang.
3. `DOKUMEN_PROYEK/CHECKPOINT_PEMBAYARAN_GABUNGAN_2026-11-04.md` bila tersedia; bila tidak tersedia pada worktree, gunakan catatan PASS di dokumen transisi dan bukti log, bukan mengulang uji.
4. `DOKUMEN_PROYEK/02_ATURAN_BISNIS.md` dan dokumen Owner resmi lain.

## Keputusan Owner sekarang
- Pemilik workspace Lovable kerja/sementara **belum merespons**. **TUNDA pengerjaan dan pemindahan workspace Lovable**; jangan menduga akses atau membuat workspace pengganti.
- **Lanjutkan fungsi/pengujian menuju siap operasional sementara** selagi menunggu.
- Bila pemilik workspace merespons, **perbarui checkpoint ini dan checkpoint serah-terima** dengan posisi pekerjaan, workspace asal/tujuan, repo/branch GitHub yang diverifikasi, identitas proyek Supabase yang diverifikasi, rencana sinkronisasi, dan sisa risiko. Desain 7 fitur ditangani oleh Lovable, logika/RPC/tes oleh Codex.
- Hindari kebingungan saat pindah chat: setiap milestone catat hasil PASS/FAIL/NOT TESTED, bukti, commit/branch, Cloud atau lokal, batas cakupan, dan pekerjaan berikutnya.

## Bukti PASS terakhir — LAPORAN CODEX/OWNER, LAB LOKAL, BUKAN CLOUD
- Combined payments: Booking DP dua metode, pelunasan, Check-in langsung, atomic rollback/retry, Receipt 58mm pada fungsi database, concurrency 2 klien (same request key) **PASS lokal**.
- Komisi persentase: Rp200.000 × 8% = Rp16.000; refund Rp20.000 mengurangi Rp2.000 → Rp14.000; refund 100% net Rp0 — **PASS lokal**.
- Komisi per kamar: Rp15.000 satu kali walau 2 payments; partial refund tetap Rp15.000; full refund Rp0 — **PASS lokal**.
- Cash Rp110.000 dan QRIS Rp110.000, Owner operator vs Receptionist cash-session owner, expected cash closing Rp122.345, refund dari Owner Funds tidak mengubah snapshot FINAL, kekurangan kas ditolak — **PASS lokal**.
- Log: `C:\tmp\combined-finance-lab-20261104-070000\finance-runtime-test-final.log`. Harness `scripts/combined-payments-finance-runtime-tests.sql`. Lab berhenti aman.
- Worktree lokal: `C:\tmp\pixel-perfect-combined-payment`, branch `feat/combined-payments-20261104`. Implementasi gabungan **belum di-commit/push/PR** menurut laporan; **JANGAN RESET/OVERWRITE** perubahan lokal.
- Tidak ada migrasi Cloud, deploy, publish, feature flags ON, merge implementasi, atau printer fisik yang dinyatakan PASS dalam checkpoint ini.

## Satu pekerjaan prioritas berikutnya
**Pengujian runtime otorisasi jalur pembayaran gabungan pada PostgreSQL lokal isolasi**: Owner, Supervisor (termasuk membantu sesi Receptionist aktif), Receptionist, Training Day 1/2, akses ilegal ditolak, operator sebenarnya dan cash-session owner terpisah, audit dan rollback. Jangan mengulang tes Finance/concurrency yang PASS. Simpan log. Bila PASS, review kualitas perubahan source, amankan branch lokal, siapkan satu PR proposal; **jangan merge/deploy otomatis**.

## Gate minimum menuju operasional sementara
- Jalur transaksi penting Booking/Check-in/Checkout, pembayaran gabungan, sesi kas, refund, receipt, dan Housekeeping berfungsi dan teruji sesuai peran dan waktu (gunakan hasil PASS yang masih relevan, fokus yang belum terbukti).
- Periksa readiness deployment Lovable–GitHub–Supabase, migrasi aktif, flag aman, dan backup/rollback sesuai dokumen gate. **PASS lab tidak sama dengan fitur tersedia di Cloud.**
- Kriteria 100% target operasional sementara harus berdasarkan uji penerimaan pada sistem yang benar-benar dipakai; jangan mengklaim 100% hanya karena tes lokal PASS.

## Ketentuan permanen
Codex = fungsi/tes; Lovable = desain. Tema UI Premium Dark & Gold; 7 fitur desain diarahkan untuk membantu kerja karyawan, dan keputusan yang sudah disetujui tidak dirancang ulang. Tidak ada tindakan Cloud/merge/revoke legacy/publish tanpa persetujuan Owner masing-masing. Motto Owner: **jika ada yang mudah, kenapa harus sulit**.


## PROTOKOL KERJA OWNER — PERMANEN UNTUK CHAT BERIKUTNYA (konfirmasi 4–5 Nov 2026)

**Pemicu literal:** Saat Owner mengatakan `"Codex sedang bekerja"`, Codex sedang mengerjakan instruksi **yang sudah diberikan**. **Jangan memberikan instruksi Codex baru, memulai pekerjaan berulang, atau menyuruh Owner melakukan audit ulang** sebelum hasil tugas berjalan diterima. Fokus satu blocker penting pada jalur menuju **100% Siap Operasional Sementara**; jangan menambah pekerjaan non-esensial ke jalur kritis.

**Urutan respons Londo:**
1. Jika ada pekerjaan yang dapat dilakukan ChatGPT **langsung** via GitHub, Supabase atau alat terhubung, **kerjakan sendiri dulu**, dengan prinsip tidak mengubah produksi/merge/deploy/migrasi tanpa izin Owner. Laporkan tindakan nyata dan batasnya.
2. Lanjutkan **pembahasan santai** bersama Owner (mis. ide tujuh fitur/desain laporan) **setelah** bagian utama diselesaikan. Pembahasan ide tidak otomatis menjadi tugas Codex atau perubahan sistem.
3. Pisahkan **KEPUTUSAN OWNER**, **USULAN**, **PASS LOKAL**, **AKTIF CLOUD**, dan **TERTUNDA**. Setiap milestone dicatat agar obrolan atau workspace baru tidak mengulang langkah yang sama.
4. Motto Owner: **"jika ada yang mudah, kenapa harus sulit"** dan **"Sekali mendayung, dua tiga pulau terlampaui."**

## KONSEP LAPORAN — ARAH TUJUAN OWNER, BELUM SPESIFIKASI FINAL

**Tujuan yang dijelaskan Owner:** menghasilkan **berkas profesional yang dapat dipresentasikan kepada calon investor atau saat mengajukan kredit bank**; selain manfaat operasional. Jangan menyamakan halaman cetak ini dengan rekonsiliasi kas per shift atau rekening koran rekening bank resmi.

**Keputusan Owner yang sudah jelas:**
- Ringkasan utama memuat **Total Pendapatan, Total Kamar, Total Tamu Baru, Total Tamu Lama**.
- **Tanpa Saldo Awal** dalam tampilan/cetakan laporan yang dimaksud. Jangan otomatis menyisipkan kolom saldo berjalan dan saldo akhir seperti rekening koran bank.
- **Total Kamar = jumlah penjualan/sewa kamar dalam periode terpilih, TERMASUK Extend**. Bukan jumlah nomor kamar unik, bukan hitung nomorator/TRX, dan tidak boleh terjadi duplikasi dari DP + pelunasan atau dua metode pembayaran. Satu kejadian sewa awal + satu Extend = **dua penjualan kamar** menurut contoh Owner.
- Format visual akhir belum dipilih; desain cetak profesional terinspirasi keterbacaan rekening koran, tidak wajib meniru rekening koran bank.
- Kebutuhan Owner: cara menampilkan pengeluaran **tanpa menimbulkan salah persepsi** bahwa seluruh pengeluaran besar adalah biaya operasional rutin.

**Pedoman penyajian yang masih USULAN — BELUM keputusan Owner:**
- Pisahkan **Ringkasan Kinerja Operasional** (pendapatan, kamar terjual, tamu baru/lama, tren dan metrik relevan) dari **Ringkasan Keuangan & Lampiran** untuk pembaca investor/bank.
- Jika laporan menyajikan laba/rugi, modal, pembayaran utang, pembelian aset, renovasi atau pengeluaran satu kali, **klasifikasikan dengan benar**. Jangan menyebut semua arus uang keluar sebagai biaya operasi; jangan pula menyembunyikan biaya material, kewajiban, refund, atau risiko. Rekonsiliasi ke data dan bukti dapat ditelusuri.
- Versi ringkas boleh mendahulukan pendapatan dan performa penjualan, tetapi untuk due diligence investor atau bank tetap harus disediakan laporan biaya, laba/rugi, arus kas dan dokumen pendukung yang **lengkap dan jujur** sesuai kebutuhan.
- **BELUM DIPUTUSKAN:** definisi Tamu Baru/Lama (orang unik atau kunjungan), pendapatan kotor vs net refund, status sewa yang dihitung, format laporan final, jenis/klasifikasi biaya, dan apakah ada sumber data memadai. Jangan hardcode definisi dari dugaan.
- Pembahasan laporan ini adalah **sesi santai/konsep**, bukan alasan mengalihkan Codex dari jalur hardening dan kesiapan operasional sementara.



## UPDATE HARDENING COMBINED PAYMENT — 5 NOVEMBER 2026, 00:17 WIB (laporan Codex)

**FINAL HARDENING PASS LOKAL**, tanpa mengulang SQL runtime Finance/concurrency/authorization sebelumnya:
- Adapter RPC bertipe lokal: `src/lib/combined-payments.ts` (menghindari `rpc as any`).
- Flag tiga gerbang **DEFAULT OFF**; RPC gabungan hanya digunakan bila `VITE_FEATURE_COMBINED_PAYMENT`, `VITE_FEATURE_COMBINED_PAYMENT_BACKEND_READY`, dan `VITE_FEATURE_COMBINED_PAYMENT_OWNER_APPROVED` semuanya `true`. Saat OFF, UI **tidak** memanggil RPC gabungan dan **tidak** mengubah dua metode menjadi satu diam-diam.
- `src/components/formulir-pemesanan.tsx` dan `src/routes/booking.tsx` menggunakan gating; state `paymentIdempotencyKey` dan `legacyArgs` tak dipakai dibersihkan.
- Validasi DP minimum dinamis sesuai Owner menggunakan `ceil`, tidak lagi tergantung pada feature flag Extra Guest.
- Tes baru `scripts/fitur.test.ts`: **7/7 PASS** OFF/ON dan DP. TypeScript, frontend build, Extra Guest/Receipt pure, RPC contract, dan `git diff --check`: **PASS**. Hanya warning non-blocking `inputValidator`, `vite-tsconfig-paths`, Nitro.
- Worktree lokal `C:\tmp\pixel-perfect-combined-payment` branch `feat/combined-payments-20261104` tetap **DIRTY / UNCOMMITTED** beserta migrasi dan harness. `.bak`/runner sementara tidak masuk PR. **Tidak ada Cloud write, migrasi, commit, push, PR atau produksi flag ON**.
- **Risiko berikutnya:** generated types Supabase Cloud belum sinkron dengan RPC baru; adapter lokal hanya solusi sementara. Backend Cloud harus diverifikasi dan diberi persetujuan Owner tersendiri sebelum aktivasi.
- **Langkah kerja aktif selanjutnya:** review akhir file untuk staging terbatas dan rencana satu PR; jangan commit/push/PR otomatis. Setelah aman, beralih ke gap deployment/operasional nyata; jangan audit ulang tes PASS.

## PROTOKOL SAAT RESPONS CHAT GAGAL DIMUAT (keputusan alur kerja)
- **Reload halaman diperbolehkan**, tetapi jangan menganggap tindakan backend dibatalkan. Hasil aksi GitHub/Supabase dapat sukses walau respons ChatGPT tidak tampil.
- Sebelum mencoba ulang: **read-only cek status** file/commit/PR GitHub, object/migrasi/data Supabase yang dituju, atau log Codex. Jika sudah ada, **jangan ulang mutasi**. Jika belum ada, lakukan hanya langkah yang memang belum selesai.
- Jangan kirim pesan “ulangi dari awal”; gunakan **“Periksa status terakhir dulu, lalu lanjutkan tanpa mengulang tindakan yang sudah berhasil.”**
- Hindari tindakan tidak idempoten dua kali, terutama migrasi, pembayaran, refund, commit/merge, dan publish.

## CATATAN KONSEP KAS KELUAR DAN LAPORAN OWNER (diskusi, bukan implementasi)
- Owner menghendaki **kategori kas keluar diinput oleh karyawan** sehingga laporan Owner dapat memisahkan pengeluaran operasional dengan pengambilan pribadi Owner dan kategori lain sesuai kebutuhan.
- Ini adalah **arah konsep yang disambut Owner**, bukan perintah mengubah Finance150 sekarang; **verifikasi kategori dan alur yang sudah tersedia** sebelum menambah apa pun. Hindari membuat pekerjaan Codex baru jika fasilitas yang sama sudah ada.
- Usulan klasifikasi terpisah: **biaya operasional**, **investasi/perolehan aset atau renovasi**, dan **pengambilan pribadi Owner (prive/distribusi sesuai bentuk badan usaha)**; jangan menyamakan seluruh kas keluar dengan beban usaha.
- Prinsip laporan investor/kredit: angka aktual, transparan, dapat diaudit; tampilan ringkas boleh menonjolkan performa kamar dan pendapatan tetapi informasi biaya material, kewajiban dan arus kas harus tersedia pada laporan/lampiran pendukung. Jangan memasukkan rincian keuangan pribadi Owner ke repo GitHub.
- **Keputusan teknis tentang kategori, kewenangan karyawan mencatat pengambilan Owner, approval, dan mapping akuntansi BELUM FINAL**; jangan hardcode tanpa keputusan dan review aturan Owner.

## CATATAN OWNER — PENGAMBILAN CASH UNTUK KEPERLUAN PRIBADI (5 NOVEMBER 2026)

- **Arah konsep dari Owner:** pencatatan pengambilan uang tunai untuk kebutuhan pribadi bersifat **fleksibel**, karena aktivitas kas keluar dilakukan oleh **Receptionist** menggunakan **Cash**.
- Usulan klasifikasi pada laporan tetap memisahkan **pengambilan Owner/prive** dari **biaya operasional homestay**. Tujuan utamanya akurasi laporan dan pembelajaran kontrol keuangan, bukan menyembunyikan pengeluaran dari pihak investor/bank.
- **BELUM diputuskan/diimplementasikan:** nama kategori persis pada aplikasi, aturan approval bila diperlukan, pembatasan akses, mapping accounting dan formulir input. Cek kategori kas keluar dan jejak audit **yang sudah ada** sebelum menambah fitur baru. Jangan membuat pekerjaan Codex baru hanya karena diskusi ini.
- Selama fase kerja aktif, lanjutkan gate menuju 100% **Siap Operasional Sementara**; diskusi desain/laporan berjalan santai paralel.


## CHECKPOINT SELECTIVE STAGING — 5 NOVEMBER 2026, 00:32 WIB (laporan Codex)

- Branch lokal `feat/combined-payments-20261104...origin/main`, worktree `C:\tmp\pixel-perfect-combined-payment`.
- **10 file STAGED, 1.645 insertions dan 96 deletions**, belum commit/push/PR:
  `supabase/migrations/20261104000000_atomic_combined_payments.sql`,
  `src/lib/combined-payments.ts`,
  `src/lib/feature-flags.ts`,
  `src/lib/fitur.ts`,
  `src/components/formulir-pemesanan.tsx`,
  `src/routes/booking.tsx`,
  `scripts/fitur.test.ts`,
  `scripts/extra-guest-receipt-pure-tests.cjs`,
  `scripts/combined-payments-finance-runtime-tests.sql`,
  `scripts/combined-payments-authorization-runtime-tests.sql`.
- **Dikecualikan:** `scripts/combined-payments-runtime-test.ps1`, dua `.bak`, log PostgreSQL dan generated outputs.
- Migration SHA-256 cocok reviewed artifact `F1DF06EDE387A65FDDB9A3FDC829713CBEDCA9BB369683B1DFE614E5B678ACEB`; `git diff --cached --check` PASS, secret scan staged tidak menemukan secret; tiga gerbang flag tetap **default OFF**.
- TypeScript/build, 7/7 feature tests, Finance, concurrency dan authorization sebelumnya PASS lokal; **runtime tidak diulang**.
- **Next action hanya setelah persetujuan Owner:** commit terarah di branch fitur lokal, kemudian persetujuan terpisah untuk push/PR. **Jangan merge/migrasi/deploy/aktifkan flag Cloud secara otomatis**. Types Supabase Cloud/generated RPC masih perlu sinkronisasi setelah backend Cloud disiapkan.

## KEPUTUSAN KONSEP LAPORAN OWNER — 5 NOVEMBER 2026

- **Tiga komponen laporan yang Owner inginkan:** **Total Pendapatan**, **Biaya Operasional**, **Prive** (pengambilan pribadi Owner). Total Kamar/Tamu Baru/Tamu Lama tetap metrik operasional yang pernah dibahas; untuk format ringkasan terbaru, tiga komponen di atas menjadi garis besar.
- **QRIS masuk langsung kepada Owner**, bukan kas tunai resepsionis. Namun **tetap pendapatan usaha** dan tetap memerlukan pencatatan/rekonsiliasi yang benar; bukan otomatis pengeluaran atau prive hanya karena uang berada di akun Owner.
- Kas keluar tunai dicatat Receptionist menggunakan kategori yang sesuai; **Prive dipisahkan dari biaya operasional**. Kategori dan kontrol teknis tetap mengikuti aturan Owner/sistem Finance yang ada, jangan langsung menambah fitur sebelum memeriksa implementasi.
- Owner tidak lagi mengkhawatirkan kesan pengeluaran besar bagi investor sebagai alasan merombak laporan; laporan tetap harus **akurat, transparan, lengkap bila diperlukan**, tanpa menyembunyikan biaya atau kewajiban.
- **Belum instruksi implementasi ke Codex**: ini pembahasan santai konsep laporan sementara prioritas utama tetap kesiapan operasional sementara.
