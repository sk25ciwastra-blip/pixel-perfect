# Kontrak setup password karyawan melalui email — review saja

Acuan: Issue #61 komentar 6863917799. Email disetujui sebagai jalur setup pertama; SMTP, sender dan callback aktual belum disetujui. Implementasi tetap tertutup tanpa konfigurasi lengkap dan bukti persetujuan sah. Tidak ada email nyata dikirim dalam pengujian ini.

## Dependensi dan batas aktivasi

PR ini bertumpuk di branch PR #69 agar perubahan #67/#68/#69 tidak disalin atau diubah. Urutan review SQL: private profiles #67, lifecycle #68, provisioning #69, kemudian `20261113202919_employee_email_delivery_contract.sql`. Jangan mengandalkan urutan nama timestamp. Seluruh SQL tetap pending; eksekusi memerlukan persetujuan terpisah. Format B25EMP-001, nomor lama, sequence atomik dan ID permanen tidak diubah.

## Konfigurasi server yang diperlukan

Isi melalui secret/configuration manager server, bukan Git, browser, tangkapan layar atau log:

- `EMPLOYEE_SETUP_SENDER_ADDRESS`: mailbox/domain pengirim yang disetujui.
- `EMPLOYEE_SETUP_SMTP_HOST`, `EMPLOYEE_SETUP_SMTP_PORT`, `EMPLOYEE_SETUP_SMTP_SECURITY`: metadata SMTP TLS/STARTTLS yang benar-benar diverifikasi. Kredensial SMTP hanya pada konfigurasi Auth provider; aplikasi tidak menyimpan sandi SMTP.
- `EMPLOYEE_SETUP_SITE_ORIGIN`, `SUPABASE_URL`: origin HTTPS resmi aplikasi dan Auth.
- `EMPLOYEE_SETUP_CALLBACK_URL`: URL HTTPS persis pada origin aplikasi dengan path `/reset-password`; tanpa query, fragment, wildcard, userinfo atau redirect operasional.
- `EMPLOYEE_SETUP_REDIRECT_ALLOWLIST`: array JSON URL HTTPS persis; callback wajib terdaftar. Konfigurasi provider juga harus diverifikasi, bukan hanya array aplikasi.
- `EMPLOYEE_SETUP_APPROVAL_HMAC_KEY`: kunci server 32 byte acak berbentuk 64 karakter hex.
- `EMPLOYEE_PROVISIONING_HMAC_KEY`: kunci fingerprint provisioning server, 64 hex; rotasi harus mempertimbangkan idempotency permintaan lama.
- `EMPLOYEE_SETUP_APPROVAL_RECORD`: JSON bertanda tangan dengan tepat `configDigest`, `ownerApprovalRef`, `verifiedAt`, `validUntil`, `checks`, `signature`.

Digest memakai SHA-256 dari konfigurasi ternormalisasi; tanda tangan HMAC-SHA256 mengikuti serialisasi pada modul approval/fixture. `checks` wajib berisi tepat `smtpTls`, `senderMailbox`, `providerAllowlist`, `fragmentTemplate`, `authOnlyCallback`, `unconfirmedRecovery`, `expirySingleUse`, semuanya true. Referensi persetujuan konsep 6863917799 sendiri tidak cukup. Bukti dibatasi masa berlaku dan konfigurasi; perubahan konfigurasi membatalkan bukti.

**Bukti bertanda tangan merupakan attestasi operator deployment tepercaya, bukan pemeriksaan langsung SMTP/provider oleh kode.** Operator hanya boleh menandatangani setelah nilai aktual disetujui Owner dan pemeriksaan provider terkait benar-benar dilakukan. Tidak ada endpoint penandatanganan atau bukti aktual dibuat dalam pekerjaan ini. Jangan mengubah check menjadi true berdasarkan unit test sintetis.

## Callback dan identitas

Template Auth yang nantinya direview menggunakan `{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=recovery`; jangan aktifkan sebelum persetujuan konfigurasi. Nonaktifkan pelacakan link provider email. Token di fragment dihapus segera, tidak disimpan di storage/log. Pertukaran OTP dilakukan hanya setelah pengguna menekan tombol form, bukan saat mount/prefetch, untuk mengurangi konsumsi oleh pemindai link. Token dapat tetap dipindai oleh sistem eksternal; verifikasi provider nyata masih diperlukan.

Endpoint menuntut origin aplikasi persis dan JSON, tanpa returnTo. Auth client per request memakai public/publishable key, bukan admin client. Provider memverifikasi recovery token; pemeriksaan `getUser` dan RPC konteks terikat auth.uid dilakukan lagi. Bentuk token saja bukan bukti autentikasi. Provider bertanggung jawab atas TTL dan sekali pakai. Session yang dikembalikan hanya session sah milik pemegang token setelah pemeriksaan konteks; respons no-store/no-referrer. Jika gagal setelah pertukaran, revoke session diupayakan.

Halaman reset yang sama mempertahankan tampilan. Akun REGISTERED inactive dapat setup password miliknya sendiri tanpa memperoleh akses operasional. Reload memakai konteks akun sendiri, bukan mengirim ulang email. Setelah password tersimpan, sign-out dan kembali ke login. Tidak ada aktivasi, PASS Training, sesi kas atau pembukaan Dashboard otomatis. Aturan Training dua hari tetap milik alur sebelumnya.

## Delivery dan recovery

Credential awal dibuat CSPRNG di server dan tidak pernah ditampilkan/dikirim sebagai plaintext. Delivery hanya sesudah commit enrollment. Claim sekali pakai mencatat actor/waktu secara atomik. `SENT` berarti API Auth menerima permintaan, bukan bukti email tiba di inbox. Timeout/error menjadi `UNKNOWN`: pengiriman mungkin telah terjadi; tidak ada retry/resend otomatis, penghapusan akun committed atau reset claim. Status aman dapat diperiksa Owner pembuat permintaan; endpoint reissue belum dibuka.

Audit hanya request/actor/event/waktu, immutable melalui trigger dan RLS; tanpa email, token, password atau isi identitas privat. Staff, Training dan anon tidak memperoleh status Owner. Callback SQL hanya konteks REGISTERED sendiri yang terikat metadata provisioning tepercaya dan delivery attempted/sent/unknown; tidak mengklaim SQL memvalidasi OTP. Tidak ada akses luas helper privat, perubahan bucket, foto KTP atau hak operasional.

## Bukti dan batas pengujian

PASS lokal: kontrak konfigurasi/HTTPS/allowlist/HMAC, callback sintetis dan penolakan replay/expired/mismatch, cleanup fragment, guard prefetch, timeout tanpa resend, akun committed dipertahankan, SQL lengkap pada PostgreSQL WASM PGlite terisolasi, RLS status/audit Owner dan penolakan role lain, konteks REGISTERED inactive sendiri tanpa mutasi operasional, typecheck terfokus dan build.

NOT REACHED: SMTP/inbox nyata, DNS/domain pengirim, callback browser terintegrasi provider, TTL/single-use Auth nyata, dukungan recovery akun unconfirmed pada konfigurasi nyata, PostgreSQL native multi-session/concurrency. Tidak ada pengujian Cloud/DEMO. Suite PASS unrelated tidak diulang.

Owner berikutnya hanya perlu menetapkan sender/domain, SMTP dan URL callback HTTPS resmi; operator kemudian memverifikasi konfigurasi dan bukti sebelum meminta izin aktivasi terpisah. Sampai itu selesai, delivery/provisioning tetap NO-GO.
