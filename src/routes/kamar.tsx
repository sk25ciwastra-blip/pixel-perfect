import { createFileRoute } from "@tanstack/react-router";
import { Kerangka } from "@/components/kerangka";
import { LencanaStatus } from "@/components/status-kamar";
import { kamar } from "@/lib/data-contoh";

export const Route = createFileRoute("/kamar")({
  head: () => ({
    meta: [
      { title: "Kamar — Baturaden 25 Homestay" },
      {
        name: "description",
        content: "Status kamar Baturaden 25 Homestay: siap, terisi, dan perlu dibersihkan.",
      },
      { property: "og:title", content: "Kamar — Baturaden 25 Homestay" },
      {
        property: "og:description",
        content: "Status kamar Baturaden 25 Homestay: siap, terisi, dan perlu dibersihkan.",
      },
    ],
  }),
  component: HalamanKamar,
});

function HalamanKamar() {
  return (
    <Kerangka judul="Kamar" keterangan="Status seluruh kamar saat ini">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kamar.map((k) => (
          <div
            key={k.nomor}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <div>
              <p className="text-base font-semibold tracking-tight">
                Kamar {k.nomor}
              </p>
              <p className="text-xs text-muted-foreground">
                {k.tipe}
                {k.tamu ? ` · ${k.tamu}` : ""}
              </p>
            </div>
            <LencanaStatus status={k.status} />
          </div>
        ))}
      </div>
    </Kerangka>
  );
}
