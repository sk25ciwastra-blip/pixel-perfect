-- DISIAPKAN, BELUM DITERAPKAN. Menunggu persetujuan Owner.
-- Bagian A: daftar Jenis Pengeluaran & Keperluan untuk Siapa yang dikelola Owner.
CREATE TABLE public.finance_expense_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('jenis', 'keperluan')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);
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

-- Bagian B (belum ditulis): biaya tamu tambahan (>2 orang, Rp50.000/orang) membutuhkan
-- kolom jumlah tamu di transactions serta perubahan create_reservation / create_training_reservation
-- agar harga snapshot, DP minimum, dan pelunasan memasukkan biaya tersebut secara atomik.
-- Akan disusun terpisah setelah Owner menyetujui Bagian A dan aturan detailnya.
