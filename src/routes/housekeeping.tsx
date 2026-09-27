import { createFileRoute } from "@tanstack/react-router";
import { Kerangka, Judul } from "@/components/kerangka";
import { LencanaStatus } from "@/components/status-kamar";
import { kamar, type StatusKamar } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/housekeeping")({
  head: () => meta("Housekeeping", "Daftar kamar yang perlu dan sedang dibersihkan di Baturaden 25 Homestay."),
  component: HalamanHousekeeping,
});

const bagian: { status: StatusKamar; judul: string }[] = [
  { status: "perlu", judul: "Perlu Dibersihkan" },
  { status: "sedang", judul: "Sedang Dibersihkan" },
  { status: "siap", judul: "Sudah Siap" },
];

function HalamanHousekeeping() {
  return (
    <Kerangka judul="Housekeeping" keterangan="Kebersihan kamar hari ini">
      <div className="space-y-8">
        {bagian.map((b) => {
          const isi = kamar.filter((k) => k.status === b.status);
          return (
            <section key={b.status}>
              <Judul aksi={<span className="text-xs font-semibold text-muted-foreground">{isi.length}</span>}>{b.judul}</Judul>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {isi.map((k) => (
                  <div key={k.nomor} className="rounded-2xl border border-border bg-card p-5 shadow-lembut">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl font-bold tracking-tight">Kamar {k.nomor}</p>
                        <p className="text-sm text-muted-foreground">{k.tipe}</p>
                      </div>
                      <LencanaStatus status={k.status} />
                    </div>
                    {b.status === "perlu" && (
                      <button className="mt-4 h-12 w-full rounded-xl bg-primary text-sm font-semibold uppercase tracking-wide text-primary-foreground">
                        Mulai Bersihkan
                      </button>
                    )}
                    {b.status === "sedang" && (
                      <button className="mt-4 h-12 w-full rounded-xl bg-siap text-sm font-semibold uppercase tracking-wide text-siap-foreground">
                        Selesai
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Kerangka>
  );
}
