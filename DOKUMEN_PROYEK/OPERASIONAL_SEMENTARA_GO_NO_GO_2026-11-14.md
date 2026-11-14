# Operasional Sementara — CURRENT VERIFIED / NOT REACHED dan GO/NO-GO

Tanggal audit: **14 November 2026 WIB**. Instruksi: [Issue #2 komentar 6867987628](https://github.com/sk25ciwastra-blip/pixel-perfect/issues/2#issuecomment-6867987628). Baseline main GitHub terverifikasi `17161ef9aee2bcbf2ab702f3598a43d9b2efdcb1` (PR #57). Branch audit terpisah dari paket karyawan. Tidak ada perubahan aplikasi/aturan keuangan/SQL pending, Cloud SQL, akun/data DEMO, flag, merge/deploy/publish, SMTP/email atau penggunaan tool/editor Lovable.

**Keputusan: NO-GO untuk menyatakan target Operasional Sementara siap atau mengizinkan pilot tulis.** Bukti lab membaik, tetapi published target dan acceptance nyata belum terbukti. Tidak menghitung persentase Operasional Sementara dari 57,1% Issue #61; angka itu hanya paket karyawan yang kini ditunda.

## Bukti lama yang dipertahankan

Tidak menjalankan ulang suite Finance/concurrency/Training, HK, waktu Booking, receipt renderer atau PDF yang sudah PASS. Acuan source: `PAKET_KESIAPAN_OPERASIONAL_LOKAL_2026-11-12.md`, checkpoint Finance gabungan/authorization 4 November, review Housekeeping/WIB, fixed-slot dan overtime 13 November. PR #50–#55 yang merged menjadi bukti renderer/logo 40 mm/kontak, PDF akses staf, HK TERISI/KOTOR dan penyegaran tanggal WIB. PR #56–#57 menyimpan backend fixed-slot/overtime sebagai SQL pending, **bukan bukti Cloud diterapkan**.

Tes baru adalah satu rehearsal native dengan source ledger `main` dan kandidat pending, melintasi modul yang sebelumnya diuji terpisah. Tiga pemeriksaan planning Pagi/Malam/Harian hanya memeriksa seam setelah seluruh dependency terpasang (termasuk lintas tahun WIB), bukan mengulang 11 kasus fixed-slot atau mengklaim arrival browser PASS.

## Koreksi root cause Issue #2/#4

| Area | CURRENT VERIFIED / sumber bukti | Yang belum boleh disimpulkan |
|---|---|---|
| Database Lovable | Checkpoint Owner 14 Nov: project `017f6e78-15f2-4d07-a38c-87cb185279bf`, 37 public BASE TABLE, 5 RPC utama tersedia, authenticated EXECUTE=true/anon=false, RLS aktif pada 10 tabel yang disebut | Bukan lagi asumsi 17 tabel/Finance tidak ada dari 21 Oktober. Bukan bukti function body/izin actor/RLS benar atau transaksi berhasil |
| Staging terpisah | Management API get/list pada turn ini: Baturaden-25-Staging, ref `…bfti`, status **INACTIVE**; catalog konektor relevan hanya menampilkan staging tersebut | Tidak dibangunkan, tidak dicoba koneksi DB-nya, tidak dianggap backend published |
| Published entry | GET anonim `https://pixel-perfect-homestay-hub.lovable.app/`, 14 Nov 00:01:52 UTC: HTTP **302**, Location origin `https://lovable.dev`, path `/auth-bridge`, query hanya dicatat sebagai boolean; tidak diikuti | Ini hambatan inspeksi anonim, **bukan bukti situs mati atau Owner tidak dapat login**. HTML/JS aplikasi dan ref database published tidak berhasil dibaca |
| Preview vs published | `client.ts` membaca VITE_SUPABASE_URL/key saat build, fallback SUPABASE_URL/key server; preview auth storage adalah kontrak source | Target browser preview, build published, server ENV dan kecocokan dengan database Lovable **NOT REACHED**. Tidak menampilkan key/JWT, mengedit env atau mengganti target otomatis |
| Definisi Cloud | Lima signature dari Owner: open_finance_cash_session(numeric), close_finance_cash_session(uuid,jsonb,text), check_in_booking(uuid), check_out_transaction(uuid), get_finance_training_context(); semuanya SECURITY DEFINER | Metadata EXECUTE/RLS tidak membuktikan auth.uid/current actor, active position, Training, helper ACL, session ownership atau net settlement. Definisi/hash/policy/ledger aktual belum diperiksa pada DB Lovable di turn ini |

Tidak menggunakan konektor Lovable karena larangan Owner. Konektor Supabase yang tersedia menunjuk staging INACTIVE. Fakta 37 tabel/RPC diambil sebagai checkpoint Owner yang sah, dengan sumber dibedakan dari inspeksi management/static GET turn ini. Tidak mengirim SQL apa pun ke Cloud.

## Hasil rehearsal native baru (dummy, bukan Cloud)

Runner memakai portable PostgreSQL 17.11 yang sudah tersedia, cluster baru loopback/port acak dan schema Auth stub; actor dari GUC fixture, **bukan login/JWT nyata**. Helper isolasi diadaptasi dari harness #72, tanpa membawa branch karyawan ke main. Seluruh data sintetis. Foundation Drizzle 0000–0005, Supabase core/Finance/Training/checkout dan combined berasal dari file source; katalog dummy memenuhi precondition katalog resmi, bukan perubahan tarif produksi. Set komisi 8% hanya menggunakan RPC Owner pada fixture untuk memeriksa seam refund; konfigurasi Cloud tidak dibaca/diubah.

Bootstrap mengikuti urutan source/seed yang telah dipakai lab sebelumnya; `20261006000010_correct_p4_prices.sql` dikecualikan sesuai jalur bootstrap tersebut, bukan rencana replay Cloud. Ini **bukan** migrasi otomatis yang boleh dijalankan di sistem sebenarnya. Ledger artifact mencatat file dan SHA256. Kandidat late-checkin cap, fixed-slot, overtime dan PDF refund diterapkan **hanya pada disposable DB**; tidak mengklaim baseline Cloud mempunyai kontrak tersebut.

| Pengujian baru | Status | Batas bukti |
|---|---|---|
| Planning Pagi 08:30–16:00, Malam 22:00–08:00+1, Harian 13:00–12:00+1 | PASS | SQL chain native, planning lintas tahun; bukan 3 arrival browser |
| Training tidak membuka sesi sendiri; Receptionist membuka sesi | PASS | Post-auth native role fixture, bukan Auth nyata |
| DP minimum snapshot, kurang satu rupiah ditolak; Cash DP + QRIS pelunasan | PASS | Session/role/source aturan existing; bukan uji Cloud |
| Booking→Check-in canonical dengan TRX/payment count sama | PASS | Check-in sebelum lunas ditolak; tidak membuat transaksi/payment tambahan |
| Checkout→KOTOR→cleaning→READY; kekurangan handuk dicatat tanpa blok READY | PASS | RPC HK nyata source pada DB dummy; tidak mengulang suite HK |
| Closing positif menjadi FINAL | PASS | Kas dan alokasi sesuai; bukan penerimaan Owner nyata |
| Walk-in lunas, sesi ditutup, refund OWNER_FUNDS saat TRX masih aktif | PASS | FINAL snapshot tak berubah, komisi disesuaikan, net unpaid ditolak Checkout; setelah TRX Checkout, refund ditolak guard existing, **tidak diubah** |
| PDF ledger refund complete/count sesuai untuk transaksi Walk-in | PASS | Read RPC terotorisasi pada fixture; PDF builder/browser/WhatsApp/printer tidak dijalankan ulang |
| Owner membayar pada sesi Receptionist | **FAIL SOURCE** | Source main payment trigger menolak karena opened_by != recorded_by; call gagal atomik tanpa TRX. Bukti lab dual-identity lama tidak direproduksi oleh ledger ini; **Cloud NOT REACHED** |
| Combined prerequisite pada main | **FAIL SOURCE REPRODUCIBILITY** | Function INSERT mereferensikan guest_count/extra_guest_count/extra_guest_unit_price/extra_guest_charge, tetapi ledger main tidak menyediakan empat kolom itu. Tidak menambah kolom rekaan agar tes hijau; keadaan Cloud belum diverifikasi |
| Closing expected cash -Rp5.000 | **FAIL SOURCE** | Expense RPC pada sesi dummy menghasilkan defisit; alokasi 0 ditolak equality, alokasi signed -5000 ditolak nonnegative; sesi tetap OPEN atomik. Keputusan Owner Issue #4 mengizinkan saldo minus; definisi Cloud terbaru belum dibandingkan |
| Thermal Model A end-to-end | NOT REACHED | issue_payment_receipt(uuid) tidak ada pada ledger main yang dibootstrap; SQL foundation receipt tidak ditemukan di tree. Renderer/3 variasi/logo 40 mm yang PASS tetap dipertahankan, tidak membuat snapshot palsu |
| Resep preflight metadata baca-saja | PASS lokal | Diuji pada disposable DB; belum dieksekusi di Cloud |
| Published/Auth nyata/role RLS live/printer fisik | NOT REACHED | Tidak ada akun/sesi kas/transaksi/receipt Cloud dibuat atau diubah |

Artifact lokal final sebelum CI: `C:\Users\USER\AppData\Local\Temp\b25-ops-native-aXaXJT\operational-evidence.json` dan `cleanup.json`; database dummy dihapus dan cluster dihentikan. CI mereproduksi skenario baru dan menyimpan JSON saja. **CI success berarti reproducer berjalan benar, bukan semua business gate PASS atau izin GO**: tiga FAIL source tetap dicatat dalam artifact dan laporan.

Tes script audit static memakai HTTP sintetis untuk memastikan GET anonim saja, URL aset same-origin, redirect auth tidak diikuti, API key/query tidak muncul di JSON. GET published nyata dilakukan terpisah dan menghasilkan 302 di atas. Hash/aset/ref yang tidak teramati tidak berarti RPC tidak ada.

## Draft/dependency inventory, bukan aktivasi

| Draft | Bukti yang dipakai tanpa rerun | Pengaruh release |
|---|---|---|
| #63 overtime Dashboard/Kamar | Head 24b9be4; backend dari #57; Owner release UI masih disabled | Belum main, backend SQL pending; jangan klaim PERLU TINDAKAN published sudah tersedia |
| #64 Booking arrival WIB | Head 63d6d57; helper tanggal dan tes tersedia | Belum main, beririsan index.tsx dengan #63 |
| #65 integrasi #63+#64 | Head cf86005; CI 43460438256 SUCCESS sesuai checkpoint PR | Bukti coexistence lokal retained; bukan release branch atau live role/RLS PASS |
| #66 Bantu Sesi Aktif | Head e13add4; memilih OPEN session, operator tetap caller; tidak mengubah backend | Pemilihan UI tidak memperbaiki source trigger lintas-operator di atas. Cocokkan backend aktual dahulu |
| #7/#26/#27 | Proposal/gate Finance dan Extra Guest/Receipt terdahulu | Pernyataan historis "Finance absent" tidak mengalahkan metadata 14 Nov; jangan replay file seed atau grant blind |
| #67–#72 | Paket karyawan dan native rehearsal retained | Ditunda; tidak dijadikan prasyarat menyelesaikan pilot dengan akun sah existing; tidak diubah |

## Blocker P0 berurutan dan matriks release

| Gate | Bukti lokal/source | Bukti actual published/Cloud | GO/NO-GO Operasional Sementara |
|---|---|---|---|
| A. Target runtime benar | Source ENV resolver diaudit; static GET 302 auth bridge | Ref published vs DB Lovable belum cocok secara otoritatif | **NO-GO P0-1** |
| B. Akun sah/role dan opening sesi kas | Native ordinary own-session PASS; Training opening DENY | Existing Owner/Supervisor/Receptionist/Training + opening aktual belum teruji di target benar | **NO-GO P0-2** |
| C. Booking→Check-in→Checkout→HK | Journey dummy PASS; fixed-slot SQL kandidat lokal, HK/WIB PASS retained | Kontrak/function body dan browser target belum terbukti | **NO-GO P0-3** |
| D. Cash/payment/closing | Ordinary positive PASS; source Owner-assisted session dan negative close FAIL; combined prerequisites drift | Harus dibandingkan dengan body/policy/ledger Cloud, bukan dianggap sama dengan main | **NO-GO P0-3/4** |
| E. Struk 58 mm/PDF | Renderer/PDF PASS retained; PDF scoped ledger native PASS; foundation receipt source ledger tak lengkap | RPC receipt/template/grants/flags target dan printer nyata belum terbukti | **NO-GO P0-4** |
| F. Overtime dan Booking WIB | #56/#57 pending source, #63–#65 draft evidence retained | Backend apply state/Owner release audit/aksi actual belum diverifikasi | **NO-GO P0-5** |
| G. Backup/rollback + limited pilot signoff | #72 native restore terbatas fixture PASS retained; bukan backup operasional | Backup DB/Auth/Storage/role globals aktual, rollback rehearsal dan izin pilot belum tersedia | **NO-GO P0-6** |

P0 di atas mencampur **gap bukti release** dan **FAIL source yang direproduksi** secara eksplisit, bukan daftar klaim Cloud rusak. Prioritas pertama tetap target published. Bila Owner secara eksplisit mengecilkan scope pilot (misalnya combined/extra guest tetap OFF), gate opsional dapat ditinjau ulang; Codex tidak mengubah flags atau scope diam-diam. Tidak memberi persentase keseluruhan tanpa checkpoint/bobot dan bukti penerimaan operasional nyata.

## Satu tindakan berikutnya — GILIRAN KAPTEN

**Izin uji read-only eksplisit pada sesi Owner existing di published app** untuk melewati auth bridge dan mencocokkan target. Target: origin published di atas; database harus terlebih dahulu cocok dengan project Lovable 017f6e78-… yang memiliki 37 tabel, **bukan** staging INACTIVE `…bfti`.

Scope: Owner membuka app pada sesi sahnya sendiri, DevTools Network hanya mencatat origin/project-ref request Supabase dan nama RPC/status error yang sudah ada; cocokkan browser/build/server target dengan metadata project resmi. Jangan bagikan Authorization/apikey/JWT/cookie, response tamu/PII atau screenshot kredensial. Jangan klik Buka Sesi, Booking, Payment, Checkout, HK atau Print RPC. Rollback scope read-only: tidak ada perubahan DB; tutup inspector/halaman atau sign-out bila diperlukan. Tidak membuat akun/sesi/transaksi/DEMO baru.

Sesudah target cocok, metadata recipe `supabase/reconciliation/operational_readonly_preflight_20261114.sql` tersedia untuk persetujuan read-only pada target yang benar. Recipe hanya katalog table/RLS, signature/parameter, owner/search_path/EXECUTE/body digest, selected column names dan keberadaan ledger; tidak membaca business rows. Bandingkan exact internal guards dan normalized signatures dari source, jangan menyamakan digest berbeda dengan kerusakan atau EXECUTE=true dengan authorization PASS.

Uji tulis pilot/live **tetap dilarang dalam tugas ini** dan membutuhkan instruksi Owner terpisah yang menetapkan target/scope/rollback setelah blocker direview. Tidak meminta mengaktifkan staging/SMTP/flags, tidak mengubah env atau menyalin migration Finance secara blind. Patch produksi tidak dibuat karena definisi backend target belum tersedia; PR DRAFT ini menyediakan reproducer, metadata recipe dan keputusan release yang dapat direview.

## Menjalankan pemeriksaan baru

```powershell
node scripts/audit-published-runtime.test.cjs
$env:B25_OPS_BIN='C:/Users/USER/AppData/Local/Temp/b25-employee-native-tools-20261114/pgsql/bin'
node scripts/operational-journey-rehearsal.cjs
# Opsional terotorisasi, anonymous static GET saja:
node scripts/audit-published-runtime.cjs
```

Tanpa native bin/ephemeral CI opt-in, native runner NOT REACHED (tidak fallback Cloud/PGlite). Semua mutation hanya pada database acak yang dibuat runner; cleanup diverifikasi. Typecheck/build aplikasi tidak diulang karena tidak ada TypeScript/aplikasi yang berubah. Syntax JS/YAML, privacy tests dan journey baru saja yang diperiksa.
