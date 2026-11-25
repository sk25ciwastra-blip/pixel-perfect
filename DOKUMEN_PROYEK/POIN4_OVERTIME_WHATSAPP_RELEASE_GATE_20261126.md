# Baturaden 25 Homestay — Release Gate Pemberitahuan Overtime WhatsApp

**Tanggal audit:** 26 November 2026 (WIB). **Status: NO-GO APPLY CLOUD hingga Owner menyetujui dan gate dilengkapi.**

**Tujuan dibatasi:** menambah satu jenis template notifikasi WhatsApp manual `PEMBERITAHUAN_OVERTIME` setelah toleransi **15 menit** Check-out, dengan pesan meminta tamu menghubungi admin untuk konfirmasi tarif **Rp50.000/jam** atau pilihan perpanjangan. **Tidak** menetapkan charge baru, menghitung overtime, mengubah transaksi, menjadwalkan pengiriman, atau mengirim WhatsApp otomatis.

## Pemeriksaan Cloud read-only 26 November

- Project Lovable source `be3eedd` (PR #179 merged), checkpoint berikutnya `ae4d020` (PR #180 merged); project melaporkan `needs_attention / out_of_credits`. Preview dengan jalur Pengaturan Template tidak dapat diakses pemeriksa web; **UAT visual belum PASS**.
- `public.whatsapp_template_versions` mempunyai empat template `ACTIVE` revision 1: `KONFIRMASI_BOOKING`, `PENAWARAN_RESERVASI`, `PENGINGAT_BOOKING_30_MENIT`, `PENGINGAT_WAKTU_HABIS`. Jenis Overtime **belum ada** dalam constraint, belum mempunyai versi ACTIVE.
- Dependency wajib **TERSEDIA**: tabel versi dan audit, `has_role(uuid,app_role)`, fungsi pembatasan Training, `owner_save_whatsapp_reminder_template`, `read_active_whatsapp_reminder_template`.
- RLS **ON** di tabel versi dan audit. `anon` tidak memiliki SELECT. `authenticated` tidak memiliki INSERT/UPDATE langsung pada kedua tabel; perubahan template hanya melalui Owner RPC.
- Kedua RPC adalah `SECURITY DEFINER` dengan izin execute untuk `authenticated` dan bukan `anon`; pembacaan source menunjukkan Owner-only audited save, Receptionist aktif non-Training read-only, Housekeeping/anon ditolak, serta whitelist server.
- **Semua di atas adalah bukti pembacaan metadata/source**, **bukan** tes nyata pengguna yang terautentikasi pada Cloud; jangan menyebut UAT role LIVE PASS sebelum pengujian peran sebenarnya.

## Berkas rencana implementasi

1. `supabase/pending/20261126_whatsapp_overtime_notice_kind.sql` — SQL tambahan jenis template dan RPC yang sudah ada, **PENDING ONLY**.
2. `supabase/pending/20261126_whatsapp_overtime_notice_rollback.sql` — rollback konservatif yang hanya boleh berjalan bila **belum pernah ada versi maupun audit Overtime**. Jika sudah ada riwayat Overtime, rollback **STOP** dan perlu **forward fix** yang disepakati; tidak menghapus sejarah.
3. `scripts/whatsapp-overtime-rehearsal-bootstrap.sql` — bootstrap Postgres 17 sintetis, menggunakan baseline 25 November.
4. `scripts/whatsapp-overtime-notice-roles.test.sql` — tes synthetic Owner, Receptionist, HK, Training dan anon.
5. `scripts/whatsapp-overtime-migration-rehearsal.sh` dan `.github/workflows/b25-poin4-overtime-rollback.yml` — latihan migrasi, penolakan rollback saat ada riwayat, rollback tanpa riwayat, dan kelestarian template lama.

**Batas bukti:** CI Postgres sintetis hanya membuktikan migrasi/rollback pada fixture terisolasi. CI tidak membuktikan backup LIVE bisa dipulihkan, seluruh schema di Cloud kompatibel, atau perilaku browser Owner/Receptionist.

## Hasil uji PostgreSQL 17 sintetis (CI, 26 November 2026)

**PASS — GitHub Actions run `45724403589`, job `139590467572`**, nama workflow `B25 Poin4 Overtime WhatsApp Migration Rollback Gate`. Log job telah dibaca dan mengonfirmasi secara eksplisit:

1. **PASS:** migrasi additive serta tes akses Owner, Receptionist, HK, Training, dan anon dalam DB sintetis.
2. **PASS:** rollback dengan riwayat template Overtime gagal aman (`STOP: overtime history exists`) dan membiarkan versi/audit utuh.
3. **PASS:** rollback saat belum ada histori Overtime mengembalikan constraint/RPC lama sambil mempertahankan template lama yang ACTIVE dan catatan audit.

**Batas klaim:** hanya PostgreSQL 17 sintetis, **bukan** UAT autentikasi LIVE atau bukti restore backup Cloud. Tidak ada SQL Cloud, pembayaran, atau publish yang dilakukan. Persetujuan Owner terpisah tetap wajib sebelum migrasi LIVE.

## Urutan gate sebelum Cloud (belum dijalankan)

1. Review dan periksa kembali source/DDL/ACL target LIVE pada hari aktivasi. Bandingkan dengan baseline yang diuji, termasuk dependency/kind constraint dan owner/training guard.
2. Rencana backup dan pemulihan LIVE diverifikasi secara independen, dengan lokasi backup aman. Jangan mencatat identitas staf, nomor WA tamu, password, atau data transaksi ke GitHub.
3. Tes Postgres 17 terisolasi untuk apply + rollback + role guard harus benar-benar **PASS**. Jika fail: jangan apply Cloud.
4. Owner memberikan **persetujuan eksplisit terpisah untuk Cloud SQL** (persetujuan merge GitHub **tidak** cukup). Setelah itu eksekusi migrasi melalui prosedur operasional dengan audit.
5. Verifikasi Cloud sesudah migrasi: constraint baru, akses `anon/HK/Training` tetap ditolak, Owner-only save, Receptionist read ACTIVE, tidak mengganggu keempat template lama. **Jangan membuat transaksi/charge overtime baru** hanya untuk uji UI.
6. Owner meninjau dan menyimpan versi ACTIVE Overtime melalui jalur Owner yang diaudit, bukan seed SQL, dan memverifikasi teks/angka/timestamp dengan data resmi.
7. Pastikan browser Lovable yang benar sudah build dan **publish-nya disetujui terpisah**. UAT manual pada batas tepat 15 menit, check-out/extension/mati sesi, serta tak ada autosend/autocharge.

## Keputusan status

- **GitHub PR #179 MERGED**: empat opsi ditulis dalam source; disinkronkan ke Lovable.
- **Cloud jenis Overtime saat audit:** BELUM ADA. Tidak boleh menyebut Overtime siap dipakai staf.
- **Template ACTIVE:** tidak ditimpa, tidak dipindah, tidak dibersihkan.
- **Rollback:** hanya jika belum ada histori Overtime. Jika versi aktif sudah disimpan, pilih forward fix atau rencana pemulihan yang disetujui, bukan menghapus data.
- **Status GO/NO-GO untuk Cloud:** NO-GO sampai langkah gate terpenuhi dan Owner memberi izin.
