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
