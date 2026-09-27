import { createFileRoute } from "@tanstack/react-router";
import { Kerangka, Judul } from "@/components/kerangka";
import { rupiah } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/keuangan")({
  head: () => meta("Keuangan", "Ringkasan keuangan bulanan Baturaden 25 Homestay untuk Owner."),
  component: HalamanKeuangan,
});

function HalamanKeuangan() {
  const alur = [
    { label: "Pendapatan Kotor", nilai: 18450000 },
    { label: "Refund", nilai: -450000, merah: true },
    { label: "Pendapatan Setelah Refund", nilai: 18000000 },
    { label: "Komisi", nilai: -900000, merah: true },
  ];
  const metode = [
    { label: "Cash", nilai: 5400000 },
    { label: "QRIS", nilai: 8100000 },
    { label: "Transfer", nilai: 4500000 },
  ];
  const total = metode.reduce((a, b) => a + b.nilai, 0);

  return (
    <Kerangka judul="Keuangan" keterangan="September 2026">
      <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lembut">
        <p className="text-sm opacity-80">Pendapatan Bersih</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{rupiah(17100000)}</p>
      </div>

      <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card shadow-lembut">
        {alur.map((a) => (
          <div key={a.label} className="flex justify-between px-4 py-3.5 text-sm">
            <span className="text-muted-foreground">{a.label}</span>
            <span className={`font-semibold ${a.merah ? "text-bahaya-foreground" : ""}`}>
              {a.nilai < 0 ? "− " + rupiah(-a.nilai) : rupiah(a.nilai)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <Judul>Metode Pembayaran</Judul>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-lembut">
            {metode.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="font-semibold">{rupiah(m.nilai)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(m.nilai / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <Judul>Pengeluaran</Judul>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-lembut">
            <p className="text-sm text-muted-foreground">Total bulan ini</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{rupiah(2350000)}</p>
          </div>
        </section>
      </div>
    </Kerangka>
  );
}
