import { createFileRoute } from "@tanstack/react-router";
import { Kerangka } from "@/components/kerangka";
import { LencanaStatus } from "@/components/status-kamar";
import { kamar } from "@/lib/data-contoh";

export const Route = createFileRoute("/housekeeping")({
  head: () => ({
    meta: [
      { title: "Housekeeping — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Daftar kamar yang perlu dan sedang dibersihkan di Baturaden 25 Homestay.",
      },
      { property: "og:title", content: "Housekeeping — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Daftar kamar yang perlu dan sedang dibersihkan di Baturaden 25 Homestay.",
      },
    ],
  }),
  component: HalamanHousekeeping,
});

function HalamanHousekeeping() {
  const daftar = kamar.filter(
    (k) => k.status === "perlu" || k.status === "sedang",
  );

  return (
    <Kerangka judul="Housekeeping" keterangan="Kamar yang perlu dibersihkan">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {daftar.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            Semua kamar sudah bersih.
          </li>
        )}
        {daftar.map((k) => (
          <li
            key={k.nomor}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">Kamar {k.nomor}</p>
              <p className="text-xs text-muted-foreground">{k.tipe}</p>
            </div>
            <div className="flex items-center gap-3">
              <LencanaStatus status={k.status} />
              <button className="rounded-md border border-border px-3 py-1.5 text-xs font-medium">
                {k.status === "perlu" ? "Mulai Bersihkan" : "Selesai"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Kerangka>
  );
}
