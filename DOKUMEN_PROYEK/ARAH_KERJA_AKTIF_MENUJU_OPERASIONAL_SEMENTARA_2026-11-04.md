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


## KEPUTUSAN OWNER — PRIVE CASH DAN IZIN COMMIT LOKAL (5 NOVEMBER 2026)

**KEPUTUSAN OWNER (bukan usulan):**
- **Prive dicatat ketika uang Cash dari laci kas digunakan untuk kebutuhan pribadi Owner.** Resepsionis yang mengelola laci kas dapat mencatat kas keluar tersebut dengan kategori yang tepat sesuai alur Finance dan audit yang berlaku.
- **QRIS yang langsung diterima Owner adalah pendapatan usaha; bukan otomatis Prive.** Bedakan pengakuan pendapatan, sumber dana, dan mutasi kas. Jangan menggandakan pendapatan atau membuat entri kas keluar fiktif.
- Ringkasan laporan yang diinginkan Owner: **Total Pendapatan, Biaya Operasional, Prive**; metrik penjualan kamar dan tamu tetap bagian konteks operasional sesuai keputusan sebelumnya.
- Jangan mengubah implementasi Finance hanya karena diskusi laporan ini. Tinjau implementasi kategori kas keluar yang sudah ada saat masuk tahap desain/pelaporan.

**PERSETUJUAN SOURCE TERSENDIRI:**
- Owner menyetujui **COMMIT LOKAL saja** atas tepat **10 file yang telah staged** di branch `feat/combined-payments-20261104`, berdasarkan hasil selective staging sebelumnya.
- Persetujuan ini **TIDAK mencakup** push, PR, merge, deploy, migrasi Cloud, aktivasi feature flags, reset/rebase atau perubahan file lain.
- Sebelum commit, pastikan indeks staging masih tepat 10 file sesuai checkpoint. Jika berubah, hentikan tanpa commit dan laporkan selisih.
- Setelah commit, catat SHA aktual dan status Git; jangan otomatis melakukan langkah berikutnya.


## CHECKPOINT COMMIT LOKAL & KONSEP KAS KELUAR BERTINGKAT — 5 NOVEMBER 2026

### Selesai: satu commit source lokal
- **Laporan Codex:** commit lokal `3a8dd60e8337a9fb2f222fbdd81e6fba36e26245`, pesan `feat: add guarded atomic combined payments`, branch `feat/combined-payments-20261104`, **ahead 1 dari origin/main**.
- Tepat **10 file** yang telah disetujui Owner berhasil di-commit. Runner sementara dan dua `.bak` tetap untracked, tidak ikut commit.
- Semua hasil PASS lokal sebelumnya tetap berlaku sesuai batasnya; **tidak ada pengulangan runtime tes**, push, PR, Cloud write, migrasi, deploy, atau aktivasi feature flag.
- **Pekerjaan berikutnya:** pastikan scope perubahan source dan keselamatan integrasi; **minta keputusan Owner terpisah** sebelum melakukan push branch dan membuka PR. Tidak otomatis merge atau mengubah produksi.

### Konsep Form Kas Keluar — keputusan arah dari Owner, detail belum final
- Owner menghendaki **dua kategori tingkat pertama:** **Biaya Operasional** dan **Prive**.
- Ketika **Prive** dipilih, tampilkan subkategori/penerima: contoh **Owner**, **Istri Owner**, **Anak Owner**, dan **Lainnya**. Ini menandai tujuan pengambilan pribadi, **tetap seluruhnya masuk kelompok Prive** dan bukan biaya operasional.
- Owner mengusulkan **Biaya Operasional juga memiliki subkategori** supaya laporan dapat memisahkan jenis biaya. Daftar final belum diputuskan; contoh untuk pembahasan: listrik/air/internet, laundry, amenities, kebersihan, maintenance, gaji, perlengkapan dan lain-lain.
- Resepsionis mencatat **Cash keluar dari laci** dengan kategori, nominal, tanggal/waktu, operator, sesi kas, deskripsi, dan audit sesuai kemampuan sistem yang ada. QRIS masuk langsung Owner dan tidak otomatis menjadi Prive.
- **STATUS:** konsep desain/kategori berjenjang **DIUSULKAN OWNER / BELUM DIIMPLEMENTASIKAN**, belum memerintahkan Codex mengubah Finance. Cek kategori kas keluar existing sebelum membuat schema/flow baru; jangan mengubah keputusan keuangan historis.
- Klasifikasi akuntansi harus memisahkan pembelian aset, pembayaran pinjaman, refund dan transaksi lain yang bukan biaya operasi rutin; jangan memaksakan semua pengeluaran bisnis masuk biaya rutin. Konsultasikan pemetaan final sebelum laporan investor/bank.


## UPDATE OWNER — PUSH BRANCH DIIZINKAN & IDE KAS KELUAR DISETUJUI (5 NOVEMBER 2026)

- **PERSETUJUAN OWNER:** push **branch lokal** `feat/combined-payments-20261104` yang memiliki commit source `3a8dd60e8337a9fb2f222fbdd81e6fba36e26245` ke GitHub remote **diizinkan**. Lingkup izin **push branch ini saja**; **TIDAK** termasuk create PR, merge, Cloud migration, deploy, publish, reset, atau mengaktifkan feature flag produksi. Sebelum push periksa branch/commit SHA dan target remote yang benar, tanpa men-stage runner `.ps1` maupun dua file `.bak`.
- **Ide desain Form Kas Keluar dua tingkat disetujui Owner**, simpan sebagai referensi kerja Lovable: [IDE_REVISI_DESAIN_FORM_KAS_KELUAR_2026-11-05.md](./IDE_REVISI_DESAIN_FORM_KAS_KELUAR_2026-11-05.md). Dua kategori utama **Biaya Operasional** dan **Prive**; Prive memiliki penerima **Owner, Istri Owner, Anak Owner, Lainnya**; Biaya Operasional memiliki subkategori jenis biaya. Status: konsep disetujui, **belum diimplementasikan**.
- **TARGET TETAP:** 100% Siap Operasional Sementara. Sesudah push terverifikasi, lanjut penilaian jalur integrasi dan deployment yang memang belum PASS, bukan ulang Finance/concurrency/auth lokal. Pekerjaan desain dilakukan nanti saat workspace Lovable tersedia.


## CHECKPOINT PUSH TERVERIFIKASI — 5 NOVEMBER 2026, 00:49 WIB

- **PUSH SUKSES** ke GitHub remote branch [`feat/combined-payments-20261104`](https://github.com/sk25ciwastra-blip/pixel-perfect/tree/feat/combined-payments-20261104), SHA **`3a8dd60e8337a9fb2f222fbdd81e6fba36e26245`**. Diverifikasi langsung melalui GitHub connector; **tepat 10 file implementasi/permanent tests** dalam commit tersebut.
- Runner sementara `scripts/combined-payments-runtime-test.ps1` dan dua `.bak` **tidak ikut commit/push**, masih untracked lokal. Tidak ada force push, PR, merge, Cloud write/deploy/migration atau feature flag ON.
- Perbandingan GitHub `main...feat/combined-payments-20261104`: status **diverged**, branch fitur **ahead 1, behind 21**. Merge-base terdeteksi `34d9df68f411357223ea1399e10ec9bc3efd1c1b`. File beda yang terlapor tetap **10 file sesuai izin Owner**. Jumlah commit tertinggal dapat berubah jika `main` bergerak. **Jangan rebase, merge, force push atau mengulang uji PASS hanya karena hitungan ini.**
- Pencarian PR berdasarkan branch tersebut: **tidak menemukan PR**. Izin Owner baru sampai push; **create PR memerlukan persetujuan terpisah**.
- **LANGKAH UTAMA SELANJUTNYA:** review risiko sinkronisasi dan siapkan satu **draft PR** dari branch yang telah di-push, tetapi hanya buat PR setelah persetujuan Owner. Setelah review, fokus preflight sistem aktif (read-only) dan gate menuju 100% Siap Operasional Sementara. Jangan membuat PR baru jika sudah ada; verifikasi state dahulu.
