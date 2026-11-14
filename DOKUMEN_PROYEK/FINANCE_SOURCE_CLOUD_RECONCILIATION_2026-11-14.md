# Rekonsiliasi tiga kegagalan Finance — source, kandidat, Cloud

Acuan: [Issue #2 komentar 6869144520](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/2#issuecomment-6869144520), 14 November 2026 WIB. Baseline main `17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1`; PR #73 `e28ba6f3e92f54c9dd80155fa02f552412b50681`. PR rekonsiliasi baru bertumpuk pada #73 untuk memakai runner/catalog, tidak mengubah PR #73 atau #67–#72. Tidak ada desain/karyawan/aplikasi/flags berubah.

**Hasil: tiga skenario kandidat source PASS native lokal. Cloud code untuk tiga kebutuhan sudah mempunyai implementasi menurut audit Owner; tindakan Cloud = NO ACTION. Operasional Sementara tetap NO-GO.** Source replay, metadata Cloud, dan runtime pengguna adalah lingkungan bukti yang berbeda.

## Bukti baru Owner yang menggantikan asumsi lama

- Owner sudah mengizinkan inspeksi read-only sesi published pada komentar 6868764002. Tidak meminta izin itu lagi. Konektor tidak mengendalikan sesi browser PC Owner; tidak logout atau memakai/membagikan token.
- Komentar 6869123565: preview dan published menuju `ijujmxhcifuerkllbbgq.supabase.co`, **PASS host identity saja**. GET anonim 302 pada #73 tidak membatalkan pengamatan sesi sah Owner ini. Build/version, project-ref konektor Lovable DB 017f6e78-… dan izin operasi masih memerlukan pembuktian tersendiri. Staging terpisah `…bfti` tetap INACTIVE; tidak dibangunkan/dialihkan.
- Audit read-only Owner memberi fingerprint definisi finance_prepare_payment `8fbcc9895e1466c2fd5dd30c0a4ab3a0`, close_finance_cash_session `3a297fed148508cfcc0c0cb64c7e3dd4`, create_reservation_combined `18b71c50c227c6780b34c3fad07dc2ed` dan keberadaan empat kolom guest. Tidak mengulang query Cloud atau memakai Lovable. Audit tersebut bukan PASS transaksi/role nyata.

## Dependency/version reconciliation matrix

| Komponen | main / #73 | Existing candidate / status | Audit Cloud | Asal FAIL dan tindakan |
|---|---|---|---|---|
| Bantu Sesi Aktif backend | Finance Training 20261018 mengizinkan beda operator hanya lewat konteks Training | PR #36 closed, unmerged; SHA `3a8dd60e8337a9fb2f222fbdd81e6fba36e26245` memiliki guard Owner/Supervisor nonrestricted atau konteks Training cocok; checkpoint authorization 4 Nov 11/11 PASS | Guard itu sudah ada; MD5 8fbcc… | **Source drift saat reintegrasi.** Pulihkan hanya function finance_prepare_payment yang sudah PASS, bukan seluruh file Training |
| Combined RPC | 20261104000000 sudah main dari PR #37 merged, head `6c3f8c7f00dbcc354da21992e43f29cd10938dea` | Body migration combined **byte-identik** dengan PR #36; tidak ditulis ulang | RPC reservation/settlement ada, MD5 reservation 18b71… | Function bukan implementasi baru yang rusak; sumber ledger #73 belum lengkap |
| Empat kolom combined | main/#73 tidak memasang fondasi empat kolom | PR #36 `20261022000000_extra_guest_receipt_foundation.sql` berisi definisi tipe/default/constraints existing; tidak dibawa PR #37 | Keempat kolom hadir; detail tipe/default/constraints Cloud belum diberikan | **Dependency omission pada source ledger.** Ambil empat definisi dan tiga CHECK existing, bukan membuat kolom tebakan di fixture atau mengimpor seluruh receipt migration |
| Closing minus | main source memaksa expected_cash == alokasi nonnegative | UI minus sudah merged pada `7544134a8da346be76abf1a530a9c3f18abae166`; pencarian SQL pada history reachable dan worktree lama tidak menemukan branch minus yang tersimpan | Cloud sudah memakai expected_cash<0 → alokasi fisik nol; snapshot minus | **Backend source drift.** Tambahkan branch minimum ke function source existing, pertahankan transfer/alokasi positif/refund/owner reason |
| Closing ACL/actor | Source main masih default PUBLIC EXECUTE; NULL actor melewati kondisi ownership three-valued SQL | Native rollback-only probe membuktikan anon bisa menutup sesi kosong source lama; rollback mengembalikan OPEN | Audit sebelumnya Cloud anon EXECUTE=false | Tutup boundary **source**, bukan klaim Cloud rentan: explicit NULL actor DENY + REVOKE PUBLIC/anon, authenticated existing tetap |
| Frontend Bantu Sesi | #66 DRAFT, `e13add4c73cd7067292ca3e8db73ab00dea995c8`; tidak menambah backend grant | Tetap DRAFT dan tidak diubah | Pemilihan UI bukan pembuktian backend runtime | Verifikasi UI/role terpisah nanti; tidak merge #66 otomatis |

Worktree `C:\tmp\pixel-perfect-combined-payment` ditemukan di HEAD PR #36, dengan modifikasi lokal detail-transaksi dan file untracked. Tidak di-reset, disunting atau di-commit. Kandidat diambil dari blob Git immutable SHA tersebut, bukan perubahan lokal. Perbedaan lain pada file Training (summary/API ACL) sengaja tidak ikut dipulihkan karena di luar tiga skenario.

## Kandidat pending yang paling kecil

`supabase/pending/20261114013018_finance_source_reconciliation_review.sql` dibuat melalui CLI migration new lalu dipindah ke pending; tidak diterapkan Cloud dan tidak masuk auto-migration folder.

1. Empat kolom: guest_count integer NOT NULL DEFAULT 2; extra_guest_count integer NOT NULL DEFAULT 0; extra_guest_unit_price numeric(12,2) NOT NULL DEFAULT 50000; extra_guest_charge numeric(12,2) NOT NULL DEFAULT 0. Semua berasal dari snapshot existing, bukan dugaan dari fixture. Tiga CHECK mempertahankan guest>=1, extra=max(guest-2,0), charge=extra*unit dan unit nonnegative.
2. finance_prepare_payment dipulihkan **persis** dari PR #36. Semua komisi/snapshot/charge/idempotency di luar blok assisted-session sama dengan main; tes membuktikan kesamaan source itu.
3. close_finance_cash_session berbeda dari main hanya pada explicit NULL auth.uid denial dan branch expected_cash<0 yang menuntut alokasi kas fisik nol. Nonnegative/equality rule ketika saldo >=0 dan seluruh perhitungan lainnya tetap. REVOKE menutup PUBLIC/anon; tidak menambah EXECUTE helper sensitif atau SELECT tabel.

File ini adalah **replay kandidat untuk schema baseline main yang belum lengkap**, bukan runbook Cloud. Preflight mewajibkan trusted SQL table owner, hash kedua function **main lama** dan belum adanya keempat kolom. State sudah dikoreksi/parsial berbeda ditolak sebelum DDL. Native reapply membuktikan penolakan atomik tersebut. Karena Cloud sudah memiliki kolom dan payment function yang benar, file ini memang harus **ditolak/di-skip di Cloud**, bukan diminta untuk dijalankan.

Tidak mengimpor receipt tables/triggers/template, base_price_snapshot yang tidak diperlukan combined, harga P4, revocation legacy RPC, perubahan bahasa/thermal, SQL lifecycle karyawan atau default konfigurasi produksi. Tidak mengubah migration history lama. `CREATE OR REPLACE` menjaga owner dan grant existing selain pengetatan closing yang disebutkan.

## Fingerprint comparison

Native PostgreSQL 17.11 menghitung MD5 definisi function (`pg_get_functiondef`, CRLF dinormalisasi):

| Function | Kandidat lokal | Audit Owner Cloud | Kesimpulan |
|---|---|---|---|
| finance_prepare_payment | 8fbcc9895e1466c2fd5dd30c0a4ab3a0 | sama | MATCH definisi terhadap fingerprint yang diberikan; bukan uji Auth/RLS runtime |
| create_reservation_combined | 18b71c50c227c6780b34c3fad07dc2ed | sama | MATCH; function existing tidak perlu ditulis ulang |
| close_finance_cash_session | 0c27c62f350cb38b8fd880f9de84f6d2 | 3a297fed148508cfcc0c0cb64c7e3dd4 | **Tidak identik.** Rule minus selaras; candidate mempunyai NULL actor denial/wording source. Full diff body Cloud belum tersedia, jangan klaim mirror byte-identik atau overwrite Cloud |

Hash bukan bukti DB identity, bukan jaminan otorisasi dan bukan izin migrasi. Tipe/default/constraints empat kolom pada Cloud tetap **NOT REACHED**; metadata native disimpan dalam artifact agar Owner dapat membandingkannya melalui inspeksi read-only yang sudah diizinkan.

## Hanya tiga skenario yang diuji ulang

`node scripts/finance-reconciliation-tests.cjs`, native disposable 17.11. Source fixture foundation diambil dari main, kemudian **file pending exact** diterapkan hanya di DB dummy; combined migration main exact. Tidak menjalankan journey penuh #73, suite lama Finance/receipt/HK/concurrency, typecheck/build aplikasi atau Cloud. Auth stub memakai actor GUC dan SET ROLE, tidak membuat/memalsukan JWT atau akun nyata.

| Skenario terdampak | Baseline main | Kandidat lokal | Cloud code audit | Cloud runtime |
|---|---|---|---|---|
| Owner/Supervisor membantu sesi Receptionist, operator tidak diganti | FAIL | **PASS** | Sesuai guard yang diaudit; fingerprint MATCH | NOT REACHED |
| Combined schema/pricing/dua metode | FAIL dependency | **PASS** | Kolom/RPC ada; function fingerprint MATCH; schema detail belum lengkap | NOT REACHED |
| Closing kas -5000, alokasi fisik 0 | FAIL | **PASS** | Rule minus sudah benar menurut audit | NOT REACHED |

Boundary yang relevan: Receptionist/HK/inactive DENY foreign/unauthorized path; Training berposisi dasar Supervisor tetap DENY shortcut, hanya assigned wrapper valid boleh memakai sesi penanggung jawab; actual recorded_by dipertahankan. Helper sensitive EXECUTE dan INSERT payments langsung tidak dibuka. Anon dan authenticated NULL actor closing ditolak. Role malformed tidak menjadi Owner.

Combined memeriksa tipe/default/3 CHECK native, guest=3/extra=1/charge=50000, DP snapshot 40% dari grand total, dua metode, replay sama ID, payload tamper DENY, settlement replay dan komisi satu kali/cumulative. Pemakaian key komponen kedua yang sudah dipakai memaksa kegagalan **setelah komponen pertama**; guest/TRX/payment/batch/room rollback utuh. Function DP tetap membaca setting Owner; tidak ada perubahan konfigurasi Cloud.

Closing: physical nonzero ketika minus DENY, angka alokasi negatif DENY, saldo -5000 disimpan pada snapshot FINAL dengan seluruh kas fisik 0; tidak ada tabel talangan. Boundary saldo positif tetap equality; pembukaan sesi carryover tidak diubah. Dua koreksi fixture selama pengujian: rollback memakai kelas kamar Standard yang sama dan positive closing memakai saldo sesi sebenarnya, bukan mengasumsikan opening override mengabaikan carryover. Tidak mengubah harga/aturan untuk meloloskan tes.

PASS tambahan yang melekat pada tiga skenario: source equality/provenance, wrong SQL owner DENY, already-correct state refuse, ACL unchanged/tightened, syntax JS/YAML/diff dan cleanup. Artifact lokal final: `C:\Users\USER\AppData\Local\Temp\b25-ops-native-8dakMB\finance-reconciliation-evidence.json` + `cleanup.json`; satu DB dibuat/dihapus dan cluster dihentikan. CI mengunggah JSON saja. Tidak ada log JWT/PII/credential.

## Matriks kesiapan Operasional Sementara sesudah rekonsiliasi

| Gate | Bukti sekarang | Status release |
|---|---|---|
| A runtime target | Host preview/published MATCH menurut Owner; dua fingerprint function lokal cocok audit | PARTIAL / NO-GO: build/version dan project-ref konektor belum dibuktikan identik |
| B akun/role/opening | Native assisted-session dan deny boundaries PASS | NO-GO: operasi akun sah published belum diuji |
| C Booking→Checkout→HK | Bukti native #73 dan PASS lama retained, tidak diulang | NO-GO: acceptance browser target belum dilakukan |
| D payment/closing | Tiga kandidat source kini PASS lokal; audit Cloud sudah mendukung aturan | NO-GO: runtime Cloud/role dan parity closing/schema lengkap belum verified |
| E thermal/PDF | PASS lama retained; tidak menyentuh satu pembayaran/satu struk | NO-GO: receipt ledger/Cloud/browser/printer nyata masih belum lengkap |
| F overtime/Booking WIB | Pending/draft #56/#57/#63–#65 tetap status review | NO-GO: tidak diaktifkan atau diuji actual target |
| G backup/rollback/pilot | Native cleanup/restore fixture terdahulu bukan backup Cloud | NO-GO: backup/rollback aktual dan izin pilot belum tersedia |

Tidak menaikkan persentase untuk PR/tes lokal atau menggunakan 57,1% paket karyawan. Penyebab tiga FAIL #73 direkonsiliasi sebagai source/ledger drift; laporan historis #73 tetap benar untuk baseline tersebut, bukan klaim Cloud gagal.

## Usulan izin tahap berikut — belum dilaksanakan

Tidak meminta ulang izin read-only yang sudah ada. **Permintaan baru kepada Owner adalah persetujuan rencana uji Cloud terkontrol/backup**, dengan urutan berikut; persetujuan review rencana ini bukan izin langsung menulis database.

1. Read-only preflight yang sudah diizinkan: cocokkan ref host `ijujmxhcifuerkllbbgq` dengan konektor DB 017f6e78-…, detail empat kolom/checks, full closing definition/ACL, actual role akun uji dan keberadaan sesi OPEN. Tidak logout, mengubah akun/assignment, atau memakai staging INACTIVE. Jangan bagikan token/headers/PII. Bila akses sah tidak tersedia → NOT REACHED, bukan membuat sesi palsu.
2. Owner memverifikasi backup target terbaru: timestamp/retention, cakupan DB+Auth+Storage+globals, restore procedure dan data yang dapat hilang. Tidak membuat backup/restore Cloud dalam tugas ini. Rekonsiliasi ledger/logical restore harus melindungi akun committed, nomor yang pernah terbit dan data existing.
3. Setelah hasil preflight dan rencana rollback aktual direview, minta **izin tulis eksplisit terpisah** untuk tepat tiga skenario dengan akun uji sah yang sudah ada, sesi/room/TRX dummy khusus berlabel run ID dan tidak bercampur DEMO/produksi existing: Owner membantu drawer Receptionist; combined dengan config harga/DP existing; negative closing memakai nol alokasi fisik. Backend-only combined test tidak mengaktifkan product flags. Supervisor/Training diuji hanya jika sesi/assignment sah existing tersedia; tidak membuat akun atau mengubah status untuk mengejar PASS.
4. Batas stop: existing OPEN session/room conflict yang bukan milik run uji, uang nyata, helper/trigger tak dikenal, backup tidak terbukti, mismatch ref/ACL, atau kebutuhan flag/SQL/assignment baru → stop. Tidak mereplay file pending ke Cloud yang sudah benar; tidak mengubah konfigurasi finansial, DEMO lama, receipt/template, email/WA/print fisik otomatis.
5. Rollback bukan DELETE massal atau rewind sequence. Sebelum izin tulis, tetapkan ID/ruang data run, snapshot/ledger yang akan dibandingkan dan prosedur pembatalan teraudit atau restore maintenance yang disetujui Owner. Jika belum dapat direview secara konkret, **jangan mulai tiga uji Cloud**. Semua aksi Cloud pada rencana ini belum dijalankan.

Satu prioritas berikut: selesaikan preflight read-only yang masih kurang dan review backup/rencana uji di atas; tidak perlu membuat migrasi Cloud duplikat. No merge, deploy, publish, SQL Cloud, DEMO/flags, email nyata atau Lovable.
