-- Lantai kamar — tambahan opsional untuk formulir Tambah/Ubah kamar.
-- Mengajukan: halaman Tipe Kamar. MENUNGGU PERSETUJUAN OWNER, belum diterapkan.
-- Sifat perubahan: menambah satu kolom kosong (nullable). Tidak mengubah harga,
-- status, hak akses, kebijakan data, fungsi, maupun isi data kamar yang ada.

alter table public.rooms
  add column if not exists lantai smallint;

comment on column public.rooms.lantai is
  'Lantai kamar; kosong bila belum dicatat.';
