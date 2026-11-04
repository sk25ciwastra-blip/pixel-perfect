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


## CHECKPOINT DRAFT PR #36 — 5 NOVEMBER 2026

- **Owner mengizinkan membuat satu Draft PR untuk review saja**; ChatGPT langsung membuat [Draft PR #36](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/36), judul `feat: guarded atomic combined payments (local PASS; Cloud OFF)`.
- GitHub memverifikasi status **open + draft=true + merged=false**; `base=main`, `head=feat/combined-payments-20261104`, head SHA **`3a8dd60e8337a9fb2f222fbdd81e6fba36e26245`**.
- Body PR menjelaskan sepuluh file scope, PASS lokal sebelumnya, ketiga gerbang flags default OFF, batasan generated Supabase Cloud types, risiko branch diverged, dan gate Cloud/restore/authorization. **Tidak ada merge, deploy, migrasi Cloud, publish, atau feature flags ON.**
- **NEXT:** review integrasi PR #36 dan gate kesiapan operasional; lakukan read-only atau local checks terarah berdasarkan masalah nyata; **jangan ulang seluruh Finance/concurrency/authorization PASS**. Minta persetujuan Owner sebelum tindakan berikutnya yang mutatif.


## CHECKPOINT INTEGRASI PR #37 DAN PREFLIGHT CLOUD — 5 NOVEMBER 2026 WIB (TERBARU)

**Status pekerjaan utama: REVIEW INTEGRASI LOKAL PASS; CLOUD GATE BLOCKED / BELUM DIOTORISASI.**

### Rekonsiliasi dan PR GitHub (bukti terverifikasi)
- Owner mengizinkan rekonsiliasi lokal terarah, push branch review terpisah, pembuatan Draft PR pengganti, dan penutupan PR lama. Tidak ada izin merge/deploy/Cloud migration.
- [Draft PR #37](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/37) **OPEN, DRAFT, NOT MERGED, GitHub mergeable=true**. Target `main`, head `review/combined-payments-integration-20261105`, SHA GitHub `6c3f8c7f00dbcc354da21992e43f29cd10938dea`.
- Branch baru dibuat dari `main` terkini (saat verifikasi **ahead 1, behind 0**). Sembilan file berbeda; file tes lama `scripts/extra-guest-receipt-pure-tests.cjs` yang telah dihapus di `main` tidak dihidupkan kembali. Tree SHA `6dc5c396f0bb593e3d4c03a7ec1969279cc5b4ab` cocok persis dengan tree commit lokal rekonsiliasi `048149efb110cbe1d2236110d095226260487256`. GitHub commit SHA berbeda karena komit dibuat via connector ketika Git HTTPS tidak tersedia, **bukan perbedaan isi tree**.
- [PR #36](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/36) telah diberi komentar **superseded by #37**, lalu **CLOSED, NOT MERGED**; riwayatnya tidak diubah. Sekarang satu Draft PR aktif untuk pembayaran gabungan.
- Hasil pengujian lokal rekonsiliasi: `tsc --noEmit` **PASS**, Vite production build client+SSR **PASS** (warning deprecation non-blocking), `scripts/fitur.test.ts` **7/7 PASS**, `scripts/tamu-tambahan.test.ts` **3/3 PASS**, `finance150-pure-tests.cjs` **PASS**, `git diff --cached --check` **PASS**. Konflik merge Git terselesaikan. PostgreSQL Finance/concurrency/Authorization/Training **PASS LOKAL SEBELUMNYA, TIDAK DIULANG**; bukan bukti PASS Cloud.
- Rekonsiliasi mempertahankan guard dari `main` yang menolak Extra Guest bila backend belum siap, sakelar Extra Guest/Receipt existing, dan tiga gerbang pembayaran gabungan **DEFAULT OFF**. Tidak ada aktivasi fitur.

### Pemeriksaan Supabase read-only (bukti proyek dan batas cakupan)
- Koneksi Supabase yang tersedia hanya mengidentifikasi proyek **Baturaden-25-Staging**, project ID `bgtztcfbkcrvcipxbfti`, PostgreSQL 17.11, status ACTIVE_HEALTHY. **Jangan menyamakan proyek ini otomatis dengan Cloud Lovable operasional.**
- Tool `list_migrations` mengembalikan sepuluh entri historis bernomor 20261019; ini **bukan bukti semua migrasi repo sudah terpasang**. Pemeriksaan katalog fungsi/tabel/kolom dilakukan dengan SQL SELECT read-only, tanpa DDL/DML.
- **ADA:** `calculate_package_stay_times`, `calculate_scheduled_booking_times`, `get_operational_day_mode`, `finance_is_booking_operator`, `finance_is_owner_or_supervisor`, tabel `finance_settings`, `payments`, `transactions`; `minimum_dp_mode/value` dan `payments.cash_session_id/idempotency_key`.
- **BELUM ADA pada staging ini:** `finance_training_session_is_valid(uuid,uuid)`, `finance_training_audit`, kolom `transactions.guest_count/extra_guest_count/extra_guest_unit_price/extra_guest_charge`, tabel `finance_payment_batch_idempotency`, serta empat RPC gabungan/training gabungan baru. Empat RPC dan tabel batch memang belum diharapkan sebelum migrasi gabungan, tetapi **fungsi Training dan kolom Extra Guest adalah dependensi prasyarat**.
- Kesimpulan: **JANGAN menjalankan `20261104000000_atomic_combined_payments.sql` langsung pada staging ini**. Terdapat ketidaksiapan dependensi; status migrasi dan izin aktual pada database Lovable yang akan dipakai tetap **NOT VERIFIED**.

### Satu pekerjaan berikutnya — fokus kritis, tanpa mengulang PASS
**REKONSILIASI READ-ONLY dependensi dan urutan migrasi Cloud pada proyek yang benar:** verifikasi identitas database Lovable operasional, bandingkan katalog/migration history dengan `20261018000000_finance_training_enforcement.sql`, migrasi Extra Guest/Receipt yang relevan, dan `20261104000000_atomic_combined_payments.sql`; identifikasi urutan, RLS/ACL, generated RPC types, serta rencana rollback sebelum meminta izin Owner untuk Cloud write. **Tidak boleh merge #37, migrasi Cloud, deploy, publish, mengaktifkan tiga flags, atau menyatakan Siap Operasional Sementara tanpa gate dan persetujuan terpisah.**

### Ide Owner tetap di antrean (bukan pekerjaan Codex otomatis)
- [Form Kas Keluar](./IDE_REVISI_DESAIN_FORM_KAS_KELUAR_2026-11-05.md): kategori **Biaya Operasional** dan **Prive** dengan subkategori bertingkat, **DISETUJUI OWNER / BELUM DIIMPLEMENTASIKAN**, untuk Lovable saat workspace tersedia. Diskusi desain tidak mengubah prioritas operasional.


## CHECKPOINT IDENTITAS CLOUD DAN PRASYARAT MIGRASI — 5 NOVEMBER 2026 WIB (READ-ONLY)

- **Identitas resmi staging menurut dokumen Owner:** `Baturaden-25-Staging`, ref `bgtztcfbkcrvcipxbfti` (tersedia lewat koneksi Supabase, PostgreSQL 17.11). Namun **file `.env` dan `supabase/config.toml` yang di-track Git pada repo menunjuk `ijujmxhcifuerkllbbgq`**, ref lama yang dalam arsitektur resmi dinyatakan **tidak digunakan**. Client aplikasi membaca `VITE_SUPABASE_URL` saat build. **Jangan ubah konfigurasi otomatis** sebelum workspace Lovable, target build/deploy, dan identitas Cloud tujuan diverifikasi. Jangan mengungkap key/credential.
- **Status historis repo:** migrasi `20261022000000_extra_guest_receipt_foundation.sql` pernah ada (riwayat commit `318c84a`, juga `77671cd`), tetapi **tidak ada dalam tree `main` saat pemeriksaan ini**. Migrasi `20261018000000_finance_training_enforcement.sql` masih ada di `main`. Jangan menganggap file yang hilang berarti telah diterapkan pada Cloud.
- **Bukti SQL SELECT katalog staging:** `finance_reservation_idempotency` tersedia; `finance_training_assignments`, `finance_training_audit`, `receipt_template_versions`, `payment_receipts`, `receipt_print_requests` belum tersedia; `transactions.guest_count`, `extra_guest_count`, `extra_guest_unit_price`, `extra_guest_charge` belum tersedia. `finance_training_session_is_valid(uuid,uuid)` belum ada; empat RPC combined dan tabel batch belum dipasang.
- **Dependency minimum dari file migrasi sumber:** `20261022000000_extra_guest_receipt_foundation.sql` menambahkan kolom Extra Guest dan tabel Receipt, bergantung pada Booking/Finance foundation; `20261018000000_finance_training_enforcement.sql` menyediakan assignment/audit dan validator sesi Training; `20261104000000_atomic_combined_payments.sql` bergantung pada objek dari keduanya. Urutan konseptual **Finance foundation → Training enforcement + Extra Guest/Receipt (dengan seluruh hardening terkait dan urutan resmi) → combined payment**, bukan instruksi eksekusi. Periksa lagi seluruh migrasi turunan, ACL/RLS, signature, data existing dan backup/restore sebelum menyusun batch final.
- **Gate tetap BLOCKED:** backup/restore staging telah tercatat belum PASS dalam dokumen arsitektur, dan identitas Cloud Lovable yang akan dipakai belum terverifikasi sama dengan staging. Jangan menjalankan SQL DDL/DML, `db push`, `migration repair`, merge PR #37, deploy, publish atau menyalakan flags.
- **Satu pekerjaan berikutnya:** pemeriksaan read-only project target build/Lovable yang benar dan rekonstruksi daftar migrasi resmi yang hilang dari `main` beserta dependensi/risiko, lalu rencana preflight/restore yang perlu persetujuan Owner. Jangan mengulang pengujian Finance/Authorization lokal yang PASS.


## INVENTARIS MIGRASI HISTORIS YANG HILANG DARI MAIN — 5 NOVEMBER 2026 WIB (READ-ONLY)

Pemeriksaan `git log --all --name-only -- supabase/migrations` dibandingkan `git ls-tree -r main supabase/migrations`, lalu isi dan preflight SQL sumber dibaca tanpa eksekusi:

| File historis tidak ada di main | Bukti commit sumber | Peran & catatan gate |
| --- | --- | --- |
| `20261022000000_extra_guest_receipt_foundation.sql` | `318c84a`, `77671cd` | Kolom Extra Guest, snapshot transaksi, Receipt foundation + RPC; tergantung Booking/Finance foundation |
| `20261022000001_receipt_thermal_58mm.sql` | `ef1df71`, `77671cd` | Receipt 58 mm, tabel template/payment receipts/print requests; ada overlap DDL dengan 00000, perlu telaah versi/urutan dan bukan replay membabi buta |
| `20261022000003_extra_guest_receipt_hardening.sql` | `3dc410a`, `38511e8` | Preflight kontrak Booking + Training wrapper, receipt objects, konsistensi snapshot, perbaikan ACL; menyisakan legacy RPC untuk fase transisi |
| `20261022000004_revoke_legacy_rpc_execute.sql` | `9357feb`, `38511e8` | **BERISIKO / GATE OWNER TERPISAH**: mencabut EXECUTE aplikasi dari signature legacy; komentar sumber secara eksplisit meminta SELECT-only caller preflight dan approval Owner sebelum run |
| `20261103000000_owner_final_standard_p4_prices.sql` | `b5a7366`, `7fe4f3b` | Harga Standard P4 Owner-final, domain price; verifikasi data katalog dan gate bisnis sebelum run, jangan diasumsikan sekadar dependensi otomatis combined payment |

Masih **ada di main**: `20261018000000_finance_training_enforcement.sql` dan `20261022000002_booking_time_dashboard_enforcement.sql`; keberadaan file repo **bukan** bukti penerapan di Cloud. Migrasi `20261104000000_atomic_combined_payments.sql` ada pada branch/PR #37 dan belum di Cloud.

**Urutan rekonsiliasi konseptual**: identitas target yang benar dan backup/restore → snapshot katalog + migration history → fondasi Finance/Training → Extra Guest/Receipt foundation/58mm dan hardening yang dipilih secara selektif → caller preflight untuk revoke legacy terpisah → pembayaran gabungan → generated RPC types, smoke test dan aktivasi flags hanya bila Owner mengizinkan. Ini **BUKAN daftar `db push` atau perintah eksekusi langsung**, dan tidak berarti semua lima file perlu dipasang apa adanya; overlap 00000/00001 dan sejarah perubahan harus ditinjau.

**Batas izin:** Read-only saja untuk staging `bgtztcfbkcrvcipxbfti`; konfigurasi aplikasi masih mengarah ke ref lama `ijujmxhcifuerkllbbgq`. Jangan ubah ref/env, migrasi, revoke, merge #37, deploy, publish, atau aktivasi flag tanpa keputusan Owner dan bukti target Lovable yang benar.

**Satu langkah berikutnya:** periksa source/migration signatures dan caller-dependency yang masih memakai legacy RPC serta susun matriks SELECT-only preflight untuk target staging yang benar, lalu bereskan backup/restore sebelum meminta persetujuan Cloud write. Hindari mengulang pengujian PASS lokal.


## CHECKPOINT PEMANGGIL RPC LEGACY — 5 NOVEMBER 2026 WIB (SELECT-ONLY)

**Cakupan pemeriksaan:** source code aktif PR #37 (Form Pemesanan, Booking, RPC adapter), generated Supabase types, file rekonsiliasi historis, dan katalog fungsi/privilege staging resmi `bgtztcfbkcrvcipxbfti`. Tidak ada perubahan kode, data atau izin.

- **Pemanggil aktif pada UI:** `src/components/formulir-pemesanan.tsx` memakai `create_reservation` / `create_training_reservation` dengan `_idempotency_key`, `_session_id`, dan data formulir; `src/routes/booking.tsx` memakai `record_transaction_payment` / `record_training_transaction_payment` dengan lima argumen (`_transaction_id`, `_amount`, `_method`, `_idempotency_key`, `_session_id`). Ketika kedua metode dan tiga flag pembayaran gabungan ON, jalur menggunakan RPC `*_combined`; flag tetap default OFF.
- **Generated TypeScript masih memiliki overload legacy** (create_reservation 10-arg, record_transaction_payment 3/4-arg), tetapi keberadaan tipe tidak membuktikan ada caller aktif. File `drizzle/migrations/0005_booking_checkin_payments_and_duration.sql` dan `supabase/reconciliation/finance150_staging_reconciliation_review.sql` memuat referensi historis lama, bukan pemanggil browser runtime.
- **Katalog SQL staging saat cek:** `create_reservation` hanya signature 12-parameter (with idempotency/session), `record_transaction_payment` hanya 5-parameter. `has_function_privilege('anon', oid, 'EXECUTE')=false`, `authenticated=true` untuk keduanya. `create_training_reservation`, `record_training_transaction_payment`, `get_finance_training_context` **belum ada** pada staging. Signature legacy 10/3/4 **tidak tampak di katalog staging**.
- **Status:** `PASS` untuk inventaris source caller yang diinspeksi + ACL dua fungsi staging; **NOT VERIFIED** untuk caller eksternal (Lovable workspace yang berbeda, aplikasi yang telah di-deploy, integrasi di luar repo) dan untuk database operasional Lovable sebenarnya. Tidak ada bukti untuk menjalankan `20261022000004_revoke_legacy_rpc_execute.sql`; pada staging saat ini preflight migrasi itu sendiri akan terhalang oleh kontrak Training yang belum tersedia.
- **Gate:** Jangan mencabut signature/izin, mengubah generated types, atau mengaktifkan flags. Tidak ada urgensi revoke legacy pada staging ini dari dua signature lama yang memang tidak ditemukan. Jangan menganggap repo `.env` yang menunjuk ref lama sebagai identitas proyek aktif tanpa verifikasi deployment.
- **Satu pekerjaan berikutnya:** verifikasi target runtime Lovable/hosting dengan akses resmi secara read-only, lalu lakukan matriks kontrak RPC target itu dan backup/restore preflight; baru susun proposal migrasi forward-only selektif dengan persetujuan Owner. Fokus tetap 100% Siap Operasional Sementara.


## CHECKPOINT IDENTITAS LOVABLE TERHUBUNG — 5 NOVEMBER 2026 WIB (READ-ONLY)

- Lovable connector mengembalikan **satu workspace yang dapat diakses**: `Kozan's Lovable`, ID `a9e820a62a1e7cf0822a` (role pada koneksi: owner). Di dalamnya terdapat proyek `Pixel Perfect Homestay Hub`, ID `017f6e78-15f2-4d07-a38c-87cb185279bf`, [editor](https://lovable.dev/projects/017f6e78-15f2-4d07-a38c-87cb185279bf). Deskripsi proyek cocok dengan aplikasi pengelolaan homestay, namun **jangan otomatis menyamakan workspace ini dengan workspace kerja/sementara yang sedang menunggu respons pemilik**.
- `lovable_get_project`: project status ready, agentFinished=true, is_published=true; `latest_commit_sha=e0571f9e45e6ff03c0bc91d2d7130babe24622bf`, cocok dengan commit checkpoint GitHub yang pernah diperiksa. Ini **bukti hubungan versi kode** pada titik tersebut; **bukan bukti published build memakai commit terbaru atau bahwa branch PR #37 telah terpasang**.
- `lovable_get_database_status`: `enabled=true`, `stack=supabase`. Tool **tidak mengembalikan Supabase project ref/URL database**. Project ref runtime yang sedang dipakai tetap **NOT VERIFIED**, terutama karena repo `.env`/`supabase/config.toml` menunjuk ref lama `ijujmxhcifuerkllbbgq` sementara staging resmi Owner `bgtztcfbkcrvcipxbfti`.
- Koneksi Lovable hanya diperiksa **read-only**. Tidak ada perubahan workspace, project settings, koneksi GitHub/Supabase, kode, publish, deploy, atau migrasi. Keterangan `is_published=true` tidak berarti sudah lulus uji operasional atau diperbarui.
- **Satu blocker berikutnya:** konfirmasi identitas database runtime yang benar dari pengaturan Cloud/project Lovable resmi (tanpa membagikan API key/password) dan kaitannya dengan workspace tujuan. Setelah itu lanjut pemeriksaan migrasi + backup/restore hanya pada target yang terverifikasi, dengan izin Owner terpisah untuk Cloud write.


## KONFIRMASI OWNER — IDENTITAS WORKSPACE PRIBADI LOVABLE (5 NOVEMBER 2026 WIB)

- **OWNER MEMASTIKAN:** Workspace Lovable `Kozan's Lovable` (ID `a9e820a62a1e7cf0822a`) adalah **WORKSPACE PRIBADI OWNER**. Proyek di dalamnya bernama `Pixel Perfect Homestay Hub` (ID `017f6e78-15f2-4d07-a38c-87cb185279bf`), [editor](https://lovable.dev/projects/017f6e78-15f2-4d07-a38c-87cb185279bf).
- **Jangan keliru** menganggap workspace pribadi ini sebagai workspace kerja/sementara. Status akses, pemilik, kesiapan desain, dan tahap serah-terima workspace kerja/sementara **belum diverifikasi/masih menunggu** sesuai checkpoint sebelumnya.
- Konfirmasi identitas **BUKAN persetujuan untuk memindah proyek, reconnect GitHub/Supabase, mengganti env/ref, merge, migrasi, deploy, publish, atau mengaktifkan fitur**.
- Status database runtime proyek pribadi masih **NOT VERIFIED** walaupun Lovable melaporkan database enabled. Ref staging resmi Owner `bgtztcfbkcrvcipxbfti` berbeda dari ref lama yang tercatat dalam repo `ijujmxhcifuerkllbbgq`; jangan menyamakan keduanya.
- **Satu langkah berikutnya:** lanjutkan pemeriksaan read-only identitas Cloud runtime dari proyek pribadi dan tunggu konfirmasi workspace kerja/sementara sebelum mengatur serah-terima. Prioritas 100% Siap Operasional Sementara; jangan mengulang PASS lokal.


## BUKTI SCREENSHOT OWNER — DATABASE LOVABLE PRIBADI (5 NOVEMBER 2026 WIB)

Owner menyerahkan tiga tangkapan layar dari Cloud/Database/Settings proyek `Pixel Perfect Homestay Hub` di workspace pribadi `Kozan's Lovable`. Pemeriksaan hanya visual, **bukan query ke database Lovable**, dan tidak ada aksi UI mutatif.

- **Screenshot Pengaturan:** project name `Pixel Perfect Homestay Hub`, subdomain `pixel-perfect-homestay-hub`, owner tampak `Kozan 25 Ciwastra`. Tidak menampilkan project reference Supabase.
- **Screenshot Database:** ada tabel `finance_training_assignments` (0 rows), `finance_training_audit` (0 rows), `finance_cash_sessions` (2 rows), `finance_settings` (1 row), `finance_reservation_idempotency` (3 rows), `finance_expenses` (2 rows), dan tabel Finance/Housekeeping/Guests lain. Ini **membuktikan objek Training tertentu terlihat pada Lovable Cloud pribadi**, berbeda dari temuan katalog Supabase staging `bgtztcfbkcrvcipxbfti` yang tidak memiliki tabel Training. Tidak membuktikan seluruh RPC, RLS, atau pengamanan sudah PASS.
- **Screenshot Backups:** UI menampilkan daftar backup harian, contoh 3, 2, 1 November 2026 dan tanggal-tanggal sebelumnya, beserta tombol restore. **Jangan tekan Restore.** Adanya daftar backup **tidak membuktikan** dump dapat dipulihkan penuh, status PITR, atau rollback sudah PASS.
- **Kesimpulan target:** Cloud Lovable pribadi dan proyek staging konektor Supabase memiliki **kondisi skema berbeda**. Ref database runtime Lovable tidak ditampilkan di screenshot; statusnya tetap **NOT VERIFIED**. Jangan mengubah `.env`, `supabase/config.toml`, koneksi, menjalankan migrasi, atau deploy berdasarkan dugaan kecocokan ref.
- **Langkah berikutnya:** gunakan akses read-only Lovable yang ada untuk inventaris tabel/kontrak RPC bila alat dapat menyediakannya, atau minta hanya identitas ref melalui pengaturan resmi jika tersedia; cocokkan dengan staging sebelum menyusun rencana Cloud. Tidak mengulang Finance/Auth lokal yang PASS.


## GATE AKSES BROWSER LOVABLE — 5 NOVEMBER 2026 WIB

- Owner mengizinkan **pemeriksaan browser read-only** pada proyek Lovable pribadi `Pixel Perfect Homestay Hub`. Cloud Browser membuka editor project ID `017f6e78-15f2-4d07-a38c-87cb185279bf` tetapi menampilkan **`You don't have access`**, meminta login ke akun berizin. Browser ini belum memiliki sesi login yang sama dengan konektor Lovable.
- **Tidak dilakukan login**, input credential, akses secrets, perubahan Cloud/project, pindah workspace, restore, deploy, publish, atau migrasi. Jangan mengulang membuka UI browser dalam kondisi sama tanpa sesi auth yang sah/izin baru.
- Konektor Lovable masih memberi status project ready + database enabled (stack supabase), tetapi **tidak menyediakan project ref**. Screenshot Owner menunjukkan Finance/Training tables dalam Cloud Lovable pribadi, namun ref runtime tetap belum terbukti. Katalog staging Supabase yang tersedia adalah lingkungan lain dengan skema berbeda.
- **Status: BLOCKED AUTH BROWSER / PROJECT REF NOT VERIFIED.** Langkah berikutnya hanya verifikasi ref melalui kanal resmi yang sah atau bukti Owner tanpa API key/password; lanjut pekerjaan teknis lain yang dapat dikerjakan aman sambil menunggu. PR #37 tetap Draft dan Cloud writes tidak diizinkan.


## AKSES BROWSER LOVABLE BERHASIL — VERIFIKASI READ-ONLY (5 NOVEMBER 2026 WIB)

- Owner telah login secara sah pada Cloud Browser; hambatan `You don't have access` **sudah teratasi** untuk editor proyek pribadi `Pixel Perfect Homestay Hub` (ID `017f6e78-15f2-4d07-a38c-87cb185279bf`). Status blocker **AUTH BROWSER** pada catatan sebelumnya kini **RESOLVED**. Ini tidak berarti izin Cloud write diberikan.
- Pemeriksaan langsung UI **Database** (bukan hanya screenshot): tabel `finance_training_assignments` dan `finance_training_audit` masing-masing 0 row; `finance_cash_sessions` 2 row; `finance_expenses` 2 row; `finance_settings` 1 row; `payment_receipts` 1 row; `receipt_print_requests` 2 row; `receipt_template_versions` 2 row; `payments` 16 row; `transactions` 12 row. Semua adalah keadaan tampilan saat pemeriksaan, **bukan hasil validasi SQL/RPC/RLS**.
- Menu **Database → Manage → Settings** dibuka tanpa perubahan. UI menampilkan lokasi **Asia Pacific (Tokyo)**, **PostgreSQL 17.6.1.166**, instance **Tiny · Shared CPU · Up to 0.5 GB RAM**, dan penggunaan storage **0.32 GB dari 2 GB**. UI juga menawarkan `Export data`, `Pause`, `Remove`; **tidak ditekan**.
- **Project ref database runtime masih NOT VERIFIED**: halaman pengaturan yang diperiksa tidak menampilkan Supabase project ref atau koneksi yang membuktikan kesamaan dengan `bgtztcfbkcrvcipxbfti` atau `ijujmxhcifuerkllbbgq`. Jangan mengasumsikan identitas dari wilayah/versi database ataupun data tabel.
- **Batas aman terjaga:** tidak membaca secrets/token, tidak menjalankan SQL, mengubah data, melakukan export, restore, pause, remove, reconnect, publish, deploy, atau migrasi. PR #37 tetap Draft. Pekerjaan selanjutnya: cari identitas ref resmi lewat jalur nonrahasia yang tersedia atau minta keputusan Owner bila diperlukan; hanya setelah target terbukti boleh menyusun gate migrasi berikutnya.


## LANJUTAN PENCARIAN IDENTITAS CLOUD — KONEKTOR LOVABLE (5 NOVEMBER 2026 WIB)

- Dalam browser terautentikasi pada proyek Lovable pribadi, navigasi **Konektor → Koneksi** diperiksa **read-only**. UI menampilkan **“Belum ada koneksi”** pada bagian **Koneksi proyek**. Tidak ada Supabase project ref yang disediakan melalui panel ini; database Lovable Cloud tetap muncul dalam tab Database tersendiri.
- Menu database **Manage → Settings** sebelumnya hanya menampilkan region, PostgreSQL, ukuran/storage, bukan ref. **Tidak boleh menyimpulkan** bahwa `bgtztcfbkcrvcipxbfti` atau `ijujmxhcifuerkllbbgq` adalah runtime personal Lovable berdasarkan informasi ini.
- Aktivitas editor Lovable untuk commit-commit **dokumentasi** yang disinkronkan dari GitHub menampilkan status **“Pembuatan gagal / Pratinjau sudah usang”**. Ini adalah status panel pratinjau untuk perubahan docs; **belum membuktikan** kegagalan build kode aplikasi atau kegagalan database. Jangan mengambil tindakan publish/build/revert hanya karena indikator tersebut.
- **Gate:** ref Cloud pribadi tetap NOT VERIFIED; tidak menjalankan SQL bahkan read-only, tidak membuka Secrets, tidak mengubah konektor atau kode. Jika jalur resmi nonrahasia tidak tersedia, hentikan pengejaran ref dan prioritaskan langkah siap operasional lain yang dapat diverifikasi aman. PR #37 tetap Draft.


## MONITOR DRAFT PR #37 — GATE GITHUB READ-ONLY (5 NOVEMBER 2026 WIB)

- PR [#37](https://github.com/sk25ciwastra-blip/pixel-perfect/pull/37) tetap **OPEN / DRAFT / UNMERGED**; head `review/combined-payments-integration-20261105` SHA `6c3f8c7f00dbcc354da21992e43f29cd10938dea`, base `main`; 9 file fitur, +1658/-82 terhadap basis lama. Tidak ada review/inline thread terdaftar.
- Compare GitHub pada saat pemeriksaan: branch fitur **1 ahead / 10 behind** `main`, status `diverged`. Sepuluh commit di `main` sejak merge-base hanya mengubah **satu file dokumentasi** `DOKUMEN_PROYEK/ARAH_KERJA_AKTIF_MENUJU_OPERASIONAL_SEMENTARA_2026-11-04.md`; bukan perubahan code fitur. File diff branch tetap 9 file yang tercatat di PR.
- `get_pr_info` saat ini melaporkan `mergeable=false`; **penyebab belum diverifikasi** (jangan menyebut pasti konflik kode). Combined commit status API melaporkan `statuses=[]`: tidak ada status CI yang tersedia dalam endpoint tersebut. Ini **bukan bukti CI PASS** atau tes FAIL.
- **Keputusan tindakan:** review/read-only saja. Tidak melakukan rebase, force push, merge, menjalankan ulang Finance/Auth yang sebelumnya PASS, migrasi Cloud, deploy, atau mengubah feature flags. Jika integrasi akan diajukan, perlu pengecekan penyebab mergeable=false dan persetujuan Owner terpisah sebelum perubahan branch atau merge.
