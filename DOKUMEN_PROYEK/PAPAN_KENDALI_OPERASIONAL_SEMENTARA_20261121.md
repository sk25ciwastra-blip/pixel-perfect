# PAPAN KENDALI EKSEKUSI — SIAP OPERASIONAL SEMENTARA
**Baturaden 25 Homestay | 21 November 2026 WIB | DRAF KENDALI, bukan status GO**

## 0. Sumber dan disiplin pembuktian
- **Roadmap awal yang TIDAK boleh diganti:** Library `ROADMAP_MASTER_BATURADEN_25_HOMESTAY_V1_0.txt`, checkpoint **10 Oktober 2026**, tujuh TAHAP. Struktur tetap **TAHAP → FASE → TUGAS**. Status **SELESAI/BERJALAN/BELUM/TERTAHAN**; progres resmi = tugas SELESAI ÷ total tugas terdaftar × 100%. Progres checklist **BUKAN kesiapan produksi**.
- Serah terima resmi `SERAH_TERIMA_WORK_BATURADEN_25_HOMESTAY_2026-11-17.md` di Library, checkpoint November, dan `DOKUMEN_PROYEK/{01_BUKU_INDUK,02_ATURAN_BISNIS,03_STATUS_FITUR,04_RIWAYAT_PERUBAHAN,05_ARSITEKTUR_SISTEM}.md` di GitHub.
- Bukti terbaru mengungguli status historis yang belum dimutakhirkan. **Jangan menghitung ulang 7 tahap dari dokumen 10 Oktober seolah tidak ada hasil sejak itu.**
- **KOREKSI:** klaim `65% GO` pada 21 Nov 2026 dicabut; tidak ada pembilang/penyebut resmi. Angka **6/6** hanya hasil kategori tes akun, bukan total aplikasi.
- Bukti wajib per tugas: nama fungsi/tombol, peran, lingkungan, kode/commit, langkah tes, hasil PASS/FAIL/BLOCKED, data sebelum-sesudah bila ada, bukti screenshot/log, tanggal, nama penanggung jawab.

## 1. Fakta yang telah diverifikasi — JANGAN ulangi
| Fakta | Bukti | Status |
|---|---|---|
| Repository asli `sk25ciwastra-blip/pixel-perfect` dan Lovable source menunjuk commit sama | GitHub `main` dan Lovable latest_commit_sha: `acb8ff57cc7b5d6aafd96cda7eb1912e669a4a96` | **PASS source sync**; bukan bukti deployed published build sama |
| Dua staf asli terdaftar, profil/foto Auth ada, login browser kedua berhasil, menu basic disetujui Owner | `B25EMP-001` Supervisor dan `B25EMP-002` Receptionist; screenshot Owner dan LIVE SELECT | **PASS daftar/login/menu basic** |
| Pembatasan Owner-only Supervisor sudah merged | PR #94, main merge `acb8ff5`; tests+build+tsc PASS | **PASS code**, browser URL negative still not exhaustively tested |
| Storage `employee-photos` ada, limit 2 MiB, dua foto asli ada | LIVE SELECT | **PASS**; upload awal gagal karena file >2MiB, bukan cacat tombol tambah |
| Live transaksi masih DEMO dan tidak ada transaksi/pembayaran baru sesudah 20 Nov 00:00 WIB | 17 transaksi, 24 pembayaran, 19 tamu, 5 sesi kas (2 OPEN), 4 occupied DEMO; 23 tabel operasional 102 baris | **PENDING selective reset** |
| Karyawan DEMO masih ada (Owner menyatakan semua 11 DEMO) | 11 legacy employees, 9 sesi Auth lama; 2 staf asli tetap dilindungi | **PENDING revoke akses sebelum GO**; hapus akun dapat ditunda |
| Backup terbaru yang terlihat masih sebelum pendaftaran dua staf asli | Export `pixel-perfect-homestay-hub_261120.backup` 21 Nov 03.47 WIB; permintaan lain ditolak batas 24h | **BLOCKED untuk reset massal** sampai backup pasca-pendaftaran tersedia |
| Lovable credits habis | Lovable project status `needs_attention/out_of_credits` | **Keterbatasan AI Lovable**, bukan bukti semua fungsi aplikasi offline |
| 28 PR masih OPEN (27 DRAFT; #93 READY) | GitHub API pulls state=open, 21 Nov | **Backlog harus dikonsolidasikan**, bukan 28 permintaan merge beruntun |

## 2. Pemetaan roadmap asli 7 TAHAP ke kondisi sekarang
| Tahap asli | Bukti kemajuan yang ada | Gap konkret untuk operasional sementara |
|---|---|---|
| 1. Baseline Cloud & keamanan transaksi | GitHub/Lovable source sinkron; Auth dan sebagian ACL diperiksa | Pastikan versi deploy & RPC/guard kritis pada LIVE; bukan ulang setup Staging |
| 2. Booking/transaksi/pembayaran | Source booking/Walk-in, nomor TRX, pembayaran, tes lokal/pilot DEMO terdokumentasi | Uji tombol **aktual** hingga Booking→Check-in same TRX dan idempotency tanpa duplikasi |
| 3. Katalog paket/harga | 9 paket, 5 tipe kamar di LIVE; form weekday/weekend ada | Bukti harga/DP/extra guest aktual pada jalur yang diaktifkan; gate feature flags |
| 4. WIB/kalender/waktu | Source WIB dan overtime; 4 kamar DEMO muncul overtime di screenshot | Uji batas Pagi/Malam/Harian dan overtime 120 vs >120 menit pada UI + RPC live |
| 5. Kamar/dashboard/Housekeeping | 12 room LIVE; navigasi 5 bagian HK tersedia di **current main source**; PASS lokal lama | Bukti Checkout→dirty→cleaning→checklist→READY sekali tanpa jalur override |
| 6. Sesi kas/komisi | Source Finance dan tes isolated sebelumnya, Owner rules closing minus fixed | Uji LIVE open/assist/closing minus/refund/identitas operator tanpa transaksi ganda |
| 7. Karyawan/laporan/integrasi/rilis | Akun asli, login, access basic PASS; PR #94 merged; receipt code ada | Uji laporan/receipt 58mm/publish/rollback; checklist Owner GO |

**Status tabel di atas bukan angka Tahap terkini**, karena setiap TAHAP harus direkonsiliasi per TUGAS dengan bukti sebelum sah dihitung. Dokumen `03_STATUS_FITUR.md` mengandung snapshot status lama (Okt/Nov) dan bukan status runtime saat ini.

## 3. SATU JALUR KRITIS — mulai dari apa yang gagal nyata

### P0-01 — Inventaris tombol/halaman pada Preview yang benar-benar dipakai [BELUM]
- **Owner hasil akhir:** Work QA + Londo. Codex tidak diminta audit source ulang.
- **Cakupan:** Dashboard (aksi cepat Check-in, Reservasi, Expense, Check-out), Kamar, Booking, Transaksi/Detail, Tamu, Housekeeping (Status/Tugas Petugas/Perlengkapan/Perawatan/Riwayat), Keuangan (buka/assisted session, expense, closing, refund), Laporan, Pengaturan Keamanan, Receipt & PDF.
- **Uji awal non-destruktif:** navigasi, keterlihatan tombol, role gating, input, pesan disabled/error; hindari `Simpan` yang membuat transaksi/pembayaran nyata sampai skenario terkontrol disepakati.
- **Output wajib:** tabel `ID | halaman/tombol | role | langkah | hasil PASS/FAIL/BLOCKED | screenshot/log | dugaan penyebab | pemilik perbaikan`.
- **Gate selesai:** seluruh tombol P0 tercatat dengan bukti; tiap FAIL punya **tepat satu** tugas perbaikan yang jelas. Tidak mengarang bug dari screenshot tanpa tes.
- **Prioritas pertama:** hambatan fungsi yang menghalangi staf booking/check-in/check-out, bukan polishing desain.

### P0-02 — Satu batch perbaikan fungsi (bukan PR baru per klik) [BELUM]
- **Owner teknis:** Codex. **Reviewer/koordinator:** Londo. **Lovable:** hanya UI/design bila diperlukan.
- Gunakan bug FAIL dari P0-01, cocokan dengan issue/PR yang **sudah tersedia**. Prioritaskan PR #83 (paket integrasi lama, jangan merge buta), #75–#82 yang tumpang tindih, #90 (popup checkout), dan issue #58/#59/#60/#77/#78/#45/#19.
- Jangan membuat puluhan PR; satu paket perubahan kompatibel dengan **current `main` dan current Lovable SHA**, ditest fokus + build/typecheck.
- **Gate selesai:** perbaikan bergabung dengan izin Owner, tersinkron source, browser ulang **hanya FAIL yang berubah** dan menjadi PASS.

### P0-03 — Satu uji perjalanan operasional terkontrol [BELUM]
- **Owner QA:** Work browser + Owner pengguna fisik; Codex memperbaiki hanya kegagalan yang ditemukan; Londo cek data READ-ONLY.
- **Journey wajib:** Login Receptionist → buka sesi kas miliknya → Walk-in dan Booking DP sesuai syarat → same TRX saat Check-in → pelunasan → Check-out → kamar dirty → Housekeeping cleaning/checklist → READY → rekonsiliasi kas/Closing (termasuk minus) → refund sesuai peraturan Owner → struk 58 mm & PDF + copy labels.
- Tambahan terarah: Supervisor bantu sesi aktif tanpa mengubah pemilik kas; overtime tepat 120 vs >120; double occupancy/race; receipt per pembayaran.
- **Gate selesai:** setiap langkah memiliki hasil aplikasi + DB yang cocok, tanpa duplikasi; fitur yang wajib namun belum ON dinyatakan BLOCKED bukan PASS.
- **Jangan menjalankan uji finansial yang memutasi LIVE secara tidak sengaja**; butuh skenario data uji terkontrol dan izin spesifik Owner untuk transaksi uji.

### P0-04 — Data DEMO & security cutover [TERTAHAN: backup baru]
- **Target transaksi DEMO:** 17 transaksi, 24 pembayaran, 5 sesi kas, 19 tamu, dan seluruh relasi di 23 tabel operasional yang sekarang 102 baris; **tidak cukup DELETE 17 transaksi**.
- Dua karyawan ASLI, dua foto, 11 akun lama, 4 Auth nonkaryawan, 12 kamar dan master config **tidak dihapus** pada scope transaksi-only.
- Backup terakhir sebelum dua staf asli; Lovable export terkena limit 24 jam; restore penuh belum teruji.
- **Gate selesai:** pasca-backup memuat dua karyawan asli, prosedur reset independen ditinjau; data 23 tabel sesuai target bersih tanpa ada sumber finansial menggantung, kamar DEMO tidak otomatis READY, config/akun/foto terjaga.
- Penghapusan akun DEMO boleh ditunda atas perintah Owner; **revocation akses/9 sesi Auth lama wajib sebelum GO**, gunakan Admin Auth resmi, bukan `DELETE auth.users` SQL. Alat percakapan pernah memblokir reset, jangan mengakali.

### P0-05 — Release acceptance & keputusan GO [BELUM]
- **Pemilik keputusan:** Owner. **Penerimaan teknis:** Work + Londo.
- Pastikan public deployment adalah build terverifikasi; tiga flag feature gate (combinedPayment, extraGuest, receipt58mm) status aktifnya diperiksa dan dinyalakan hanya sesuai persetujuan; hak akses Owner/Supervisor/Receptionist sesuai; printer 58mm fisik dicoba; SOP rollback dan data backup jelas.
- **Gate selesai:** laporan PASS/FAIL per perjalanan penting, data produksi bersih/aman, perangkat siap, persetujuan GO tertulis oleh Owner. Tidak menyamakan `git merge` dan publish.

## 4. Aturan pemilik kerja
- **Londo:** mengelola papan kendali, mengecek GitHub & Lovable source dan Cloud read-only, menghentikan duplikasi, mengintegrasikan bukti checkpoint; tidak menyuruh Owner klik banyak menu.
- **Codex:** implementasi fungsi/RPC, tes fokus, build/typecheck, PR konsolidasi; bukan desain ulang.
- **ChatGPT Work:** pengujian browser klik-per-klik dan laporan screenshot PASS/FAIL; tidak memakai password yang dibagikan ke chat dan tidak boleh melakukan transaksi nyata tanpa izin.
- **Lovable:** perubahan visual/design; credit AI habis, jadi bukan dependency kerja fungsi inti.
- **Owner:** hanya persetujuan Cloud/merge/publish dan penerimaan fisik yang benar-benar esensial.
- **Tidak ada pekerjaan baru otomatis** bila masalah sudah PASS; harus ada bug/FAIL baru yang dapat dibuktikan.
- **Staging dan PostgreSQL lokal bukan target operasi hari ini** kecuali Codex membutuhkan reproduksi bug; target pengujian fungsi adalah source Lovable dan project LIVE/Preview yang sama.

## 5. Papan status & checkpoint selanjutnya
- P0-01: **BELUM**, bukan PASS hanya karena source tampak lengkap. Langkah berikutnya: browser smoke non-destruktif dan inventaris gagal.
- P0-02: **BELUM**, bergantung P0-01. Pemecahan menjadi banyak PR dilarang.
- P0-03: **BELUM**, uji terkontrol setelah kontrol P0-01/P0-02; tes lokal lama tetap dihitung pada cakupannya.
- P0-04: **TERTAHAN**, memerlukan backup yang dibuat sesudah staf asli dan kemampuan pemulihan; jangan memakai dump lama.
- P0-05: **BELUM**.
- **PROGRES ROADMAP TERBARU: BELUM VALID UNTUK DIPERSENTASEKAN**, bukan 65%. Kesiapan GO: **NO-GO** sampai gate P0 semuanya selesai; status gate diisi satu per satu berdasarkan bukti.

## 6. Mandat sekali kirim kepada Work (tanpa tugas pecahan)
> Buka project Preview Baturaden 25 Homestay yang sudah terhubung ke GitHub `sk25ciwastra-blip/pixel-perfect`; gunakan sumber resmi `DOKUMEN_PROYEK` dan file papan kendali ini. **Kerjakan P0-01 saja sampai menghasilkan daftar tombol fitur P0 yang PASS/FAIL/BLOCKED**, melalui browser nyata role Owner, Supervisor dan Receptionist bila user memberikan akses login lewat mekanisme aman. Jangan meminta password di chat. Prioritaskan Dashboard aksi cepat, Kamar, Booking, Check-in, Checkout, Housekeeping checklist→READY, sesi kas, Refund, Receipt, Laporan, Pengaturan. Boleh klik/navigasi/membuka form, tetapi jangan menekan Simpan/Confirm yang menulis transaksi/uang dan jangan hapus DEMO, aktifkan SQL, publish, atau ubah akun tanpa izin spesifik. Untuk setiap FAIL lampirkan langkah reproduksi + pesan + screenshot dan kaitkan dengan issue/PR lama bila ada. Jangan mengulang suite yang PASS; serahkan **SATU MATRIKS FAIL PRIORITAS** ke Codex, bukan daftar audit tanpa ujung.

## 7. Ketentuan pembaruan papan kendali
Pada setiap hasil nyata, update hanya **status tugas + bukti baru + owner + blocker** di file ini. Tidak mengubah denominator secara diam-diam. Persentase Tahap/Fase/Tugas mengikuti daftar asli setelah mapping tugas dengan bukti yang disetujui; persentase siap GO tidak dipalsukan.
