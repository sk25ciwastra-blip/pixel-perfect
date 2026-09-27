import { createFileRoute } from "@tanstack/react-router";
import { Kerangka } from "@/components/kerangka";
import { transaksi, rupiah } from "@/lib/data-contoh";

export const Route = createFileRoute("/transaksi")({
  head: () => ({
    meta: [
      { title: "Transaksi — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Daftar transaksi pembayaran tamu Baturaden 25 Homestay.",
      },
      { property: "og:title", content: "Transaksi — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Daftar transaksi pembayaran tamu Baturaden 25 Homestay.",
      },
    ],
  }),
  component: HalamanTransaksi,
});

function HalamanTransaksi() {
  return (
    <Kerangka judul="Transaksi" keterangan="Daftar pembayaran tamu">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {transaksi.map((t) => (
          <li
            key={t.kode}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{t.tamu}</p>
              <p className="text-xs text-muted-foreground">
                {t.kode} · {t.metode} · {t.tanggal}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{rupiah(t.jumlah)}</p>
              <p className="text-xs text-muted-foreground">{t.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </Kerangka>
  );
}
