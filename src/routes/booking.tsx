import { createFileRoute } from "@tanstack/react-router";
import { Kerangka } from "@/components/kerangka";
import { booking } from "@/lib/data-contoh";

export const Route = createFileRoute("/booking")({
  head: () => ({
    meta: [
      { title: "Booking — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Daftar booking kamar Baturaden 25 Homestay beserta status tamu.",
      },
      { property: "og:title", content: "Booking — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Daftar booking kamar Baturaden 25 Homestay beserta status tamu.",
      },
    ],
  }),
  component: HalamanBooking,
});

function HalamanBooking() {
  return (
    <Kerangka
      judul="Booking"
      keterangan="Daftar pemesanan kamar"
      aksi={
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Booking Baru
        </button>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">No. Transaksi</th>
              <th className="px-4 py-3 font-medium">Nama Tamu</th>
              <th className="px-4 py-3 font-medium">Kamar</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {booking.map((b) => (
              <tr key={b.kode}>
                <td className="px-4 py-3 text-muted-foreground">{b.kode}</td>
                <td className="px-4 py-3 font-medium">{b.tamu}</td>
                <td className="px-4 py-3">{b.kamar}</td>
                <td className="px-4 py-3 text-muted-foreground">{b.tanggal}</td>
                <td className="px-4 py-3">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kerangka>
  );
}
