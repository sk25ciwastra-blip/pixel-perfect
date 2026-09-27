import { createFileRoute } from "@tanstack/react-router";
import { Kerangka, Daftar } from "@/components/kerangka";
import { LencanaTeks } from "@/components/status-kamar";
import { transaksi, rupiah } from "@/lib/data-contoh";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/transaksi")({
  head: () => meta("Transaksi", "Daftar transaksi pembayaran tamu Baturaden 25 Homestay."),
  component: HalamanTransaksi,
});

function HalamanTransaksi() {
  return (
    <Kerangka judul="Transaksi" keterangan="Daftar pembayaran tamu">
      <Daftar>
        {transaksi.map((t) => (
          <li key={t.kode} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-sm font-bold tracking-tight text-primary">{t.kode}</p>
              <LencanaTeks status={t.status} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t.tamu}</p>
                <p className="text-xs text-muted-foreground">Kamar {t.kamar} · {t.tanggal} · {t.metode}</p>
              </div>
              <p className="shrink-0 text-base font-bold">{rupiah(t.jumlah)}</p>
            </div>
          </li>
        ))}
      </Daftar>
    </Kerangka>
  );
}
