-- MENUNGGU PERSETUJUAN OWNER — jangan diterapkan tanpa persetujuan.
-- Menambah jenis catatan tamu (Umum/Preferensi/Perhatian/Lainnya) sesuai referensi
-- popup Catatan Tamu. Riwayat catatan tetap append-only; kolom ini hanya memberi label.

alter table public.guest_notes
  add column if not exists kind text not null default 'umum'
  check (kind in ('umum', 'preferensi', 'perhatian', 'lainnya'));

-- Setelah diterapkan: penyimpanan catatan baru diarahkan menyisipkan langsung ke
-- public.guest_notes (guest_id, body, kind) agar jenis ikut tersimpan; trigger
-- guests.notes yang ada tetap menjadi cadangan untuk catatan tanpa jenis.
