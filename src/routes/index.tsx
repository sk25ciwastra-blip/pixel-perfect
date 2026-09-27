import { createFileRoute } from "@tanstack/react-router";
import { Kerangka, Panel, Angka } from "@/components/kerangka";
import { usePeran } from "@/lib/peran";
import { kamar, booking, transaksi, rupiah } from "@/lib/data-contoh";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ringkasan — Baturaden 25 Homestay" },
      {
        name: "description",
        content:
          "Ringkasan harian operasional Baturaden 25 Homestay: pendapatan, kamar, booking, dan housekeeping.",
      },
      { property: "og:title", content: "Ringkasan — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content:
          "Ringkasan harian operasional Baturaden 25 Homestay: pendapatan, kamar, booking, dan housekeeping.",
      },
    ],
  }),
  component: Ringkasan,
});

function Ringkasan() {
  const { peran } = usePeran();
  return peran === "owner" ? <RingkasanOwner /> : <RingkasanKaryawan />;
}

function RingkasanOwner() {
  const siap = kamar.filter((k) => k.status === "siap").length;
  const terisi = kamar.filter((k) => k.status === "terisi").length;
  const perlu = kamar.filter((k) => k.status === "perlu").length;
  const menunggu = transaksi.filter(
    (t) => t.status === "Menunggu Persetujuan",
  );

  return (
    <Kerangka judul="Ringkasan" keterangan="Minggu, 27 September 2026">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel judul="Pendapatan">
          <div className="grid grid-cols-2 gap-4">
            <Angka label="Hari ini" nilai={rupiah(970000)} />
            <Angka label="Bulan ini" nilai={rupiah(18450000)} />
          </div>
        </Panel>

        <Panel judul="Kamar">
          <div className="grid grid-cols-3 gap-4">
            <Angka label="Siap" nilai={String(siap)} />
            <Angka label="Terisi" nilai={String(terisi)} />
            <Angka label="Perlu dibersihkan" nilai={String(perlu)} />
          </div>
        </Panel>

        <Panel judul="Booking">
          <div className="grid grid-cols-2 gap-4">
            <Angka label="Hari ini" nilai="2" />
            <Angka label="Akan datang" nilai="2" />
          </div>
        </Panel>

        <Panel judul="Housekeeping">
          <div className="grid grid-cols-2 gap-4">
            <Angka label="Perlu dibersihkan" nilai={String(perlu)} />
            <Angka label="Sedang dibersihkan" nilai="1" />
          </div>
        </Panel>

        <div className="sm:col-span-2">
          <Panel judul="Persetujuan Cash">
            {menunggu.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada pembayaran cash yang menunggu persetujuan.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {menunggu.map((t) => (
                  <li
                    key={t.kode}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.tamu}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.kode} · {rupiah(t.jumlah)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                        Setujui
                      </button>
                      <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
                        Tolak
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </Kerangka>
  );
}

function RingkasanKaryawan() {
  const siap = kamar.filter((k) => k.status === "siap").length;
  const terisi = kamar.filter((k) => k.status === "terisi").length;
  const perlu = kamar.filter((k) => k.status === "perlu").length;
  const hariIni = booking.filter((b) => b.tanggal === "27 Sep 2026").length;

  return (
    <Kerangka judul="Ringkasan" keterangan="Minggu, 27 September 2026">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        {[
          { label: "Kamar tersedia", nilai: siap },
          { label: "Kamar terisi", nilai: terisi },
          { label: "Perlu dibersihkan", nilai: perlu },
          { label: "Booking hari ini", nilai: hariIni },
        ].map((item) => (
          <div key={item.label} className="bg-background p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {item.nilai}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <button className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
          Check-in
        </button>
        <button className="rounded-xl border border-border px-4 py-3 text-sm font-medium">
          Booking
        </button>
        <button className="rounded-xl border border-border px-4 py-3 text-sm font-medium">
          Housekeeping
        </button>
      </div>
    </Kerangka>
  );
}
