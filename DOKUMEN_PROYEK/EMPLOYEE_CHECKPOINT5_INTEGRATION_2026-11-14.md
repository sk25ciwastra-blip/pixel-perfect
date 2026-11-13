# Checkpoint 5 — integrasi fungsional karyawan, DRAFT

Acuan Owner: Issue #61 komentar 6865574506. Baseline #70 `98e87d1e86803bb0d77c5aaf0a67ac846bb082ea`. Branch baru bertumpuk pada #70; tidak ada perubahan pada branch/base PR #67–#70. Dokumen induk/aturan bisnis bersifat historis; keputusan spesifik Owner terbaru menjadi acuan cutover.

## Bukti dan persentase

- Gate 1–4: terkunci PASS sesuai checkpoint Owner; tidak diulang atau dihitung sebagai hasil baru.
- Gate 5: **PARTIAL**. Controller registrasi lengkap dan adapter caller-session, identity/portrait, lifecycle/history, persiapan/keputusan Training tersedia. Integrasi baru diuji dengan SQL dependensi lengkap terisolasi dan Auth/mail sintetis. Pengaturan → Keamanan terhubung ke password sendiri memakai halaman reset yang sama. Modal registrasi/lifecycle visual belum dipasang karena membutuhkan field/kontrol baru; Owner mengarahkan seam nonvisual bila pemasangan mengubah visual. Ini blocker cutover, bukan PASS tersirat.
- Gate 6: **NOT REACHED / BLOCKED**. SMTP/Auth/Storage nyata dan native PostgreSQL concurrency belum diuji/diizinkan.
- Gate 7: **NOT REACHED / BLOCKED**. Browser/roles dan coordinated release approval belum dilakukan.
- Persentase paket #61 tetap **4/7 = 57,1%**. Tidak menaikkan ke 5/7 untuk adapter, dokumentasi atau commit. Tidak ada klaim persentase seluruh Operasional Sementara.

## Graph dependensi dan ledger cutover

1. #67 `b4a486c747202031e52a06a5cf9d67126fc83654`: private profile/portrait bucket dan RLS/helper aman.
2. #68 `b9460e98e56ea0a58da828f2208a468e8cdb09af`: lifecycle/audit, Training, join date, optimistic version. Dua file TypeScript lifecycle dibawa byte-identik (normalisasi line ending saja) karena belum ada pada #70. SQL #68 tidak disalin/diubah.
3. #69 `a8acfcf548bcba11111361f0b4e03ef82dd69c38`: provisioning saga, ID B25EMP-001, identitas lengkap, own password. Tidak ada perubahan formatter/sequence/nomor lama.
4. #70 `98e87d1e86803bb0d77c5aaf0a67ac846bb082ea`: persetujuan konfigurasi email, once-only delivery/audit dan Auth-only callback.
5. PR ini: adapter nonvisual, keputusan Training server function, binding Pengaturan dan tes integrasi. **Tidak ada SQL/migrasi baru.** Semua SQL dependensi tetap PENDING; urutan berdasarkan dependensi, bukan timestamp file. Instalasi terisolasi menggunakan SQL lengkap persis dari SHA tersebut (#70 file diwariskan).

Jangan merge independen sehingga frontend menunjuk RPC yang belum ada atau legacy create sudah throw sementara form belum dialihkan. Tidak ada perubahan main/Cloud dalam pekerjaan ini. Reviewer harus merencanakan satu cutover terkoordinasi dengan ledger SQL/RPC/grants dan snapshot target aktual, konfigurasi provider, serta pemasangan form lengkap sebelum release. Penggantian modal belum disertakan; jangan menyebut branch ini production-ready.

## Kontrak adapter untuk form final

`createEmployeeFormIntegration()` dibuat per form; bukan singleton global. Tidak menyimpan data di localStorage/sessionStorage/URL/log. Setiap pemanggilan mengambil session terbaru dan mengirim Bearer ke server function yang memakai auth middleware. Client bukan sumber otorisasi. Tutup form dengan `dispose()` setelah operasi pending selesai; saat busy jangan membuang request. Kehilangan tab/session berarti request ID perlu direkonsiliasi oleh Owner, bukan retry otomatis dengan ID baru.

- `newDraft()` / `getRequestId()`: UUID permintaan, bukan ID karyawan. Jangan minta manual employeeId/password. Catat request ID untuk recovery aman, bukan seluruh isi form.
- `submit({name,position,joinDate,identity})`: identity wajib NIK string 16 digit (leading zero dipertahankan), telepon, emergency contact, tempat/tanggal lahir, gender, alamat, email. Validator existing #69 tetap berwenang. Tolak role/actor/active/ID/password/KTP upload tambahan. Preview/approval frontend bukan bypass: server #70 memeriksa lagi sebelum Auth admin dibuat.
- Payload normalized ditahan hanya dalam instance untuk membatasi retry pada request yang sama. Ambiguous response → submit yang sama menggunakan request sama; payload berubah → review/draft baru eksplisit, bukan penomoran baru diam-diam. Latch mencegah submit paralel dalam instance; idempotency final tetap DB.
- `recover()`: panggil recovery saga existing; akun committed tidak dihapus, email tidak otomatis dikirim ulang. Delivery UNKNOWN harus direview.
- `read({employeeId,afterVersion})`: status REGISTERED/join date/Training dan event page dari server. Perhatikan `has_more/current_version`; page pertama **bukan seluruh riwayat**. Tampilkan cursor lanjutan; jangan menyatakan riwayat lengkap sebelum selesai. Status Training berasal dari server Asia/Jakarta, bukan jam perangkat.
- `change({employeeId,event,reason,expectedVersion,effectiveOn?,joinDate?})`: SET_JOIN_DATE, ACTIVATE, SUSPEND, END_EMPLOYMENT, REACTIVATE; versi berasal dari snapshot yang benar-benar ditinjau Owner. Stale version → muat ulang/review, jangan otomatis rebase keputusan.
- `prepareTraining({employeeId,supervisorUserId,startsOn,expectedVersion})`: existing authority Owner/Supervisor aktif; Supervisor hanya dapat menunjuk dirinya sendiri. Tidak mengubah tanggal dua hari WIB.
- `resolveTraining({assignmentId,status,reason})`: PASSED/FAILED/REVOKED via server Owner nonrestricted dan RPC existing. Kelulusan bukan aktivasi. ACTIVATE/REACTIVATE tetap tindakan Owner terpisah setelah PASSED.
- `readIdentity`, `updateIdentity`: Owner-only di server/RLS. `readPortrait`/`uploadPortrait`: pas foto wajah scoped existing bucket privat; tipe JPEG/PNG/WebP, validasi byte/ukuran tetap backend. Tidak ada upload foto KTP. Mengupload wajah adalah aksi terpisah sesudah employee ID tersedia; kegagalan foto tidak boleh memicu enroll ulang.
- `ownPassword({password,nonce?})`: tanpa target user/role/email/status. Server memakai caller getUser dan Auth endpoint milik caller; Owner tidak mendapat reset password orang lain lewat kontrak ini.

## Akses dan route

Owner nonrestricted: enroll, private identity/portrait, history, lifecycle, resolve Training. Supervisor aktif: prepare Training sesuai kontrak lama, bukan registrasi, private identity, history atau aktivasi. Receptionist/Training/role lain: deny Owner commands. Anon: deny authenticated endpoints. Password sendiri: session autentikasi sendiri, termasuk REGISTERED inactive; tidak mengubah role/status/identity.

Menu Pengaturan → Keamanan menuju `/reset-password?mode=own`. Query mode hanya memilih form handler, bukan izin. Endpoint tetap auth-scoped dan menolak arbitrary target. Kelas CSS/layout/tema halaman sama; tidak ada desain baru. Password minimum 12 sesuai kontrak #69. Berhasil → clear password, sign-out lokal dan login; tidak membuka operasi otomatis. Callback email #70 tetap HTTPS exact `/reset-password` tanpa query dan token fragment; jalur own tidak menerbitkan token/email atau menggantikan pemeriksaan callback.

REGISTERED sebelum Training tidak punya akses operasional. Selama Training, compatibility active flag bukan ACTIVE lifecycle atau akses normal; hanya konteks pendamping existing yang dapat mengizinkan aksi Training sesuai kebijakan lama. Hari kedua berakhir → EXPIRED_PENDING_OWNER, tidak PASSED otomatis. PASSED saja masih REGISTERED/nonoperasional hingga ACTIVATE. SUSPEND segera menutup akses dan REACTIVATE perlu persyaratan existing; riwayat append-only.

## Hasil pengujian baru

PASS: `node scripts/employee-integration-tests.cjs` memasang dependency SQL lengkap pada PGlite terisolasi, menjalankan controller → provisioning core → RPC, email gate tanpa mutasi, NIK leading-zero/anti-extra-fields, ambiguous-response replay dengan satu Auth/ID/email sintetis, recovery committed, private identity role deny, own Auth-only REGISTERED setup/password, Owner/Supervisor/Receptionist/Training/anon matrix, Training hari1/hari2/expiry, PASSED lalu ACTIVATE terpisah, SUSPEND/REACTIVATE history immutable, cash unchanged, concurrency latch form, exact dependency source dan kelas CSS tak berubah. Untuk skenario tanggal saja clock dalam definisi fungsi lokal diinjeksi setelah SQL asli lengkap terpasang; file proyek tidak diubah.

PASS: typecheck `scripts/tsconfig.employee-integration.json`, build, diff. CI hanya skenario integrasi baru; suites profil/lifecycle/provisioning/email SQL lama tidak diulang pada PR bertumpuk ini. Pemanggilan callback/core existing dalam skenario integrasi bukan klaim provider nyata.

NOT REACHED: submit lewat modal final/browser, pengujian role browser, SMTP/inbox/Auth nyata/TTL provider, signed Storage URL/upload nyata dan native multi-session PostgreSQL. Fake transport hanya bukti kontrak; tidak ada JWT dibuat, token nyata dicetak atau data Cloud disentuh. Fixture memiliki tabel cash, bukan skema receipt penuh: tidak ada panggilan mutasi receipt oleh adapter, tetapi runtime receipt terintegrasi tetap NOT REACHED.

## Berikutnya dan giliran Owner

Selesaikan pemasangan field registrasi dan lifecycle controls pada desain resmi Owner menggunakan adapter ini, lalu uji browser terfokus; jangan aktifkan legacy form yang mengirim ID/password. Codex tetap bertanggung jawab kode fungsional. Gate 5 baru boleh PASS setelah seam frontend final terhubung dan terbukti.

**GILIRAN KAPTEN** untuk nilai sender/domain, SMTP, callback HTTPS resmi serta izin verifikasi provider terpisah; persetujuan konsep email tidak cukup. Tidak menghentikan coding lokal yang bisa dilakukan. Selanjutnya gate 6 live-provider terotorisasi, gate 7 browser/roles + persetujuan release. Tidak ada merge, SQL Cloud, pengiriman email, DEMO/flags, deploy/publish atau Lovable dalam PR ini.
