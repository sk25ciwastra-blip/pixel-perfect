import { createFileRoute } from "@tanstack/react-router";
import { Kerangka, Panel, Angka } from "@/components/kerangka";
import { rupiah } from "@/lib/data-contoh";

export const Route = createFileRoute("/keuangan")({
  head: () => ({
    meta: [
      { title: "Keuangan — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Ringkasan keuangan Baturaden 25 Homestay: pendapatan, komisi, dan pengeluaran.",
      },
      { property: "og:title", content: "Keuangan — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Ringkasan keuangan Baturaden 25 Homestay: pendapatan, komisi, dan pengeluaran.",
      },
    ],
  }),
  component: HalamanKeuangan,
});

function HalamanKeuangan() {
  return (
    <Kerangka judul="Keuangan" keterangan="Periode September 2026">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel judul="Pendapatan">
          <div className="grid grid-cols-2 gap-4">
            <Angka label="Pendapatan kotor" nilai={rupiah(18450000)} />
            <Angka label="Refund" nilai={rupiah(450000)} />
            <Angka
              label="Pendapatan setelah refund"
              nilai={rupiah(18000000)}
            />
            <Angka label="Komisi" nilai={rupiah(900000)} />
            <Angka label="Pendapatan bersih" nilai={rupiah(17100000)} />
          </div>
        </Panel>

        <Panel judul="Metode Pembayaran">
          <div className="grid grid-cols-2 gap-4">
            <Angka label="Cash" nilai={rupiah(5200000)} />
            <Angka label="QRIS" nilai={rupiah(7300000)} />
            <Angka label="Transfer Bank" nilai={rupiah(5500000)} />
          </div>
        </Panel>

        <div className="sm:col-span-2">
          <Panel judul="Pengeluaran">
            <Angka label="Total pengeluaran" nilai={rupiah(3250000)} />
          </Panel>
        </div>
      </div>
    </Kerangka>
  );
}
