# Baturaden 25 Homestay — gerbang aktivasi paket sembilan file

17 November 2026 WIB. Menggantikan runbook delapan file dan usulan tes lama.
Baseline PR #83: 031b1dca73fca1b8bd678c909ad68b2f745222d9.
Status: kandidat GitHub saja; NO-GO operasional; source Lovable belum diubah.

## Temuan kartu Kamar dan keputusan tampilan Owner

Acuan Owner: Pembaruan UI Baturaden dengan Lampu Biru(2).png.
Kartu harus ringkas dan horizontal, panel ikon hitam-emas di kiri,
isi warm white di kanan, nomor besar, tipe, TRX/nomor pekerjaan HK,
lampu status, kelompok Standard/Superior/Deluxe. Status mengikuti data nyata,
bukan menyalin warna/nomor transaksi contoh dari gambar.

Observasi live /kamar sebagai Owner pada 17 November sekitar19.34WIB:
baris Standard dan Deluxe setinggi258.125px, sedangkan Superior87.09375px;
lebar kartu sekitar201.8px pada viewport1353px. Checklist Kamar12/10
yang PASS memuat issue_note berisi seluruh jawaban CENTANG. Source asli
formatIssueDetails ikut memasukkan issue_note sebagai masalah sehingga muncul
❌ dan teks panjang membuat CSS grid meregangkan seluruh baris.

Lovable masih3218bd2ebe8fd98a6a046c9fe105d21293de34ca.
Tidak ada penerapan source saat aktivasi tabel pilihan pengeluaran.
Ini bug rendering source yang sudah ada dan kini terlihat saat dataHK terisi;
bukan bukti stylesheet baru diterapkan melalui perubahan SQL.
Bukti screenshot: b25_room_card_current_issue.jpg.

Perbaikan false warning SUDAH ADA di paket: jangan memasukkan issue_note
umum ke daftar kekurangan; checklist harus berasal dari job/TRX yang sama.
Tidak membuat perbaikan tersebut dua kali.

Tambahan terbatas untuk keluhan Owner sekarang:
warning yang benar hanya menampilkan “❌ N catatan HK” pada kartu;
seluruh isi tetap tersedia pada title dan popup Detail Housekeeping.
Ini mencegah uraian masalah panjang memanjangkan kartu kembali.
Warna, background, plakat, SVG ranjang, tipografi, pengelompokan dan CSS
Lovable tidak diganti. Aksi kartu/TRX/HK dan akses tidak diganti.
Tidak memakai halaman Kamar GitHub lama sebagai pengganti desain Lovable.
Counterpart GitHub hanya mendapat perubahan ringkasan yang setara.

Status: SUDAH DIPERBAIKI DALAM PAKET, BELUM AKTIF DI LOVABLE.
Tidak mengklaim pemulihan visual/pixel parity LIVE sudah PASS.
Acuan Owner menjadi kriteria penerimaan visual saat aktivasi.
Tidak mengubah dataHK untuk menyembunyikan gejala atau status kamar agar mirip contoh.

## Kecocokan source dan isi paket

Read-only terbaru: delapan file existing dari source3218bd2 semuanya cocok
SHA256 manifest; file helper kesembilan memang belum ada. Enam artifacthash
manifest lama semuanya cocok sebelum penyesuaian kartu; artifactpatch kemudian
diperbarui dan hash manifest ikut diperbarui.

Tambahan preserved_files mematok src/components/kamar.css:
SHA256 1b0af4379320cd5024f0d587e52df50006dfff3435b9eb7e67eb79aafaeaa0b3.
Read-only preflight kini memeriksa CSS itu juga; CSS tidak menjadi file kesepuluh
yang dipatch. Jika CSS atau salah satu source/artifact berubah, STOP.
Full latest patch check/apply ke fresh export PASS; CSS sebelum/sesudah identik.
Syntax TSX Kamar yang berubah PASS pada kandidat dan counterpart.
Tidak menjalankan ulang suite PASS HK/Booking/Finance atau transaksi sebelumnya.

| File source yang berubah | Tujuan dan batas |
|---|---|
| src/components/checklist-housekeeping.tsx | Cegah submit berulang, pertahankan UUID/jawaban bila hasil belum pasti, refresh-only setelah commit; tidak mengubah severity atau isi tujuh item. |
| src/components/kerangka.tsx | Tambah selector Bantu Sesi Aktif pada menu profil dan bersihkan konteks saat logout; sidebar/background/logo tetap. Lebar dropdown profil berubah w-60 ke w-72 untuk selector. |
| src/lib/data-live.ts | Opsi throwOnError agar kegagalan refresh dapat dibedakan dari gagal simpan; pembacaan tetap RLS. |
| src/lib/sesi-kas.ts | Same-tab notification, pilihan helper eksplisit menang atas sesi sendiri; sesi terpilih FINAL tidak diam-diam pindah; Training tetap memakai sesi berwenang. |
| src/routes/housekeeping.tsx | Tampilkan navigasi seksi yang ada, termasuk Checklist; refresh terarah; tabel/desain asli dipertahankan. |
| src/routes/index.tsx | Booking hari kedatangan WIB, antrean overtime >120 menit, label Walk-in/Booking/Pembayaran yang benar; handler Checkout dan popup asli tetap. |
| src/routes/kamar.tsx | Relasi checklist-job yang benar, false warning dihapus, ringkasan catatan singkat, indikator overtime; stylesheet/acuan kartu asli dipertahankan. |
| src/lib/checklist-for-ready-job.ts | File baru helper relasi checklist terhadap pekerjaan resmi; tidak menambah tabel/RPC. |
| src/routes/keuangan.tsx | Konteks sesi terpusat, summary terikat UUID dan dibersihkan saat ganti sesi, operator expense membaca recorded_by; aturan minus/alokasi dan layout tetap. |

Tidak ada perubahan kapasitas reservasi tepat2tamu, harga, DP, komisi, privilege,
SQL, fitur talangan pribadi, theme atau feature flag dalam sourcepatch.
Tidak berarti tidak ada UI tambahan: tabChecklist, selectorBantuSesi dan indikator
operasional adalah perubahan UI fungsional yang dinyatakan di atas.

## Backup dan gerbang Support

Pencarian Gmail terakhir belum menemukan prosedur baru setelah Sam17Nov12:07WIB.
Instruksi masih janganConnect; reattachment dilakukan manusiaSupport.
Tidak mengirim email, Connect, atau meminta LovableAI.

Sebelum meminta satu persetujuan integrasi, Support harus menjelaskan:
- Original repository sk25ciwastra-blip/pixel-perfect, repositoryID1391084125.
- Branch yang terhubung, arah first sync dan apa yang akan ditulis di tiap sisi.
- Pelestarian commit/branch/PR dan source/desain Lovable yang berbeda dari main.
- Apakah proses mengubah preview/published deployment otomatis; tidak boleh
  menganggap persetujuan reconnect juga izin deploy/publish.
- Titik berhenti sebelum penulisan apa pun yang belum diizinkan Owner.

Backup source: delapan file asli sudah ada dalam pinned fixtures dan cocok
dengan pembacaan baru; helperbaru baselineabsent. Ini backup file yang akan
diubah, bukan klaim backup penuh workspace beserta aset binary.
Setelah reattachment aman: catat actualSHA kedua sisi, simpan snapshot penuh
source/aset dari commit yang benar dalam repositoryexisting, verifikasi dapat
dibaca dan worktree bersih. Jangan mengintegrasikan ke checkout campuran/untracked.
Jika backup penuh tidak tersedia, jangan mengklaim siap rollback produksi.

## Urutan source dan kondisi penghentian

1. Lengkapi jawaban Support dan dampak first sync. JanganConnect sendiri.
2. Baca head aktual kedua sisi; cocokkan source3218bd2, delapan hash existing,
   helperabsent, preserved CSS dan semua artifact dengan manifest terbaru.
   Source baru memerlukan diff selektif/rebase package, tidak force-apply.
3. Siapkan satu permintaan izin konkret: sourceSHAasal, candidatepatchhash,
   sembilan path, perubahan fungsional/visual di atas, branch tujuan,
   mekanisme penerapan yang dikonfirmasi Support, efek preview/deploy,
   titik rollback. SQL dan transaksi tidak termasuk izin source.
4. Hanya sesudah izin: terapkan current combined patch SATU KALI pada source
   asli yang bersih. Jangan apply patchHK5file/8file atau #76/#79 berlapis;
   jangan blindmerge halaman #80/#81/#82 atau seluruh PR83 ke desainLovable.
5. Review diff harus tepat9path; preservedCSS/assets/aturanOwner tetap.
   Jalankan pemeriksaan build/typecheck pada hasilintegrasi aktual serta
   regresi hanya area yang benar-benar berubah; jangan ulangi suite tak terkait.
6. Read-only acceptance: Checklist dapat dicapai lewat navigasi; kartu Kamar
   ringkas seperti acuan, PASS tidak menampilkan❌, kekurangan riil dapat
   dibuka penuh; labelWalk-in benar. BantuSesi eksplisit tetap sama di
   Dashboard->form->Finance walau Owner punyaOPEN; summary milik UUIDyangsama.
   Jangan submit Booking/payment/expense/HK/Closing pada tahap baca ini.
7. Jika diff berubah desain lain, buildgagal, hashdrift, summarylintassesi,
   contextfallback atau kartu masihmemanjang: STOP. Jangan kompensasi data,
   aktivasiSQL/flags, atau merilis diam-diam.

Rollback source: simpan SHAintegrationcommit dan SHAasal. Gunakan ordinary
git revert terhadap commitintegrasi pada branch reviewexisting; resolveconflict
dengan review jika ada perubahan baru. Jangan reset/forcepush/overwritehistori.
Pengembalian source live/deploy juga harus sesuai izin Owner/prosedurSupport;
tidak otomatis. Revert source tidak membalik SQL atau dataDEMO.
Jika helper baru dihapus oleh revert, delapan file pemanggil juga harus kembali
serentak; jangan restore satu file secara acak.

## Setiap SQL dipisahkan — bukan satu batch migrasi

Status dibaca dari definisi Cloud saat ini, bukan nama folderpending.
Tidak ada SQL dijalankan pada pemeriksaan ini.

| File di supabase/pending | Status / dependensi / keputusan |
|---|---|
| 20261023_expense_options_and_extra_guest.sql | HanyaBagianA sudahAPPLIEDCLOUD, duaopsiPASSLIVE. Janganulang. BagianB komentar historis, tidakdiizinkan; 2tamu tetapfinal. |
| 20261112175446_payment_confirmation_refunds.sql | RPCreader sudah identikCloud, bodyMD5 b0e6ffc041411809fca36224607af5d2. JanganCREATEulang. |
| 20261112_booking_checkin_actual_duration.sql | Versi lama #43, body afc0e3d70f90073b2d3c6d605d20b947; disupersede cappedversion. Janganaktifkan. |
| 20261112_booking_late_checkin_checkout_cap.sql | BodyidentikCloud7aaf581931c92b9d37747ca718943f58. Janganulang; baseline bagi fixed-slotcandidate. |
| 20261113145045_booking_fixed_slot_boundary.sql | Candidatebodyfb29b1e4d72c71f5895ef8a1a1767387 belumaktif. Reviewterpisah sebelum klaim semua boundaryPagi/Malam/Harian terjamin; janganmengulang normalcasePASS. |
| 20261113150233_overtime_walkin_guard.sql | Belumaktif: occupancyindex/releasetable/releaseRPC belumada. Packagetrigger/index/Ownerrelease satu unit tersendiri; sourceindikator tidak menggantikan guardCloud. Preflightduplicatehunian/constraint/trigger/ACL dan backup wajib. |
| 20261117081000_housekeeping_retry_after_room_lock.sql | Cloudbody2756ae72d61632458a5688b037526d75, kandidat8c9dbcabf70646f89c047291cd81c0f2 belumaktif. Diperlukan sebelum klaim race/retryCloudPASS; bukan izin mengulang HK29. |
| 20261117093000_operational_truncate_acl.sql | Belumaktif; TRUNCATEanon/authenticated masihtrue pada empat tabel lama. Terpisah dari expenseoptionsACL yang sudahbenar. Revokehanya targetapproved; tidakubah globaldefaults. |
| 20261117100000_payment_retry_closing_identity.sql | RPCpayment5parameterbodye39b532635f0aa14a30992c6a87b3de9 dan Closing2e6b21c915118dbf490796b0ecd86868 masihbaseline. Perbaikan retry/NULLidentity belumaktif; prioritas keamanan sebelum ujibantuan/Closing. Janganmengganti overload lain. |
| 20261117104000_refund_retry_payload_guard.sql | Cloudbody695152a80fcd4e561759f34b27652c5a masihbaseline; koreksi retrypayload kandidat80bcdeabfc038907ee6dcea4d9d0e714 belumaktif. Independen dari paymentClosingpackage, izin sendiri sebelum uji/refundlive. |

Sourcepatch dapat disiapkan/diintegrasikan tanpa menyisipkan SQL apapun;
sembilan source memakai objek/RPC yang sudahada. Tidak ada alasan menjalankan
semuaSQL sebagai satu urutan wajib demi sourcebuild.

Urutan prioritas SQL bila Owner kemudian menyetujuinya:
paymentClosingidentity sebelum assistance/ClosingDEMO;
HKretry sebelum raceHK; operationalACL sebagai hardeningterpisah;
fixedslot dan overtimeguard sebelum klaim gerbang Booking/occupancy lengkap;
refundguard sebelum perluasan pengujian refund. Paket-paket ini tidak saling
mengharuskan dieksekusi dalam satu transaksi. Tiap paket punya izin, snapshot
definisi/ACL/index/trigger, preflightsourcefingerprint, postcheck dan recovery sendiri.

Recovery SQL: pakai snapshot asli yang tercapture dan reviewedrecovery yang ada
di supabase/review/finance-20261117 untuk Finance bila sesuaifingerprint.
Restoredefinisi lama mengembalikan bug; tidakotomatisdijalankan.
Jangan DROP occupancybackstop, truncate data, membukaFINAL, atau memberi kembali
ACLberbahaya sebagai rollbackotomatis. Full data backup/restore BELUMTERBUKTI;
harus diselesaikan sebelum izin SQL yang membutuhkan kemampuanrestore tersebut.
Penerapan aditif expenseoptions yang sudahPASS tidak membuktikan restoreDB penuh.

## Hasil dan satu tindakan berikutnya

Selesai: verifikasi source+artifactmanifest terbaru, review9file, diagnosis kartu
live, perbaikan ringkasan dalam paket yang sama, preservedCSSguard, pemisahan10SQL,
urutanaktivasi/sourcebackup/revert/postcheck/STOP.
Tidak membuat PR baru, tidak merge/deploy/publish/Cloudwrite/sourceLovable/DEMO/credit.
OldPASS dipertahankan, bukan diujiulang.
Read-onlymandat selesai; tidak ada alasan menambahfixture/teslaporan lain.

Tindakan berikutnya: terima prosedurmanusiaSupport, review dampaknya, kemudian
ajukan SATU paketpersetujuansource yang konkret kepadaOwner. Jangan meminta Owner
memilih urutanteknis. Bila Supportbelumjelas, source tetap ditahan.
Persiapanintegrasi tetap6/7=85.7%; sourceactivation+visualacceptance belumtercapai,
overallNO-GO. Tidak menyatakan kartu sudahkembali di live.
