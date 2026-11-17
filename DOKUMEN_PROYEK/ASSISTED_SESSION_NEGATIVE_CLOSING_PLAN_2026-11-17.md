# Baturaden 25 Homestay — bantuan sesi dan Closing minus

17 November 2026 WIB. Melanjutkan PR83 head18a7ca2. Pemeriksaan baru SELECT/source
saja; tidak menjalankan ulang TRX27/28/29 atau suitePASS lama. Dokumen ini
menggantikan usulan pengujian yang sudah dikonsumsi di preflight Closing lama.

## Bukti kesiapan dan hambatan aktual

- Lovable masih3218bd2ebe8fd98a6a046c9fe105d21293de34ca; paket9file belum aktif.
- Receptionist DEMO abb11176-8f20-45f8-8514-5869ff00a9e7 tidak memiliki sesiOPEN.
  Dua sesi uji tetapFINAL. Sesi terakhir29d2f77d-9014-4471-bd19-03afdda3270f
  mempunyai DIBAWA70000. Definisi open_finance_cash_session memakai DIBAWA sesi
  FINAL terakhir sebagai saldo awal berikutnya, mengabaikan input0 bila ada
  sesi sebelumnya. Jadi skenario baru harus mengharapkan opening_cash70000.
- Ada sesiOwner OPEN sejak21Oktober, berisi10pembayaran dan1pengeluaran;
  sesiQAReceptionist lama OPEN sejak5November berisi0pembayaran/0pengeluaran.
  Keduanya tidak disentuh atau dipakai untuk membuat defisit.
- Supervisor aktif dengan roleemployee tersedia secara administratif.
  Login Supervisor belum diuji; tidak meminta/membaca password atau mengubah akun.
  Jalur minimal di bawah memilih Owner, tidak mensyaratkan kredensial Supervisor.
- payments.recorded_by adalah operator; cash_session_id menghubungkan sesi,
  finance_cash_sessions.opened_by pemilik. finance_prepare_payment menerima helper
  Owner/Supervisor dengan guardTraining; definisi tersedia, belum bukti writeLIVE
  dua identitas berbeda. Tidak menambahkan pembayaran pada TRX yang sudah lunas.
- finance_expenses.recorded_by diisi auth.uid() oleh RPC; session_id menentukan
  sesi penerima pengeluaran. RPC membolehkan helperOwner/Supervisor.
- Closing mempertahankan opened_by dan menyimpan actualoperator pada closed_by
  serta closing_snapshot.closed_by. Helper wajib alasan tidak kosong.
- Closing body MD5 tetap2e6b21c915118dbf490796b0ecd86868, sama baseline resmi.
  MD5 pg_get_functiondef berbeda karena mencakup wrapperDDL; jangan dianggap drift
  prosrc. Pending nullidentity guard sudah ada pada
  supabase/pending/20261117100000_payment_retry_closing_identity.sql; tidak diduplikasi.
- expected_cash = opening_cash + Cash payments - CASH expenses - CASH refunds.
  Saldo negatif diizinkan, alokasi fisikCASH harus0. Transfer terpisah.
  Tidak ada penambahan tabel/transaksi/fitur talangan pribadi dalam jalurClosing.
- Source sesi kas live masih ownSession ?? assistedSession; tidak memberi notifikasi
  same-tab. Finance punya own-first dan overwritekonteks terpisah. Perbaikan sudah
  tersedia di paket9file PR83; tidak dibuat ulang, belum aktif.
- Hambatan BARU yang konkret untuk DEMO minus lewat form KasKeluar:
  SELECT to_regclass('public.finance_expense_options') menghasilkanNULL.
  SourceDashboard membutuhkan daftar jenis dan keperluan yang aktif; dropdown
  disabled bila tabel/daftar tidak tersedia. Tidak boleh bypass lewat SQL/RPCmanual.
  Persiapan existing: supabase/pending/20261023_expense_options_and_extra_guest.sql,
  BagianA hanya tabel/RLS pilihanpengeluaran; BagianB adalah komentar lama.
  Tidak mengaktifkan extraGuest; reservasi tepat2tamu tetap keputusanfinal.
- RLS expense SELECT hanya recorded_by=auth.uid() atau Owner/Supervisor.
  Receptionist tidak dapat membaca detail expense yang dibuat helperOwner meskipun
  milik sesinya. Ini batas akses aktual, bukan bukti data hilang. Tidak memperluas
  RLS. Verifikasi detail assistedExpense dan Closing dilakukan sebagaiOwner dan
  SELECTauthorized; keterbatasan histori Receptionist tetap dicatat.

## Satu perbaikan source yang diperlukan sekarang

Keuangan membuat rowpengeluaran dengan nama((expense as {created_by?:string}).created_by),
sementara tabel/RPC hanya menyimpan recorded_by. Akibatnya identitas pengeluaran
tidak terbaca pada kolomPetugas walau UUIDactor benar di backend.

Diperbaiki satu expression menjadi nama(expense.recorded_by) di counterpartGitHub
dan hunkFinance paket yang SUDAH ADA. Paket tetap9file; artifacthashmanifest
diperbarui. Tidak menyentuh layout, ACL, uang, schema atau dataCloud.
Resolver nama tetap mengikuti employees yang boleh dibaca; bila tidak ada
namaOwner di direktori, UI tetapTidak diketahui. Tidak mengarang nama dari
pemilik sesi. Perbaikan mapping tidak mengklaim semua namaActor terjamin terlihat.

Regressionbaru scripts/finance-expense-operator.test.cjs:
- baselineactualsource mereproduksi actorunknown;
- mappingcandidate dari actualpatch dan counterpartGitHub memakai recorded_by;
- actor yang hilang tetapunknown, tidak diganti pemilik sesi;
- nominal dan IDexpense tetap; changedTSXsyntaxPASS.
Complete updated9filepatch diterapkan terhadap9pinnedsourcehashes, artifacthashPASS.
Tidak menjalankan ulang suitePASS lama. Ini PASS LOKAL/GITHUB; belum aktifLovable.

## Paket DEMO minimal — DISETUJUI BERSYARAT, BELUM DIJALANKAN

Tujuan: membuktikan bantuanOwner pada sesiReceptionist dan Closingminus dengan
SATU sesi baru, SATU pengeluaran sintetis, SATUClosing; tanpaBooking/payment/refund
atauTRX baru. Scope ini tidak membuktikan assistedPAYMENT; tetapBELUMDIUJI.

Prasyarat sebelum penulisan pertama:
1. Support mengonfirmasi originalrepo1391084125, safe reattachment dan arahSync.
   Sourceintegration9file serta guardCloud yang relevan diaktifkan hanya dengan
   persetujuankhusus terpisah; tidak digabung diam-diam dengan persetujuanDEMO.
2. BagianA expenseoptions existing direview, backup/dependency/rollback disiapkan,
   diterapkan hanya dengan izinSQL khusus. Owner membuat dua opsi aktif melalui
   UI: jenis DEMO WORK, keperluan DEMO WORK. Pembuatan dua opsi juga perlu izin.
   Tidak menjalankan seluruh pendingSQL lain atau bagianextraGuest.
3. Recheck SELECT: Receptionist masih tanpaOPEN, lastFINAL+DIBAWA70000 unchanged,
   Owner sah tersedia, kategori/keperluan terbaca, tidak ada drift.
4. Verifikasi konteks read-only setelah perbaikanaktif: explicitBantuSesiAktif
   tetap terpilih saatDashboard->Keuangan->formKasKeluar walauOwner punyaOPEN.
   Labelpemilik dan exactsessionUUID benar. Gagal salah satu -> STOP sebelumexpense.

Urutan setelah SEMUA izin dan prasyarat terpenuhi:
A. Receptionist login sendiri dan membuka tepat1sesi, expectedopening70000,
   opening_source_session_id=29d2f77d-9014-4471-bd19-03afdda3270f.
   Input tidak dipakai untuk memaksa saldo0; periksa carryforward normal.
B. Owner login sendiri, pilih BantuSesiAktif menuju sesiA. SesiOwner lama tidak
   ditutup/diubah. Setelah read-onlycontextPASS, simpan tepat1KasKeluarCASH71000,
   kategori dan keperluanDEMO WORK, note:
   "DEMO WORK — uji bantuan sesi dan Closing minus sintetis".
   Ini simulasi yang sengaja melampaui saldo70000 sebesar1000; tidak ada uang riil.
C. SELECT: tepat1expense, session_id=A, recorded_by=Owner yang login dan
   berbeda dari opened_byReceptionist. Saldo70000-71000=-1000.
D. Masih sebagaiOwner, Finance harus memakai sesiA yang sama. Finalkan sekali,
   reason "DEMO WORK — bantuan Owner, Closing minus Rp1000 sintetis".
   setor_cash/setor_transfer/di_laci/dibawa0, tanpa penerimaDI_LACI.
E. SELECT: sesiAFINAL; opened_by tetapReceptionist; closed_by/snapshot.closed_by
   Owner; opening70000,cash_received0,cash_expenses71000,cash_refunds0,
   expected_cash-1000, seluruhalokasi0; allocation/handoffbaru0.
   Detailpengeluaranactor dancloser sesuaioperator, tidak mengubahhistoris sesi29.
   SesiOwner lama, sesiQA lama, pembayaran/TRX/room/historiHK tetap.

PASS: seluruhidentity, exactUUID, nominal, snapshotminus dan jumlahrow cocok;
UI dapat menutup normal dan tidak menawarkanFinalkanulang sesiFINAL.
FAIL/STOP: context berubah keOwner sendiri, pembukaan saldo selain70000,
summaryberbedaUUID/tidaktersedia, expenseganda, saldo/peran/actor tidak cocok,
Closing menolakminus, atau menambah catatantalangan. Jangan menyesuaikan data untukPASS.

Timeout/error: SELECT dahulu sebelumretry, jangan duplicate. FINAL tidak
dibukaulang. Tidak ada rollback yang menghapusbukti atau membalik status;
koreksi baru memerlukan keputusanOwner. Jika gagal setelahexpense tersimpan,
pertahankanrow dan laporkan; tidak menambah transaksi kompensasi otomatis.
Tidak membuka sesi berikutnya setelahClosing.

## Support, izin, progres

ThreadGmail1a1e7e19b33891ec masih berakhir dengan jawabanSam17Nov12:07WIB dan
balasanOwner12:10WIB. PencarianpesanSupport17Nov tidak menemukan panduan baru.
Sam meminta janganConnect karena bisa membuatrepobaru; manusiaSupport akan
menangani backendreattachment. Tidak mengirimemail atau menjalankanConnect.

Read-onlypreparation cakupanbaru selesai: konteks/akun/sesi, definisiClosing,
dependensiKasKeluar, kandidatactorfix, paketDEMO dangerbangSync (6/6=100% persiapan).
Bukan100%fungsiLIVE. Persiapanintegrasi tetap6/7=85.7%, operasionalNO-GO.
PASSLIVE lama dipertahankan; assistedexpense/assistedClosing/negativeClosingLIVE
belumdiuji. Sourcefix SUDAH DIPERBAIKI TAPI BELUM AKTIF.

Prioritas: selesaikan dependensiExpenseoptions dan aktivasiSource secara terpisah
setelah aman, baru satuDEMO gabungan di atas. Owner telah menyetujui scopeDEMO bersyarat melalui pesan 'ok saya setuju'
setelah laporan commit8e94262; izinDEMO tidak mengizinkanSQL/integrasi/deploy/akun/Connect.
Tidak ada tindakanCloudwrite yang boleh berjalan hanya karena dokumenini dibuat.


## Persetujuan DEMO tercatat dan rencana penerapan opsi pengeluaran

Owner menyetujui satu skenario sesi70000 -> expense71000 -> Closing-1000.
Tidak ada izin baru untukSQL/source/Connect. Tidak menjalankan DEMO sebelum
prasyarat di atas tersedia. Tidak mengulang pengujian yang sudahPASS.

PreflightSELECT tambahan setelah persetujuan:
- Target public.finance_expense_options tetap tidak ada, sehingga tidak ada
  isi tabel lama yang akan ditimpa atau perlu dipindahkan.
- public.can_operate(uuid), public.has_role(uuid,app_role), auth.uid(),
  gen_random_uuid(), rolesauthenticated/service_role tersedia.
- can_operate prosrcMD5=8f676083af6ccfdedc51b40bfd21aa84;
  has_role=329c61a02658089cb1486c876cc6405d.
- record_finance_expense prosrcMD5 tetap4c5473061181fa5c3f47952cf0a7381e.
- Existing pendingSQL blobd1ead807f6d79f1185b6dc7c8589c6b21406d864
  dibaca ulang dari head8e94262; belum dijalankan.
- Support search tetap tidak menemukan instruksi lebih baru. Ini tidak
  diartikan izinConnect atau konfirmasi reattachment selesai.

Rencana perubahan terpisah yang siap dimintakan izin:
1. Hanya BagianA dari existing
   supabase/pending/20261023_expense_options_and_extra_guest.sql.
   Pinblob di atas, ulangi precondition targetabsent/dependencyfingerprints
   tepat sebelum eksekusi. Jika berubah, STOP; jangan DROP/overwrite.
2. Bungkus seluruhDDL BagianA dalam satuBEGIN/COMMIT, lock_timeout5s,
   statement_timeout60s; validasi target/schema/policies sebelumCOMMIT.
   Satu tabel baru; empat policyRLS (read, Ownerinsert/update/delete);
   grantauthenticated/service_role sesuaiSQLexisting. Tidak mengubah tabel,
   RPC, transaksi, sesi atau auth yang sudah ada.
3. Bila validasi/DDLgagal sebelumCOMMIT: ROLLBACK seluruhtransaction,
   kemudianSELECTtarget untuk konfirmasi; tidakmelanjutkan sebagian.
4. SetelahCOMMIT, Owner login sah membuat tepatduaopsi melaluiUI:
   kindjenis/nameDEMO WORK dan kindkeperluan/nameDEMO WORK, keduanyaactive.
   created_by harus auth.uid()Owner, bukan UIDkosong dari querySQL.
   Tidak mengisi pilihan bisnis permanen atau membuat kategori lainnya.
5. PostcheckSELECT: kolom/constraint, RLSaktif, policyroles/qual sesuai,
   granttidakmelebar, hanya duaopsi yang disetujui; kemudian cek dropdownUI.
   Tidak menyimpanKasKeluar/Closing pada tahap penyiapandepedensiini.

Dampak: halamanDaftarPengeluaran dapat menyimpan pilihan Owner; formKasKeluar
yang sebelumnya dropdowndisabled dapat memakai pilihan aktif. HakCRUDpilihan
tetapOwner; pembacaan mengikuti policyexistingcan_operate/Owner.
Penerapan ini tidak memperbaiki sendiri kontekshelper atau mengaktifkan9file.
Tidak ada perubahan jumlah tamu, harga, DP, flag atau desain.

Pemulihan setelahCOMMIT:
- Bila hanya masalahduaopsi dan belum dipakai, Owner dapat menonaktifkan
  keduaopsi melaluiUI setelah izinpemulihan khusus; pertahankan bukti.
- Jangan otomatisDROPtable setelahCOMMIT. Jika diperlukan, cekdependensi dan
  eksporrows/DDL/grants/policy terlebihdahulu, minta izinpenghapusan terpisah,
  lakukantransaction, dan verifikasitargetabsent. Jangan CASCADE.
- RestoredataDB menyeluruh tidak diuji atau diklaimsiap. Baseline targetabsent
  hanya mencakup perubahanaditif ini; tidak memberi izinmigrasilain.

Izin yang masih diperlukan untuk tahapdependensi: terapkanBagianA saja dan
buatduaopsiDEMO WORK. IzinDEMO yang telah diterima tidak mencakup tahaptersebut.
Integrasi9file tetap menunggu prosedurSupport dan persetujuanOwner sendiri.


## HASIL PREFLIGHT PENERAPAN TERBATAS — STOP SEBELUM WRITE

Owner memberi izin eksplisit hanyaBagianA versi blobd1ead807f6d79f1185b6dc7c8589c6b21406d864,
duaopsiOwner, dan postcheck. Owner memerintahkan STOP bila preflighttidaksesuai.

Pemeriksaan terbaru:
- SQLblob, targetabsent, dependencies dan prosrcfingerprints sesuai baseline.
- PemeriksaanACLdefault yang belum tercakup preflightsebelumnya menemukan
  defaultgrants milik rolepostgres (executoraktual) untuk objekTABLE schemapublic:
  anon dan authenticated mendapat SELECT/INSERT/UPDATE/DELETE/TRUNCATE/
  REFERENCES/TRIGGER/MAINTAIN. service_role memperoleh hakpenuh;
  sandbox_exec memperolehSELECT/INSERT. Hakservice/sandboxinternal tidak diubah.
- BagianA hanya menambahGRANTCRUDauthenticated dan RLS, tidak mencabut
  hakdefaultanon/authenticated. GRANT bukan pengganti atau pembatas hakexisting.
  Maka hasilakses efektif tidak sesuai rencana hak yang telah direview.
- RLS tidak menjamin pembatasanTRUNCATE. Ini risikoSQLrole, bukan klaim bahwa
  browseranon langsung mempunyai endpointTRUNCATE. Tidak mencoba exploit.
- Existingpending operational_truncate_acl hanya mencakup rooms/transactions/
  housekeeping_history/housekeeping_checklists, bukan tabelopsibaru.
  Tidak menjalankan pendingtersebut atau mengubahprivilege tabel lain.
- Penerapan dihentikan SEBELUM BEGIN/DDL/write. Tidak ada COMMIT/ROLLBACK
  yang dijalankan karena tidak ada transaksi perubahan dimulai.
  Duaopsi belum dibuat, dropdownbelumdiuji. Tidak adaDROP/reset.

Kandidat koreksi disiapkan pada FILESQLPENDINGYANGSAMA (bukan migrasibaru):
sesudah CREATE TABLE, sebelumGRANTexisting, tambahkan tepat:
REVOKE ALL PRIVILEGES ON TABLE public.finance_expense_options FROM PUBLIC, anon, authenticated;
Kemudian GRANTCRUDauthenticated dan ALLservice_roleexisting, empatpolicyRLSexisting.
BagianB dan keputusanreservasi2tamu tidak berubah; tidakmengubahdefaultACLglobal,
roleinheritance, RPC, akun atau tabeloperasionalexisting.

Status: koreksi baru reviewsource saja, BELUM DITERAPKAN CLOUD,
BELUM DIUJI LIVE. SQLoriginal tidak pernah diterapkan.
Sebelum approvalbaru, janganmenggunakan versiSQLkoreksi sebagai izinimplisit.
Tidak menjalankan suitelokalPASS lama atau membuatfixture tambahan.

Penerapan setelah persetujuan versi koreksi:
- Rechecksameproject/targetabsent/dependencies/fingerprints dan sourceblobbaru.
- SatuBEGIN/COMMIT membungkus BagianA+REVOKEtargeted, lock_timeout5s,
  statement_timeout60s. Tidak ada executeBagianB.
- ValidasiSEBELUMCOMMIT wajib: enamkolomsesuaiDDL, constraintPK/unique/checks,
  RLStrue, empatpolicyroles/predicate persisrencana, rowcount0,
  authenticated memilikiCRUD dan tidakTRUNCATE/REFERENCES/TRIGGER/MAINTAIN,
  anon/PUBLIC tidak memiliki hak tabel, service_role tetap hakpenuh.
  Gunakan effectiveprivilegechecks ditambahaclexplode untukPUBLIC;
  jangan hanya menghitungGRANTeksplisit.
- Bila hak efektif masih lebih luas atau validasilain gagal: ROLLBACK,
  SELECTpastikantargetabsent; STOP danlapor, tanpaREVOKEglobal/DROP/reset.
- SetelahCOMMITbaru loginOwner yang sah dan buat tepat2opsiDEMO WORK melaluiUI,
  lalu postcheckactor/rowcount/RLS/ACL/dropdown. Tidak memalsukan auth.uid()
  atau memasukkanrow lewatSQLprivileged.
- Efekfungsional formKasKeluar menjadi dapat memakai pilihanaktif tetap
  sama dengan rencana yang sudahdijelaskan; tidakmenyimpanexpense/Closing.

IZINBARUYANGDIPERLUKAN: menyetujui BagianA yang ditambahREVOKEtargeted diatas,
tetap satu transaksi dengan validasisebelumCOMMIT, lalu tepatduaopsiDEMO WORK.
Ini tidak meminta perluasan keSQLlain/sourceintegration/DEMOwrite/Connect.
Integrationpreparation tetap6/7=85.7%, overallNO-GO.

## POSTCHECK AKTUAL — BAGIAN A BERHASIL DITERAPKAN

17 November 2026 WIB. Owner secara eksplisit menyetujui BagianA versikoreksi
commit e0dc6b15e95e85e283ccd806c70052d84be1e7e7 dan tepatduaopsiOwner.
Bagian ini menggantikan statusSTOP/pending untuk DEPENDENSI OPSIPENGELUARAN saja.
Source9file dan semua pendingSQLlain tetap BELUM AKTIF/tidakdiizinkan.

### PASS CLOUD — DDL atomic dan hakakses

Preflight tepatsebelumwrite: targetabsent, executorpostgres, sourceblob
eb6bbdbf6e00a4d23c80f9a28a2a24c4cb031ac8, helper/expenseRPCfingerprints cocok.
Hanya substringCREATE TABLE sampai akhirBagianA yang dieksekusi.
SatuBEGIN; lock_timeout5s; statement_timeout60s; satuDO berisi precondition,
DDLapproved persis, dan validasisebelumCOMMIT; kemudianCOMMIT.
Tidak ada error/rollback. Timestampresult2026-11-17T12:14:00.784597Z
=19:14:00.784597WIB.

ValidatedbeforeCOMMIT:
- Enamkolom, tipe/nullability/defaultsesuaiDDL.
- Empatconstraint: PKid, uniquekind+name, duaCHECKvalidated.
- RLSenabled, tepatempatpolicy; nama/cmd/authenticatedrole/permissive/
  USING/WITHCHECK cocok dengan predicateapproved.
- Effectiveprivilegeanon semuaSELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
  TRIGGER/MAINTAIN=false; aclexplode menunjukkan tidakadaPUBLICgrant.
- authenticatedCRUD=true, privilegeextraTRUNCATE/REFERENCES/TRIGGER/MAINTAIN=false,
  tidakadagrantoption. service_role hakpenuh tetap.
- DefaultACLglobal hash sebelum/sesudah sama. Hakinternalpostgres/sandbox_exec
  bawaan tidak diubah. Tidak ada alterdefaultprivileges atau revoke pada tabelold.
- Rowcount0sebelumCOMMIT. HasilsetelahCOMMIT: tableexists, RLStrue,
  policycount4, optioncount0, anon_anyfalse, authenticated_extrafalse.
Ini pemeriksaancatalog/effectiveACL, bukan percobaanmerusak/truncate.

### PASS LIVE LOVABLE — Owner membuat duaopsi, dropdown dapat dipilih

AkunHK logoutnormal, Owner login sendiri melalui mekanismesah.
Requestprivatecredential berakhirdeclined; DOMfresh menunjukkan Pemilik/Owner
sudahlogin secara manual. Tidak mengulangi request atau membaca password.

Melalui Pengaturan->DaftarPengeluaran, dua kaliklikTambah masing-masingsekali:
1. kindjenis/nameDEMO WORK/activetrue,
   UUID e15ffd1a-2ef4-475d-8b0a-d3536d71f692,
   created_at19:17:47.162007WIB.
2. kindkeperluan/nameDEMO WORK/activetrue,
   UUID c40102b7-54f2-495a-94de-954154412cbe,
   created_at19:18:04.421991WIB.
Keduacreated_by=33fb197c-352a-4d1f-bf3a-39bd513ab255;
SELECT has_role(created_by,'owner')=true. Tidakinsert lewatSQL/impersonation.

Dashboard->EXPENSE dibuka untukpostcheckread-only. Kedua native selectenabled,
masing-masing memuat tepatplaceholder+DEMO WORK. Keduanya berhasilselectDEMO WORK.
Tidakmengisinominal/keterangan dan TIDAKklikSimpanPengeluaran.
Form ditutup melaluiBatal. BuktiJPEG b25_expense_options_live.jpg menunjukkan
duapilihan dipilih padaactualform, sebelumdibatalkan.

SELECTakhir:
options_total2, valid_owner_options2,
new_expenses0/new_sessions0/new_payments0/new_transactions0
sejak2026-11-17T12:14:00Z. ACL dan empatpolicy dicaptureulang; sesuai.
Tidak menghapusdata atau mengulang teslamaPASS. Tidakmengubahakun/password,
jumlahtamu, roomstatus, sourceLovable, flag, BagianB atauSQLlain.

### Kelanjutan dan batas

Cakupanterbatas ini selesai3/3: (1) DDL+validasiatomic,
(2) duaopsiOwner, (3) DB+dropdownpostcheck =100%.
Bukan100%aplikasi atau izinGO.
Integrationpreparation tetap6/7=85.7%, operasionalNO-GO.
Bantuanlintasakun/Closingminus tetap BELUMDIUJI LIVE.
Finance/sessioncontext/actormapping candidate tetap SUDAH DIPERBAIKI TAPI BELUM AKTIF.
Approvalterakhir secaraeksplisit tidakmencakup expense/Closing/integrasi9file.
Jangan menganggap persetujuanDEMO bersyarat sebelumnya menghapus gate baruini.

PemeriksaanindependenSupport: pencarianGmail tidakmenemukan instruksiSyncbaru;
pesanterbaruSam17Nov12:07WIB masihminta janganConnect, tunggureattachmentmanusia.
Tidak mengirimemail atauConnect.
Prioritasteknis: prosedurSupportoriginalrepo/arahsync -> persetujuanintegrasi9file
-> penerapan dan contextacceptanceread-only -> izin eksekusiDEMO yang masihberlaku
atau diperbaruisesuai batasOwner. Jangan membuka sesi atau menyimpan expense sekarang.

### SQL transaksi yang benar-benar dieksekusi

Disimpan untukauditableevidence saja. JANGANjalankanulang: tabelsudahada.
Tidak disimpan sebagai migrasibaru atau ditambahkan ke migrasihistory.

```sql
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public;
DO $validated$
DECLARE
  defaults_before text;
  defaults_after text;
  col_record record;
  got_columns text[];
  got_defaults text[];
  acl_bad boolean;
BEGIN
  IF current_user <> 'postgres' OR to_regclass('public.finance_expense_options') IS NOT NULL
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.can_operate(uuid)'::regprocedure) <> '8f676083af6ccfdedc51b40bfd21aa84'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.has_role(uuid,public.app_role)'::regprocedure) <> '329c61a02658089cb1486c876cc6405d'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.record_finance_expense(uuid,uuid,numeric,text,text,text)'::regprocedure) <> '4c5473061181fa5c3f47952cf0a7381e'
     OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('gen_random_uuid()') IS NULL
     OR (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) <> 3
  THEN RAISE EXCEPTION 'STOP: approved source dependency/target drift'; END IF;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid)::text,'')) INTO defaults_before FROM pg_default_acl d;
  EXECUTE $approved_bag_a$
CREATE TABLE public.finance_expense_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('jenis', 'keperluan')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);
-- PENDING RE-APPROVAL: neutralize inherited default grants on this new table only.
-- Does not change database-wide defaults or privileges on any existing table.
REVOKE ALL PRIVILEGES ON TABLE public.finance_expense_options FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_expense_options TO authenticated;
GRANT ALL ON public.finance_expense_options TO service_role;
ALTER TABLE public.finance_expense_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_options_read ON public.finance_expense_options FOR SELECT TO authenticated
  USING (public.can_operate(auth.uid()) OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY expense_options_owner_insert ON public.finance_expense_options FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner') AND created_by = auth.uid());
CREATE POLICY expense_options_owner_update ON public.finance_expense_options FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY expense_options_owner_delete ON public.finance_expense_options FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
$approved_bag_a$;
  SELECT array_agg(a.attname::text||':'||format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text ORDER BY a.attnum),
         array_agg(coalesce(pg_get_expr(d.adbin,d.adrelid),'') ORDER BY a.attnum)
    INTO got_columns,got_defaults
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.finance_expense_options'::regclass AND a.attnum>0 AND NOT a.attisdropped;
  IF got_columns IS DISTINCT FROM ARRAY['id:uuid:true','kind:text:true','name:text:true','active:boolean:true','created_by:uuid:true','created_at:timestamp with time zone:true']
     OR got_defaults IS DISTINCT FROM ARRAY['gen_random_uuid()','','','true','auth.uid()','now()']
  THEN RAISE EXCEPTION 'STOP: column/default mismatch % %',got_columns,got_defaults; END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.finance_expense_options'::regclass)<>4
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.finance_expense_options'::regclass AND contype='p' AND conkey=ARRAY[1]::smallint[])
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.finance_expense_options'::regclass AND contype='u' AND conkey=ARRAY[2,3]::smallint[])
     OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.finance_expense_options'::regclass AND contype='c' AND convalidated)<>2
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.finance_expense_options'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%jenis%' AND pg_get_constraintdef(oid) LIKE '%keperluan%')
     OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.finance_expense_options'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%char_length(btrim(name))%' AND pg_get_constraintdef(oid) LIKE '%60%')
  THEN RAISE EXCEPTION 'STOP: constraint mismatch'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.finance_expense_options'::regclass)
     OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.finance_expense_options'::regclass)<>4
  THEN RAISE EXCEPTION 'STOP: RLS mismatch'; END IF;
  IF EXISTS (
    WITH expected(policy_name,cmd,q,c) AS (VALUES
      ('expense_options_read','r','can_operateauth.uidORhas_roleauth.uid,''owner''',''),
      ('expense_options_owner_insert','a','','has_roleauth.uid,''owner''ANDcreated_by=auth.uid'),
      ('expense_options_owner_update','w','has_roleauth.uid,''owner''','has_roleauth.uid,''owner'''),
      ('expense_options_owner_delete','d','has_roleauth.uid,''owner''','')
    ), actual AS (
      SELECT polname::text AS policy_name,polcmd::text AS cmd,polpermissive,polroles,
        regexp_replace(replace(replace(coalesce(pg_get_expr(polqual,polrelid),''),'public.',''),'::app_role',''),'[[:space:]()]','','g') AS q,
        regexp_replace(replace(replace(coalesce(pg_get_expr(polwithcheck,polrelid),''),'public.',''),'::app_role',''),'[[:space:]()]','','g') AS c
      FROM pg_policy WHERE polrelid='public.finance_expense_options'::regclass
    )
    SELECT 1 FROM expected e FULL JOIN actual a USING(policy_name)
    WHERE a.cmd IS DISTINCT FROM e.cmd OR a.q IS DISTINCT FROM e.q OR a.c IS DISTINCT FROM e.c
      OR NOT a.polpermissive OR a.polroles IS DISTINCT FROM ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]
  ) THEN RAISE EXCEPTION 'STOP: policy identity/predicate mismatch'; END IF;
  IF has_table_privilege('anon','public.finance_expense_options','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     OR EXISTS(SELECT 1 FROM pg_class t CROSS JOIN LATERAL aclexplode(t.relacl) a WHERE t.oid='public.finance_expense_options'::regclass AND a.grantee=0)
     OR EXISTS(SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) p WHERE NOT has_table_privilege('authenticated','public.finance_expense_options',p))
     OR has_table_privilege('authenticated','public.finance_expense_options','TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     OR EXISTS(SELECT 1 FROM pg_class t CROSS JOIN LATERAL aclexplode(t.relacl) a WHERE t.oid='public.finance_expense_options'::regclass AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='authenticated') AND a.is_grantable)
     OR EXISTS(SELECT 1 FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p WHERE NOT has_table_privilege('service_role','public.finance_expense_options',p))
  THEN RAISE EXCEPTION 'STOP: effective ACL mismatch'; END IF;
  IF (SELECT count(*) FROM public.finance_expense_options)<>0 THEN RAISE EXCEPTION 'STOP: unexpected rows'; END IF;
  SELECT md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid)::text,'')) INTO defaults_after FROM pg_default_acl d;
  IF defaults_after IS DISTINCT FROM defaults_before THEN RAISE EXCEPTION 'STOP: global defaults changed'; END IF;
END;
$validated$;
COMMIT;
SELECT to_regclass('public.finance_expense_options')::text AS created_table,
 (SELECT relrowsecurity FROM pg_class WHERE oid='public.finance_expense_options'::regclass) AS rls_enabled,
 (SELECT count(*) FROM pg_policy WHERE polrelid='public.finance_expense_options'::regclass) AS policy_count,
 (SELECT count(*) FROM public.finance_expense_options) AS option_count,
 has_table_privilege('anon','public.finance_expense_options','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS anon_any,
 has_table_privilege('authenticated','public.finance_expense_options','TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS authenticated_extra,
 now() AS verified_at;
```
