# Aktivasi Housekeeping · Issue #133

Stok Perlengkapan & Linen dan Laporan Kendala menggunakan Lovable Cloud proyek Baturaden 25 Homestay. SQL ada di `supabase/pending/20261123073104_issue_133_housekeeping_supplies.sql`. File pending dipasang sendiri setelah persetujuan Owner pada target LIVE. Urutan rilis adalah **verifikasi target → SQL → aplikasi → pemeriksaan singkat**.

## Keputusan operasional

- Owner mencatat nama barang, satuan, stok awal hasil hitung fisik, dan batas minimum opsional. Kuantitas menggunakan bilangan bulat per satuan. Peringatan muncul ketika saldo mencapai atau berada di bawah batas minimum.
- Hanya Owner dapat menambah jenis, mengubah saldo, dan mengatur batas minimum. Housekeeping dan Supervisor dapat membaca stok dan melaporkan pemakaian atau kekurangan. Laporan pemakaian tidak mengurangi stok secara otomatis. Setelah verifikasi, Owner mencatat pengurangan melalui penyesuaian stok.
- Housekeeping, Supervisor, dan Owner dapat membuat laporan. Owner dan Supervisor dapat menambah catatan tindak lanjut atau memindahkan laporan dari Dilaporkan ke Diproses lalu Selesai. Operator, waktu WIB pada tampilan, saldo sebelum/sesudah dan status sebelum/sesudah berasal dari rekaman database. Pelaporan tidak memicu perubahan status kamar.
- Tab Perawatan tetap memakai pencatatan berkala yang sudah berjalan. Stok awal dan ambang minimum harus diisi menggunakan hasil hitung dan keputusan operasional Owner.
- Saat koneksi putus setelah kirim, formulir menawarkan Coba lagi dengan ID dan isi permintaan yang sama selama formulir terbuka. Jika pengguna sudah berpindah halaman, periksa riwayat sebelum memasukkan ulang aksi.

## Sebelum merilis

1. Owner mengotorisasi perubahan SQL pada Lovable Cloud LIVE dan mengidentifikasi proyek serta deployment aktif. Cocokkan proyek dengan referensi dalam `supabase/config.toml` dan konfigurasi app LIVE. Koneksi Supabase yang tersedia saat implementasi hanya menampilkan Baturaden-25-Staging.
2. Pastikan backup/restore point LIVE tersedia. Jalankan pemeriksaan baca saja di SQL Editor proyek yang sesuai. Kolom pertama hingga kelima harus terisi dan dua kolom terakhir harus kosong. Pada target dengan objek baru yang sudah ada, periksa riwayat penerapan dan cocokkan DDL sebelum melanjutkan.

   ```sql
   select
     to_regclass('public.rooms') as rooms,
     to_regclass('public.employees') as employees,
     to_regprocedure('public.can_housekeeping(uuid)') as housekeeping_role,
     to_regprocedure('public.has_role(uuid,public.app_role)') as app_role,
     to_regprocedure('public.has_employee_position(uuid,public.employee_position[])') as employee_position,
     to_regclass('public.hk_supply_items') as new_stock,
     to_regnamespace('hk_issue_133_private') as new_private_schema;

   select id, room_number, active from public.rooms limit 0;
   select id, user_id, name, active from public.employees limit 0;
   ```

3. Tinjau definisi helper dengan `pg_get_functiondef` dan pastikan `can_housekeeping` hanya mengizinkan Owner dan karyawan aktif dengan posisi Housekeeping atau Supervisor sesuai kontrak repositori. Pastikan Data API mengekspos `public` serta mengecualikan `hk_issue_133_private`.

## SQL, aplikasi dan pemeriksaan LIVE

1. Jalankan hanya file pending Issue #133 secara utuh. File berada dalam satu transaksi SQL dan mengirim notifikasi muat ulang skema PostgREST. Jika gagal, periksa error dan konfirmasi transaksi batal sebelum mencoba ulang.
2. Periksa RLS, hak Data API dan visibilitas RPC sebelum menerbitkan aplikasi.

   ```sql
   select
     relname,
     relrowsecurity as rls,
     has_table_privilege('authenticated', oid, 'SELECT') as authenticated_select,
     has_table_privilege('authenticated', oid, 'INSERT,UPDATE,DELETE') as authenticated_direct_write,
     has_table_privilege('anon', oid, 'SELECT') as anonymous_select
   from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('hk_supply_items', 'hk_issue_reports', 'hk_operational_events')
   order by relname;

   select
     has_function_privilege('authenticated', 'public.record_hk_operational_action(uuid,text,jsonb)', 'EXECUTE') as authenticated_rpc,
     has_function_privilege('anon', 'public.record_hk_operational_action(uuid,text,jsonb)', 'EXECUTE') as anonymous_rpc;
   ```

   Tiga baris tabel harus masing-masing menunjukkan RLS dan izin baca authenticated aktif, serta izin tulis langsung dan izin baca anonim nonaktif. Hasil RPC harus `true, false`. Catat proyek, waktu, dan commit SQL yang diterapkan.

3. Setelah SQL lolos, gabungkan PR dan terbitkan commit aplikasi yang sesuai dari Lovable. Verifikasi versi deployment di URL LIVE. Buka Housekeeping → Perlengkapan sebagai Owner dan seorang Supervisor atau Housekeeping yang sudah aktif. Pastikan kedua panel termuat dan kontrol sesuai hak. Buka tautan Lihat Perawatan untuk memeriksa navigasi dan riwayat yang sudah ada. Pemeriksaan ini menggunakan akun operasional yang sudah disetujui.
4. Owner mencatat satu stok awal **aktual**, memuat ulang, dan memeriksa saldo serta operator pada riwayat. Gunakan laporan operasional berikutnya yang benar-benar diperlukan untuk memeriksa kirim, muat ulang, dan tindak lanjut oleh Supervisor atau Owner. Simpan ID atau bukti ringkas tanpa data pribadi. Status siap LIVE ditetapkan setelah SQL dan aplikasi terverifikasi di proyek yang sama.

## Rollback

Terbitkan kembali versi aplikasi sebelum Issue #133 atau revert commit PR dengan commit baru. Simpan tiga tabel dan seluruh audit. Jika diperlukan untuk menghentikan penulisan segera, cabut EXECUTE authenticated dari fungsi RPC publik **dan** implementasi private dalam satu transaksi lalu muat ulang skema PostgREST. Pengembalian hak menggunakan dua GRANT persis dari migrasi setelah Owner menyetujui aktivasi ulang. Jangan jalankan ulang DDL pembuatan tabel pada instalasi yang sudah berhasil.

## Pemeriksaan terfokus

Jalankan `bun run build` sebelum `bun x tsc --noEmit` untuk menyegarkan tipe router. Uji runtime memakai PostgreSQL 17 lokal dalam cluster baru dengan kredensial sekali pakai, binding loopback dan fixture kamar terisi. Instal alat pengujian di luar dependensi aplikasi.

```sh
npm install --prefix node_modules/.issue-133-tools --no-audit --no-fund embedded-postgres@17.12.0-beta.19
node scripts/issue-133-housekeeping-postgres.mjs
```

Uji runtime mencakup Owner, Supervisor, Housekeeping aktif dan nonaktif, pengguna luar, anon, RLS, audit, validasi, percobaan ulang, dua sesi yang berebut saldo, serta read-after-write. Uji juga membandingkan file desain dan RPC Perawatan dengan basis main `c51b28e`. Atur `HK_BASE_REF` bila perlu menunjuk commit dasar yang sama pada checkout lain. Pemeriksaan ini tidak mengulang alur UAT lama.
