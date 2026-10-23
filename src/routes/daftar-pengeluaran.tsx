import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Kerangka } from "@/components/kerangka";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTable } from "@/lib/data-live";
import { meta } from "@/lib/meta";
import { usePeran } from "@/lib/peran";

export const Route = createFileRoute("/daftar-pengeluaran")({
  head: () => meta("Daftar Pengeluaran", "Kelola jenis pengeluaran dan keperluan Baturaden 25 Homestay."),
  component: Halaman,
});

type Opsi = { id: string; kind: string; name: string; active: boolean };
// Tabel belum ada di definisi tipe sampai pembaruan database disetujui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabel = () => (supabase as any).from("finance_expense_options");

function Halaman() {
  const { posisiKode } = usePeran();
  const opsi = useTable("finance_expense_options", posisiKode === "owner");
  if (posisiKode !== "owner") {
    return <Kerangka judul="Daftar Pengeluaran"><p className="text-sm text-muted-foreground">Halaman ini khusus Owner.</p></Kerangka>;
  }
  return (
    <Kerangka judul="Daftar Pengeluaran" keterangan="Pilihan untuk Form Pengeluaran">
      {opsi.error ? (
        <p className="rounded-2xl border border-gold/25 bg-card px-4 py-6 text-sm text-muted-foreground">
          Daftar belum bisa dipakai: pembaruan database untuk fitur ini sudah disiapkan dan menunggu persetujuan Owner.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Kelompok judul="Jenis Pengeluaran" kind="jenis" rows={opsi.rows as Opsi[]} refresh={opsi.refresh} />
          <Kelompok judul="Keperluan untuk Siapa" kind="keperluan" rows={opsi.rows as Opsi[]} refresh={opsi.refresh} />
        </div>
      )}
    </Kerangka>
  );
}

function Kelompok({ judul, kind, rows, refresh }: { judul: string; kind: string; rows: Opsi[]; refresh: () => Promise<void> }) {
  const [nama, setNama] = useState("");
  const [pesan, setPesan] = useState("");
  const daftar = rows.filter((r) => r.kind === kind);
  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    const n = nama.trim();
    if (!n || n.length > 60) { setPesan("Nama 1–60 huruf."); return; }
    const { error } = await tabel().insert({ kind, name: n });
    if (error) { setPesan(error.message); return; }
    setNama(""); setPesan(""); await refresh();
  }
  async function hapus(id: string) {
    const { error } = await tabel().delete().eq("id", id);
    if (error) setPesan(error.message); else await refresh();
  }
  return (
    <section className="panel-mewah rounded-2xl p-4">
      <h2 className="font-bold">{judul}</h2>
      <form onSubmit={tambah} className="mt-3 flex gap-2">
        <input value={nama} maxLength={60} onChange={(e) => setNama(e.target.value)} placeholder="Tambah pilihan" className="h-10 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-primary" />
        <Button type="submit">Tambah</Button>
      </form>
      {pesan && <p role="alert" className="mt-2 text-sm text-destructive">{pesan}</p>}
      <ul className="mt-3 divide-y divide-border">
        {daftar.length === 0 && <li className="py-3 text-sm text-muted-foreground">Belum ada pilihan.</li>}
        {daftar.map((o) => (
          <li key={o.id} className="flex items-center justify-between py-2 text-sm">
            {o.name}
            <Button type="button" variant="ghost" size="icon" aria-label={`Hapus ${o.name}`} onClick={() => void hapus(o.id)}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
