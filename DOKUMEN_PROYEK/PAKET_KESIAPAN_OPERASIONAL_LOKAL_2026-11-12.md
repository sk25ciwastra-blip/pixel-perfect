# Paket kesiapan operasional lokal — 12 November 2026

Status: SELESAI LOKAL UNTUK REVIEW; BUKAN persetujuan GO-LIVE atau aktivasi Cloud.
Instruksi Owner dalam sesi ini mengungguli checkpoint historis. Tidak ada aturan
harga, DP, peran, Training, atau penggunaan Kamar 03 yang diubah.

## Baseline dan batas tindakan

- Repository: sk25ciwastra-blip/pixel-perfect.
- Workspace: `work/pixel-perfect-audit-20261112`.
- Baseline `origin/main`: `f33ea766eee0f89d110278dce7ad9646503e9df1`.
- Merge PR #39 terverifikasi pada log Git; commit HK `4838f6a` adalah ancestor.
- Branch kerja: `fix/operational-readiness-final-20261112`, dari origin/main.
- Working tree awal bersih; perubahan akhir sengaja belum staged/committed.
- RAM tersedia awal 7.549.366.272 byte; disk 4.937.097.216 byte.
- Tidak ada install/download. Package dependencies, devDependencies, dan bun.lock
  cocok dengan `pixel-perfect-sync`; dependency lokal diakses melalui junction
  per-package dalam node_modules yang diabaikan Git. Cache/output build tetap lokal.
- Tidak ada akses Cloud, perubahan kredensial/deployment, aktivasi flag,
  migrasi database, commit, push, PR, merge, deploy, atau publish.

## PASS lama yang dipertahankan, tidak dieksekusi ulang

- HK-09/HK-10: regresi pure A–L PASS; PR #39 merged.
- Housekeeping PostgreSQL: 16 assertion PASS; HK-11 PASS pure.
- Pembayaran gabungan PR #37 dan waktu aktual PR #38: mengikuti bukti Owner.
- Finance, refund, komisi, sesi kas, Training, concurrency/authorization:
  menggunakan checkpoint PASS yang ada.
- Pencarian TRX singkat: bukti preview Owner dipertahankan.
- Receipt pure sebelumnya dipertahankan; renderer 58 mm dari implementasi lokal
  sebelumnya dipakai kembali, bukan didesain ulang. Tes baru menguji wiring-nya.
- Metadata Cloud yang Owner nyatakan tersedia diterima sebagai checkpoint,
  bukan disamakan dengan hasil inspeksi Cloud oleh Codex pada sesi ini.

## Audit gap dan perbaikan

| Kelompok | Bukti gap aktual | Perbaikan / hasil |
|---|---|---|
| D1 Build | node_modules tidak ada di workspace awal | Gunakan dependency lokal dengan manifest/lock identik. TypeScript dan build dijalankan. |
| D2 Extra Guest | `extraGuestAktif` hanya menerima preview, sehingga tiga flag saja tidak pernah membuka host operasional | Pertahankan preview dan tiga gate; tambahkan daftar hostname eksak yang harus disetujui Owner. Default tetap kosong/OFF. |
| D3 Extra Guest + gabungan | Form menolak extra guest jika dua metode; payload gabungan tidak memuat `_guest_count` meski kontrak RPC sudah mendukungnya | Hapus penolakan khusus dua metode; teruskan jumlah tamu pada jalur normal dan Training. Guard fitur/sesi/DP tetap ada. |
| D3 Check-in | Nominal satu metode read-only diisi harga kamar saja, sehingga extra guest menyebabkan total tidak cocok dan tidak bisa diedit | Autofill total termasuk extra guest; perpindahan metode mengikuti total; nominal split tidak ditimpa resolver jenis hari. |
| D3 DP | Loading/error finance_settings tidak ikut kesiapan form | Sertakan kesiapan settings sebelum save. Minimum DP tetap dihitung dari total termasuk extra guest. |
| D4 Receipt | Tombol sukses check-in selalu disabled; receipt flag tidak dipakai untuk wiring cetak/riwayat | Sambungkan RPC yang ada ke kontrol cetak sukses check-in dan per-payment/riwayat di detail. Tidak ada auto-print atau cetak fisik palsu. |
| D4 Detail | Jumlah tamu hardcoded tidak tersedia; harga paket memuat total termasuk extra guest tanpa rincian | Tampilkan snapshot tersimpan dan rincian extra guest pada tabel yang ada; total tidak dihitung ulang sebagai aturan bisnis. |
| D4 Ringkasan WA | Ringkasan sukses memakai harga kamar dan metode pertama | Pakai total dan seluruh metode terpilih. WhatsApp tetap memerlukan klik kirim pengguna. |
| D5 Sesi kas | Detail membandingkan status dengan `open`, sedangkan schema/UI Finance memakai `OPEN` | Koreksi literal; sesi terbuka tidak lagi dilabeli Ditutup. |
| D5 Akun/otorisasi | Auth middleware, global auth-attacher, Owner guard dan pembatasan route/menu tersedia | Tidak ditemukan bukti blocker baru yang mengharuskan perubahan akun atau Finance. Ketersediaan env server perlu verifikasi operator tanpa mengekspos secret. |

Tidak ada redesign sidebar, logo, layout global atau warna/font. Kontrol receipt
ditambahkan hanya untuk wiring fungsi yang sebelumnya tidak tersedia. Kamar 03
tetap READY walau ada catatan perlengkapan; filter ketersediaan kamar dan RPC
Housekeeping tidak diubah.

## Flag: tidak diubah dalam paket ini

Semua gate di `feature-flags.ts` tetap mensyaratkan nilai persis `true`:

- Combined: `VITE_FEATURE_COMBINED_PAYMENT`,
  `VITE_FEATURE_COMBINED_PAYMENT_BACKEND_READY`,
  `VITE_FEATURE_COMBINED_PAYMENT_OWNER_APPROVED`.
- Extra Guest: `VITE_FEATURE_EXTRA_GUEST`,
  `VITE_FEATURE_EXTRA_GUEST_BACKEND_READY`,
  `VITE_FEATURE_EXTRA_GUEST_OWNER_APPROVED`.
- Receipt: `VITE_FEATURE_RECEIPT_58MM`,
  `VITE_FEATURE_RECEIPT_BACKEND_READY`, `VITE_FEATURE_RECEIPT_OWNER_APPROVED`.
- Tambahan untuk Extra Guest pada host operasional:
  `VITE_FEATURE_EXTRA_GUEST_APPROVED_HOSTS`, daftar hostname eksak dipisah koma.
  Default kosong. Tidak menerima URL, port, wildcard, atau pencocokan subdomain.
  Host operasional aktual harus dipastikan oleh Owner/Londo, tidak diasumsikan.

Pemeriksaan lokal terbatas pada nama flag (tanpa menampilkan credential): `.env`
baseline SUDAH memuat tiga flag Extra Guest bernilai `true`. Gate preview lama
karena itu dapat ON; host operasional tetap OFF karena approved-hosts kosong.
Combined Payment dan Receipt tidak memiliki flag aktif pada `.env` yang diperiksa
dan memakai default OFF. Tidak ada aktivasi baru oleh Codex. Konfigurasi Cloud
tidak diperiksa dan tidak disimpulkan dari file lokal ini.

Tidak ada env atau konfigurasi deployment yang diubah. Flag VITE adalah gate
produk, BUKAN otorisasi; RLS/guard server tetap wajib. `fitur.ts` memuat nama
legacy yang tidak digunakan pada call site aktif; jangan mengaktifkan fitur
dengan mengisi nama legacy `VITE_FITUR_*` saja.

## Pengujian baru yang benar-benar dieksekusi

- TypeScript baseline: PASS, `node node_modules/typescript/bin/tsc --noEmit`.
- TypeScript akhir: PASS setelah memberi tipe string eksplisit pada key cetak.
- Build client/server: PASS, `node node_modules/vite/bin/vite.js build`.
- Warning non-blocking: `inputValidator` deprecated, `vite-tsconfig-paths`
  kompatibilitas Vite 8, serta informasi Nitro/output worker lokal.
- `node scripts/operational-readiness-integration.cjs`: 13 skenario baru PASS.
- Dua skenario tambahan dijalankan dengan `READINESS_TEST_FILTER=integration:`:
  detail snapshot/sesi OPEN dan urutan popup → lookup → batch serta OFF: PASS.
- Total: 15 skenario baru PASS. Node VM mentranspilasi source TypeScript aktual,
  mengeksekusi fungsi save/autofill dan kontrol React dengan mock RPC/query/window.
- SQL preflight: 8 statement; postflight: 9 statement. Pemeriksaan statis SELECT-only PASS.
  BUKAN pengujian syntax/catalog/runtime PostgreSQL atau eksekusi Cloud.
- `git diff --check`: harus bersih pada review akhir.

Tes baru mencakup hostname eksplisit, gate OFF, payload jumlah tamu normal dan
Training, minimum DP dari total, nominal check-in, pagination pembayaran terpilih,
receipt OFF tanpa RPC, popup diblokir, key retry tetap, satu dialog untuk batch,
dan pencatatan `PRINT_DIALOG_OPENED` tanpa physical confirmation.

Browser interaktif, printer fisik, dan koneksi backend Cloud TIDAK diuji.
Build bukan bukti deployment. Pengujian runtime lama yang PASS tidak diulang.

Smoke tambahan pada build final: handler Cloudflare Worker dipanggil langsung
untuk `/auth` dan `/`, keduanya HTTP 200 + HTML, external fetch 0. Bukan browser
atau emulator Cloudflare. Percobaan awal membuka index.mjs sebagai server Node
menghasilkan ECONNREFUSED karena preset cloudflare-module tidak membuka port;
diagnosis diselesaikan tanpa mengubah preset atau mengunduh Wrangler. Proses
percobaan sudah berhenti. Log build final dan worker-smoke-results.json berada di
`%TEMP%/operational-readiness-final-8c28f1da962b41fd89558d2c4e99de1c`.

## Inventaris migrasi dan kebutuhan schema

Daftar 13 file untuk review (tidak termasuk dependency/cache/output yang diabaikan Git):

- `src/components/formulir-pemesanan.tsx`
- `src/components/detail-transaksi.tsx`
- `src/lib/feature-flags.ts`
- `src/components/receipt-actions.tsx` (baru)
- `src/lib/receipt-print.ts` (baru pada branch ini, renderer dipakai kembali)
- `scripts/operational-readiness-integration.cjs` (baru)
- `supabase/reconciliation/operational_readiness_preflight_20261112.sql` (baru)
- `supabase/reconciliation/operational_readiness_postflight_20261112.sql` (baru)
- `DOKUMEN_PROYEK/01_BUKU_INDUK.md`
- `DOKUMEN_PROYEK/03_STATUS_FITUR.md`
- `DOKUMEN_PROYEK/04_RIWAYAT_PERUBAHAN.md`
- `DOKUMEN_PROYEK/05_ARSITEKTUR_SISTEM.md`
- `DOKUMEN_PROYEK/PAKET_KESIAPAN_OPERASIONAL_LOKAL_2026-11-12.md` (baru)

**Tidak diperlukan migrasi baru untuk perubahan lokal ini.** Hanya frontend,
tes, dokumen, dan SELECT pemeriksaan. Jangan membuat ulang objek yang ada.

| Area | Artefak / kontrak | Catatan |
|---|---|---|
| Baseline | Drizzle 0000–0005 dan migrasi operasional berikutnya | Sudah menjadi fondasi; jangan bootstrap ulang ke Cloud. |
| Finance / Training | 20261015000000–00003, 20261018000000 | Gunakan bukti PASS dan metadata Owner. |
| Extra Guest | Generated types transactions: guest_count, extra_guest_count/unit_price/charge, base_price_snapshot; overload create_reservation dan create_training_reservation dengan integer terakhir | Definisi migrasi 20261022000000 tersedia sebagai artefak lama di worktree saudara, tidak berada di main saat ini. Bukan alasan memasangnya ulang. |
| Receipt | issue_payment_receipt(uuid), request_receipt_print(uuid,uuid), record_receipt_print_result(uuid,text,text,text,boolean); tiga tabel receipt | Generated types tersedia. Artefak 20261022000001 dan hardening 20261022000003 ditemukan read-only di worktree saudara; tidak disalin ke migrasi main. |
| Combined payment | 20261104000000_atomic_combined_payments.sql; empat RPC dan finance_payment_batch_idempotency | Metadata Owner menyatakan ada. `_guest_count` didukung kontrak gabungan. |
| Housekeeping | 20261012000000, 13000000, 14000000, nomorator final 19000000 | PASS lama dipertahankan. Tidak ada perubahan. |

Ketiadaan beberapa migrasi receipt/extra guest di main adalah gap arsip/reproduksi
schema, bukan bukti Cloud kekurangan objek. Jangan mengisi gap arsip dengan
migration replay. Inventaris exact definition/signature harus dibandingkan dulu.
Tidak ada SQL forward atau rollback database baru karena tidak ada perubahan DB
yang diusulkan. Jika preflight gagal, STOP aktivasi, susun paket forward-only
terpisah berdasarkan diff yang terbukti dan minta persetujuan Owner.

## Preflight / postflight dan risiko data

- `supabase/reconciliation/operational_readiness_preflight_20261112.sql`:
  metadata relasi, kolom, signature/default/nama argumen, ACL efektif,
  SECURITY DEFINER/search_path/owner, RLS/policy, trigger, extension, dan lokasi
  migration history. Tidak membaca data tamu atau credential.
- `supabase/reconciliation/operational_readiness_postflight_20261112.sql`:
  aggregate integritas snapshot extra guest, receipt/copy, template aktif 58mm untuk
  BOOKING/WALK_IN, status cetak,
  serta ACL/RLS. Eksekusi hanya setelah objek/kolom preflight tersedia.
- Keduanya disiapkan, tidak dijalankan. Gunakan role pemeriksaan yang sama agar
  aggregate sebelum/sesudah dapat dibandingkan; hasil terbatas RLS bukan seluruh DB.
- Target: Lovable pribadi **Pixel Perfect Homestay Hub**, project
  `017f6e78-15f2-4d07-a38c-87cb185279bf`. Nama DB tidak membuktikan project;
  operator wajib memastikan project/workspace di alatnya sebelum SELECT.
- Jangan menyamakan target ini dengan Supabase Staging historis.
- Jangan menyalakan fitur bila signature, ACL authenticated/anon, RLS, template
  aktif 58mm atau otorisasi Training belum sesuai. Keberadaan nama RPC saja belum
  membuktikan isi guard/signature/ACL-nya cocok.
- Receipt frontend membaca snapshot immutable yang diterbitkan server; nomor
  salinan dan actor berasal dari server. Gagal RPC tidak mengulang otomatis.
- Membuka dialog tidak dapat membuktikan kertas tercetak atau dialog tidak dibatalkan.
- Historis base_price_snapshot NULL harus tetap diperlakukan legacy/unsplit;
  tidak ada backfill harga atau overwrite data lama dalam paket ini.

## Rollback dan serah terima

- Review diff dahulu, belum ada commit atau integrasi remote.
- Bila integrasi nanti disetujui tetapi ada regresi: matikan gate fitur terkait
  melalui proses terpisah yang disetujui Owner, lalu revert hanya batch frontend
  ini secara forward-only. Jangan reset branch, rollback transaksi/receipt, atau
  mengubah snapshot keuangan lama.
- RLS/guard server dan kode HK tetap menjadi pertahanan; tidak ada rollback schema.
- Londo: review GitHub setelah izin commit/push/PR terpisah; verifikasi project
  Lovable pribadi, jalankan SELECT preflight/postflight setelah izin, cocokkan
  kontrak/ACL/RLS serta env server akun, dan rencanakan aktivasi flag per fitur.
- Owner fisik: uji hasil kertas 58mm, margin, pemotong, ukuran font dan salinan;
  batalkan dialog cetak untuk memastikan tidak diklaim tercetak; lakukan penerimaan
  pengguna pada perangkat operasional setelah paket disetujui.
- Blocker menuju 100% siap sementara: review/integrasi belum disetujui, gate
  backend exact belum diperiksa pada target pribadi, gate fitur operasional belum disetujui/diaktifkan, browser
  interaktif belum diuji, dan printer/penerimaan fisik belum diuji.

Rekomendasi satu batch berikutnya: review paket frontend ini beserta dua SELECT
dan rencana aktivasi. Persetujuan commit/integrasi/Cloud tetap terpisah; jangan
mengulang suite PASS lama atau mengklaim 100% hanya dari hasil lokal.
