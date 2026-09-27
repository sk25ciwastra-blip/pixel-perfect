import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { Kerangka } from "@/components/kerangka";
import { kamar, paketContoh, rupiah } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/check-in")({
  head: () => meta("Check-in", "Proses check-in tamu Baturaden 25 Homestay langkah demi langkah."),
  component: HalamanCheckIn,
});

const langkah = ["Pilih Kamar", "Pilih Paket", "Data Tamu", "Pembayaran", "Konfirmasi"];

function Pilihan({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
        aktif ? "border-primary bg-primary-soft ring-4 ring-primary/10" : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${aktif ? "border-primary" : "border-input"}`}>
        {aktif && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </button>
  );
}

function Isian({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input placeholder={placeholder} className="mt-1.5 h-12 w-full rounded-xl border border-input px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
    </label>
  );
}

function HalamanCheckIn() {
  const [aktif, setAktif] = useState(0);
  const [pilihKamar, setPilihKamar] = useState("101");
  const [paket, setPaket] = useState(1);
  const [bayar, setBayar] = useState("QRIS");
  const siap = kamar.filter((k) => k.status === "siap");

  return (
    <Kerangka judul="Check-in" keterangan={`Langkah ${aktif + 1} dari ${langkah.length}`}>
      <ol className="mb-6 flex items-center">
        {langkah.map((l, i) => (
          <li key={l} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                i < aktif ? "bg-primary text-primary-foreground" : i === aktif ? "bg-primary text-primary-foreground ring-4 ring-primary/15" : "bg-secondary text-muted-foreground"
              }`}>
                {i < aktif ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`hidden text-[11px] font-medium sm:block ${i === aktif ? "text-primary" : "text-muted-foreground"}`}>{l}</span>
            </div>
            {i < langkah.length - 1 && <span className={`mx-1 h-0.5 flex-1 rounded ${i < aktif ? "bg-primary" : "bg-border"} sm:mb-5`} />}
          </li>
        ))}
      </ol>

      <h2 className="mb-4 text-lg font-semibold">{langkah[aktif]}</h2>

      <div className="max-w-2xl">
        {aktif === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {siap.map((k) => (
              <Pilihan key={k.nomor} aktif={pilihKamar === k.nomor} onClick={() => setPilihKamar(k.nomor)}>
                <p className="font-bold">Kamar {k.nomor}</p>
                <p className="text-xs text-muted-foreground">{k.tipe}</p>
              </Pilihan>
            ))}
          </div>
        )}
        {aktif === 1 && (
          <div className="space-y-3">
            {paketContoh.map((p, i) => (
              <Pilihan key={p.nama} aktif={paket === i} onClick={() => setPaket(i)}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.nama}</p>
                    <p className="text-xs text-muted-foreground">Durasi {p.durasi}</p>
                  </div>
                  <p className="font-bold text-primary">{rupiah(p.harga)}</p>
                </div>
              </Pilihan>
            ))}
          </div>
        )}
        {aktif === 2 && (
          <div className="space-y-4">
            <Isian label="Nama tamu" placeholder="Nama lengkap" />
            <Isian label="Nomor HP" placeholder="08xx-xxxx-xxxx" />
          </div>
        )}
        {aktif === 3 && (
          <div className="space-y-3">
            {["Cash", "QRIS", "Transfer"].map((m) => (
              <Pilihan key={m} aktif={bayar === m} onClick={() => setBayar(m)}>
                <p className="font-semibold">{m}</p>
              </Pilihan>
            ))}
          </div>
        )}
        {aktif === 4 && (
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card text-sm shadow-lembut">
            {[
              ["Kamar", `Kamar ${pilihKamar}`],
              ["Paket", paketContoh[paket].nama],
              ["Pembayaran", bayar],
              ["Total", rupiah(paketContoh[paket].harga)],
            ].map(([a, b]) => (
              <div key={a} className="flex justify-between px-4 py-3.5">
                <dt className="text-muted-foreground">{a}</dt>
                <dd className="font-semibold">{b}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 flex gap-3">
          {aktif > 0 && (
            <button onClick={() => setAktif(aktif - 1)} className="h-12 flex-1 rounded-xl border border-border text-sm font-semibold">
              Kembali
            </button>
          )}
          <button
            onClick={() => aktif < langkah.length - 1 && setAktif(aktif + 1)}
            className="h-12 flex-[2] rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lembut"
          >
            {aktif === langkah.length - 1 ? "Konfirmasi Check-in" : "Lanjut"}
          </button>
        </div>
      </div>
    </Kerangka>
  );
}
