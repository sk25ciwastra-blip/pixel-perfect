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

## Paket DEMO minimal yang diminta — BELUM DIIZINKAN, BELUM DIJALANKAN

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
setelah aman, baru satuDEMO gabungan di atas. Owner dapat menyetujui scopeDEMO
bersyarat sekarang; izinDEMO tidak mengizinkanSQL/integrasi/deploy/akun/Connect.
Tidak ada tindakanCloudwrite yang boleh berjalan hanya karena dokumenini dibuat.
