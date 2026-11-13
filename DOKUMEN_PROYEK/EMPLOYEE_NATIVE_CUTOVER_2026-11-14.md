# Gate 6A — konkurensi PostgreSQL native dan rehearsal cutover

Acuan Owner: Issue #61 komentar 6866092064. DRAFT bertumpuk pada PR #71 `849761cd47ac33e86cf839aa0cff8adb8ba86f0b`. Tidak mengubah branch/base/head PR #67–#71, frontend, SQL pending, aturan finansial atau desain.

## Lingkungan dan isolasi

Harness menggunakan PostgreSQL **native 17.11**, bukan PGlite. Binary portable berasal dari arsip yang telah tersedia di Downloads Owner; tidak mengunduh binary atau mengaktifkan service aplikasi. Runner membuat cluster baru di direktori temporary acak dan memilih port bebas pada `127.0.0.1`. Tidak menerima URL database atau membaca SUPABASE/DATABASE_URL. Server harus kosong (hanya postgres/template databases) sebelum membuat role fixture NOLOGIN dan database bernama acak khusus tes. Tidak memakai cluster lama, Auth server, email, JWT atau data sebenarnya.

CI menyediakan service disposable `postgres:17.11` pada loopback; opt-in hanya ketika GitHub Actions dan B25_NATIVE_DISPOSABLE=YES. Driver postgres 3.4.9 sudah ada dalam frozen lockfile. Dump/restore CI memakai executable dari container service yang sama, agar versi client/server sesuai. Kredensial service di workflow bersifat sintetis, bukan kredensial aplikasi.

Guard CI mencocokkan container ID job, binding port host `127.0.0.1`, serta IP bridge privat dari Docker inspect dengan `inet_server_addr()`. Guard lokal tetap mensyaratkan server loopback langsung. Percobaan CI awal ditolak karena guard awal menyamakan alamat bridge server dengan alamat loopback client; koreksi terbatas pada runner/workflow ini.

Cleanup menutup koneksi, menjatuhkan hanya database yang dibuat runner dengan prefix/random-name tervalidasi, dan menghentikan hanya cluster miliknya sendiri. Tidak melakukan recursive delete atau menghapus direktori lama. `cleanup.json` membuktikan jumlah database yang dibuat/dihapus dan shutdown cluster. Dump sintetis tetap lokal; CI mengunggah hanya evidence/cleanup JSON, tidak dump.

Prasyarat Auth/Storage/roles/cash adalah schema fixture minimal. `auth.uid()` membaca actor GUC khusus tes, bukan JWT. SET ROLE authenticated menegakkan ACL/RLS native; identitas actor hanya fixture. Ini bukan bukti validasi token Auth atau seluruh kontrak schema Cloud. Guard cash memakai definisi fungsi existing, bukan guard rekaan.

## Sumber dan urutan cutover

Harness mengambil seluruh SQL langsung dari blob Git berikut, tanpa edit/penyusunan ulang statement:

| Urutan | Dependensi | SHA | Kontrak |
|---|---|---|---|
| 1 | #67 | b4a486c747202031e52a06a5cf9d67126fc83654 | profil privat/pas foto/RLS |
| 2 | #68 | b9460e98e56ea0a58da828f2208a468e8cdb09af | lifecycle/audit/Training |
| 3 | #69 | a8acfcf548bcba11111361f0b4e03ef82dd69c38 | enrollment/ID B25EMP-001/recovery |
| 4 | #70 | 98e87d1e86803bb0d77c5aaf0a67ac846bb082ea | delivery audit/Auth-only context |
| 5 | #71 | 849761cd47ac33e86cf839aa0cff8adb8ba86f0b | adapter/frontend, tidak ada SQL tambahan |

Ledger **khusus fixture** mencatat ordinal, SHA sumber, SHA256 SQL dan trusted SQL owner. Ledger ini bukan ledger/migration history Cloud. Urutan mengikuti dependensi paket, bukan timestamp filename; #68 secara teknis memiliki fondasi Training tersendiri, tetapi release paket ini tetap dikoordinasikan sesuai urutan Owner.

SQL #69 sebelum dependensi ditolak dan tidak meninggalkan sequence. SQL #68 dengan role authenticated (meski actor bisnis Owner) ditolak karena bukan trusted SQL object owner. Setelah instalasi, security-definer owner dan hak EXECUTE sensitif diperiksa native. Helper sensitif tidak diberi EXECUTE luas; anon tidak mendapat endpoint baru. ID lama dan data legacy tidak diubah oleh instalasi.

## Bukti overlap dan invariant baru

Harness mempunyai koneksi PostgreSQL terpisah, masing-masing max=1 dan PID backend berbeda. Sesi A menahan transaksi yang sudah memanggil fungsi nyata; waiter dimulai sebelum A commit. Observer ketiga memeriksa `pg_stat_activity`, `pg_blocking_pids()` dan rantai blocker transitif. Tes gagal bila overlap tidak terbukti, bukan menganggap Promise.all cukup.

Delapan skenario:

1. Same request begin: satu reservation; retry menunggu advisory lock lalu acquired=false.
2. Cross-Owner begin request sama: benar-benar overlap, lalu idempotency mismatch; Owner lain tidak mengambil request.
3. Request berbeda dari dua Owner: transaksi terbuka bersamaan, ID global berbeda. Ini bukti transaction overlap; tidak diklaim sebagai lock wait.
4. Finalize sama: waiter menunggu transaction lock; satu employee/role/profile, hasil employee yang sama.
5. Finalize menang terhadap cancel: cancel antre melalui tuple/transaction lock, menerima COMPLETED; record Auth sintetis committed tetap ada.
6. Cancel menang terhadap finalize: finalizer ditolak karena RECOVERY_REQUIRED, tidak membuat employee. Tombstone/request mempertahankan ID; tidak ada penghapusan Auth pada tes ini.
7. Delivery claim bersamaan: hanya satu true dan satu DELIVERY_ATTEMPTED; UNKNOWN tidak otomatis dikirim ulang. Tidak ada transport email.
8. Lifecycle versi usang: satu perubahan menang, waiter ditolak; tidak ada audit transisi kalah atau overwrite.

ID B25EMP-001 yang sudah historis sengaja ada sebelum SQL terpasang; generator melewatinya. Reservation/tombstone tidak digunakan ulang, dan uniqueness employee/request diperiksa. Tidak merewind sequence, mengubah formatter atau mengasumsikan nomor selalu tanpa gap.

Emergency suspension juga diuji pada sesi caller yang tetap terbuka dengan konteks Training/sesi kas existing valid. Sebelum commit Owner, READ COMMITTED masih melihat state lama; setelah commit, query pada koneksi yang sama kehilangan izin. Mutasi sesi kas oleh trainee maupun Supervisor suspended ditolak dan cash snapshot tetap sama. **Tidak membuktikan pembatalan retroaktif statement yang telah lolos guard sebelum suspension commit.** Runtime seluruh Finance/receipt dan race mutasi in-flight tetap membutuhkan audit/tes terpisah; tidak mengubah kebijakan finansial untuk menutupnya secara spekulatif.

Setelah semua SQL terpasang, read identity Owner tetap berfungsi, staff/Training ditolak, metadata bucket tetap privat dan tidak ada field foto KTP/password/token. Direct legacy INSERT dan toggle active Owner sekalipun ditolak guard DB. Password adapter menolak arbitrary target, dan konfigurasi email kosong tetap fail-closed. Source adapter/legacy form diverifikasi sama dengan SHA #71; bukti compile/build #71 digunakan kembali karena kode aplikasi tidak berubah.

## Rehearsal restore dan batasnya

Sebelum cutover dibuat dump custom native dari baseline fixture. Sesudah race dibuat dump kedua. Masing-masing direstore ke database **baru**, tidak menimpa database sumber. Post-cutover membandingkan digest dataset sintetis, ledger dan state sequence; bucket privat dan ACL callback anon-deny juga diperiksa. Pre-cutover restore mengembalikan data legacy, ledger kosong serta belum adanya tabel enrollment baru. Kedua restore benar-benar dijalankan, bukan sekadar perintah dalam dokumen.

Ini membuktikan restore database fixture dalam cluster sama dengan role global yang sudah tersedia. **Bukan backup Cloud/produksi atau full disaster recovery**: Auth service/session, email yang telah terkirim, secret/config provider, role global dan file Storage asli tidak dicakup oleh dump ini. Metadata Storage saja tidak menyimpan file wajah. Mengembalikan snapshot lama pada produksi setelah enrollment baru dapat menghilangkan relasi/nomor yang sudah diterbitkan; jangan menggunakan restore sebagai kompensasi otomatis akun committed.

Rencana release/rollback yang masih memerlukan persetujuan:

1. Bekukan exact SHA/dependency graph dan cocokkan schema/ACL/owner/ledger target aktual secara read-only; mismatch menghentikan release. Semua SQL tetap file PENDING.
2. Siapkan backup tervalidasi yang mencakup DB, globals, konfigurasi Auth, mapping akun dan Storage objects; sepakati cutover window dan write freeze. Jangan menjalankan test dump ini terhadap Cloud.
3. Pasang field/kontrol modal final menggunakan adapter #71 dan buktikan browser/roles sebelum cutover. Form lama sengaja masih blocked pada branch dependensi; tidak boleh me-release frontend/SQL secara independen dan membuat registrasi operasional rusak.
4. Persetujuan Owner terpisah untuk sender/domain, SMTP, callback HTTPS dan verifikasi live provider; provisioning/delivery tetap BLOCKED sampai lengkap. Jangan menganggap signature konfigurasi sebagai verifikasi SMTP langsung.
5. Jalankan perubahan terkoordinasi hanya setelah pemeriksaan berikutnya/izin eksplisit. Bila gagal sebelum write baru, pertimbangkan restore tervalidasi dalam maintenance window; setelah write baru, stop write, rekonsiliasi ledger/Auth/Storage dan siapkan perbaikan forward. Jangan reset sequence, hapus akun committed, rollback SQL membabi buta atau kirim ulang UNKNOWN.

## Menjalankan dan artefak

Windows PowerShell, menggunakan binary lokal yang sudah tersedia:

```powershell
$env:B25_NATIVE_BIN='C:/Users/USER/AppData/Local/Temp/b25-employee-native-tools-20261114/pgsql/bin'
node scripts/employee-native-rehearsal.cjs
```

Tanpa binary/opt-in CI, runner mencetak NOT REACHED dan exit 2; tidak fallback PGlite. Semua nama database/port/folder dipilih runner; tidak ada opsi URL Cloud.

Laporan artifact setiap run: `evidence.json` (SHA/digest, PID/lock chain, restore flags, gate matrix), `cleanup.json`, serta dump dan server.log sintetis lokal. Tidak mencetak token, password, NIK atau email ke log. Percobaan awal menemukan runner startup Windows menahan pipe proses server dan antrean tuple lock transitif; keduanya diperbaiki di harness saja. Tidak ada temuan gagal yang memerlukan perubahan kode PASS #67–#71.

Run lokal final PASS: `C:\Users\USER\AppData\Local\Temp\b25-employee-native-6ZlJ5i\evidence.json` dan `cleanup.json` pada folder yang sama. Backend holder 10900; waiter finalize 4580; recovery waiter 1180 terblokir melalui 4580 menuju 10900. Dua Owner berbeda memiliki transaksi terbuka bersamaan pada PID 10900/3460. Cleanup: tiga database dibuat/dihapus, cluster dihentikan. Angka PID hanya bukti run tersebut dan berubah pada run lain.

## Gate matrix

| Gate | Status berbasis bukti |
|---|---|
| 1–4 | PASS terkunci sesuai checkpoint Owner, suite lama tidak diulang |
| 5 | PARTIAL — modal final/browser belum cutover; legacy form tetap NO-GO |
| 6A | PASS — native concurrency + disposable cutover/restore saja |
| 6 keseluruhan | PARTIAL — real Auth/SMTP/Storage/expiry/provider masih NOT REACHED |
| 7 | NOT REACHED — browser/roles dan coordinated release approval |

Persentase tetap **4/7 = 57,1%**, ukuran kasar paket karyawan #61, bukan seluruh kesiapan operasional. Tidak menaikkan persen untuk subgate 6A/PR baru. Typecheck/build dan suite lama tidak diulang karena tidak ada kode aplikasi berubah; pemeriksaan syntax JS/workflow serta native harness saja yang relevan.

Tindakan berikutnya paling dekat: sambungkan modal registrasi/lifecycle resmi ke adapter #71 dan jalankan browser terfokus agar gate5 dapat dinilai PASS. Sender/SMTP/callback menunggu keputusan Owner secara paralel. Tidak ada merge/deploy/publish/SQL Cloud, DEMO/flags, email nyata atau Lovable.

Referensi mekanisme bukti: [PostgreSQL 17 locking](https://www.postgresql.org/docs/17/explicit-locking.html), [pg_backend_pid dan pg_blocking_pids](https://www.postgresql.org/docs/17/functions-info.html).
