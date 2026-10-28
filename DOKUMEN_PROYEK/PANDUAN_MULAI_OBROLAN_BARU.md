# PANDUAN MULAI OBROLAN BARU — Baturaden 25 Homestay

**Checkpoint:** 28 Oktober 2026, malam WIB  
**Status:** Panduan kelanjutan proyek; bukan bukti bahwa fitur telah dideploy.  
**Sumber keputusan resmi:** dokumen dalam folder `DOKUMEN_PROYEK/`, terutama `01_BUKU_INDUK.md` dan dokumen aturan bisnis terkait. Jika ada ketidaksesuaian, periksa commit terbaru dan minta keputusan Owner; jangan diam-diam menimpa keputusan resmi.

## Cara memulai chat baru

Tempel kalimat berikut:

> HALLO LONDO, KITA LANJUTKAN PROYEK BATURADEN 25 HOMESTAY.  
> Buka dan baca https://github.com/sk25ciwastra-blip/pixel-perfect/blob/main/DOKUMEN_PROYEK/PANDUAN_MULAI_OBROLAN_BARU.md serta dokumen resmi lain di folder DOKUMEN_PROYEK.  
> Baca checkpoint paling baru, bedakan PASS lokal vs sudah live, jangan mengulang pekerjaan yang selesai, dan jangan mengubah desain yang sudah disetujui.  
> Codex hanya mengerjakan fungsi, Lovable mengerjakan desain. Lanjutkan dari blocker terakhir, satu langkah konkret setiap kali.

## Identitas proyek dan batas pekerjaan

- Nama lengkap wajib **Baturaden 25 Homestay**, jangan disingkat.
- Repository GitHub: `sk25ciwastra-blip/pixel-perfect`, Lovable project: `017f6e78-15f2-4d07-a38c-87cb185279bf`.
- Pembagian tugas resmi: **Codex = logika/fungsi/RPC/migrasi/pengujian**; **Lovable = desain, visual, layout, UI/UX**. Codex jangan merombak visual yang sudah disetujui.
- Perintah terminal selalu jelas: **PowerShell 1 (CODEX)** atau **PowerShell 2 (PIXEL)**.
- Motto Owner: **“jika ada yang mudah, kenapa harus sulit.”** Jangan ulang audit atau pekerjaan yang sudah PASS.
- Tujuan terdekat: siap operasional sementara setelah gate aman, belum go-live; data saat ini umumnya demo/testing.
- Persentase progres bila dilaporkan harus realistis, granular, dan sesuai lingkup; jangan menyamakan hasil uji lokal dengan aktif di Cloud.

## Lokasi kode & status repository (checkpoint 28 Okt 2026)

- Folder lokal lama berisi pekerjaan berbeda/dirty, **jangan langsung merge**: `C:\Users\USER\Documents\Codex\2026-10-02\codex-tolong-baca-dan-analisis-repositori\work\pixel-perfect-read`.
- Worktree integrasi bersih: `C:\Users\USER\Documents\Codex\2026-10-02\codex-tolong-baca-dan-analisis-repositori\work\pixel-perfect-sync`.
- Branch lokal integrasi: `integrasi-lovable-codex-20261028`; baseline sinkronisasi `origin/main` saat itu `0aeba8c`.
- Commit lokal integrasi: `77671cd` (Extra Guest + Receipt 58mm) dan `011ba0a` (RPC preflight).
- **Jangan mengira branch/commit lokal sudah di-push** atau diterapkan di Cloud. Verifikasi status Git terkini pada kelanjutan pekerjaan.

## Pekerjaan fungsi: sudah diuji lokal (bukan Cloud)

- Finance 150/aturan kas & komisi, Training Enforcement, Checkout Hardening, Extra Guest, Receipt 58mm, Booking Enforcement dan hardening: rangkaian migration dan pengujian lokal terisolasi **PASS sesuai cakupan tes**.
- Training Day 1 & Day 2: assignment, Supervisor sebagai pemilik sesi kas, trainee dilarang membuka sesi sendiri, identitas operator trainee terpisah dari pemilik sesi, audit `Training`, pembayaran/checkout setelah pelunasan, keamanan helper dan sesi tutup: **PASS lokal**.
- Extra Guest: dasar 2 orang per kamar; biaya tambahan Rp50.000/orang.
- Thermal receipt tetap **58 mm**, struk **per payment**, reprint tercatat; desain cetak tidak diganti menjadi 80 mm.
- Transisi RPC lokal: reservation 10→12/13 parameter dan payment 3/4→5 parameter; pengujian prosedur transisi dan gerbang hardening **PASS lokal**, kecuali catatan terpisah di bawah.
- TypeScript/build/pure tests telah PASS pada checkpoint sebelumnya; bukan klaim pengecekan ulang pada file yang belum dikomit.

### Patch RPC paling mutakhir — **belum di-commit**

Menurut laporan Codex terakhir, terdapat dua perubahan worktree:
1. `supabase/migrations/20261022000003_extra_guest_receipt_hardening.sql`: legacy signature hanya di-`NOTICE`, tidak lagi menggagalkan hardening dan **tidak mencabut akses legacy**.
2. `supabase/migrations/20261022000004_revoke_legacy_rpc_execute.sql`: forward-only, **tidak DROP function/data**, mencabut EXECUTE `PUBLIC/anon/authenticated` pada signature legacy 10/3/4 setelah memverifikasi kontrak baru dan Training; mempertahankan owner postgres.

Uji migration `00003` dengan legacy aktif **PASS-SAFE**; `00004` preflight/postcheck **PASS sebagian**. **Uji revoke aktual pada fungsi legacy hidup belum selesai** karena PostgreSQL disposable gagal restart (shared-memory recovery lock). Kedua perubahan **belum di-commit**; perlu review dan uji runtime final. Jangan menyatakan fitur ini sudah aktif.

### Gate Cloud — **BLOCKED, tidak boleh migrasi otomatis**

- Cloud Lovable masih memiliki legacy `create_reservation` 10 dan 12 parameter serta `record_transaction_payment` 3, 4, 5 parameter.
- RPC Training belum tersedia di Cloud; kontrak baru Extra Guest/Receipt belum diaktifkan.
- Audit read-only: tidak ditemukan fungsi internal `public` lain yang langsung memanggil kedua RPC lama; **caller frontend/eksternal belum terverifikasi**.
- Masih perlu verifikasi pemanggil eksternal, runtime revoke legacy, backup/restorability/PITR dan preflight Cloud sebelum persetujuan migrasi.
- Tidak ada deploy, push, merge, publish, perubahan data Cloud/Staging yang telah dilakukan dalam checkpoint integrasi ini.
- **Jangan samakan proyek staging Supabase dengan Cloud produksi Lovable.** Periksa ID lingkungan sebelum tindakan apa pun.

## Antrean desain Lovable — keputusan Owner (28 Okt 2026)

| No | Halaman / fitur | Status konsep | Status implementasi |
| --- | --- | --- | --- |
| 1 | Kirim Bukti Pembayaran Digital | **Konsep sudah ada/disetujui** | **Belum dikerjakan** |
| 2 | Booking | **Konsep revisi visual belum ada** | Jangan menganggap fitur Booking tidak ada; aturan fungsinya sudah didefinisikan |
| 3 | Housekeeping | **Konsep belum sempurna** | Perlu penyempurnaan terarah |
| 4 | Laporan | **Konsep desain sudah ada** | Belum dinyatakan terimplementasi sesuai konsep |
| 5 | Kamar | **Konsep revisi visual belum ada** | Aturan tipe kamar sudah ada |
| 6 | Tim & Akses | **Konsep belum ada** | Belum ada desain final |
| 7 | Pengaturan | **Konsep belum ada** | Belum ada desain final |

**Bukti Pembayaran Digital:** gunakan sketsa **pertama** invoice **horizontal putih–emas** dengan **logo bunga emas lama**; layout dua panel `Guest & Reservation Details` dan `Payment Summary`, invoice, PAID, payment history, footer. Format utama untuk WhatsApp **PNG** (PDF opsional). Sumber nominal/status harus satu dengan transaksi; pembukaan WhatsApp bukan bukti terkirim. **Jangan gunakan logo alternatif maupun mengubah layout sketsa.**

**Tampilan aplikasi:** hormati keputusan premium gelap–emas yang sudah disetujui. Dashboard saat ini dan fitur yang sudah cocok **jangan dirancang ulang**. Housekeeping tanpa foto kamar untuk daftar kamar; desain mengikuti koreksi Owner berikutnya. Laporan punya sketsa referensi yang harus dilihat sebelum implementasi.

**Penting:** status `konsep sudah ada` **bukan** status `sudah diimplementasikan`. Catat ide yang baru dibahas walau belum dilaksanakan. Arsipkan tautan referensi visual bila disediakan.

## Kebijakan dokumentasi dan pergantian obrolan

1. Tiap keputusan Owner, perubahan scope, hasil tes, patch, blocker, konsep baru, dan ide tertunda harus masuk dokumen proyek dengan tanggal dan status (`SELESAI/PASS LOKAL`, `DISETUJUI`, `KONSEP`, `TERTUNDA/BLOCKED`).
2. Jangan menimpa isi resmi atau membuka ulang pekerjaan selesai tanpa bukti regresi.
3. Setelah checkpoint penting, simpan pembaruan terarah di `DOKUMEN_PROYEK/` GitHub melalui commit dokumentasi tersendiri, tanpa mengubah kode. Poin yang belum diterapkan harus ditandai jelas.
4. Obrolan baru harus membaca dokumen terbaru **dan** memeriksa status repo/branch Cloud sebelum tindakan teknis; panduan ini sendiri tidak bisa membaca disk Windows pengguna.
5. Pastikan jangan mencantumkan secret, token, password, atau data pribadi tamu di dokumen GitHub.

**Checkpoint dokumen ini ditulis dari laporan Owner/Codex tanggal 28 Okt 2026; tidak menggantikan inspeksi kode dan database aktual sebelum perubahan berisiko.**
