import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { DetailTransaksi } from "@/components/detail-transaksi";
import { FormulirPemesanan } from "@/components/formulir-pemesanan";
import { Daftar, Kerangka } from "@/components/kerangka";
import { Button } from "@/components/ui/button";
import { Lencana } from "@/components/status-kamar";
import { rupiah } from "@/lib/data-contoh";
import { useTable } from "@/lib/data-live";
import { meta } from "@/lib/meta";
import { usePeran } from "@/lib/peran";

export const Route = createFileRoute("/transaksi")({
  head: () => meta("Transaksi", "Daftar transaksi Baturaden 25 Homestay."),
  validateSearch: (s: Record<string, unknown>): { bagian?: "semua" | "hari-ini" | "kemarin" | "riwayat" | undefined } => ({
    bagian: ["semua", "hari-ini", "kemarin", "riwayat"].includes(String(s["bagian"])) ? (s["bagian"] as "semua") : undefined,
  }),
  component: Halaman,
});

const labels = {
  booking: "BOOKING",
  check_in: "CHECK-IN",
  check_out: "SELESAI",
  cancelled: "SELESAI",
};

const labelClasses = {
  booking: "bg-primary-soft text-primary",
  check_in: "bg-terisi text-terisi-foreground",
  check_out: "bg-siap text-siap-foreground",
  cancelled: "bg-bahaya text-bahaya-foreground",
};

function formatTanggalGroup(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function formatTanggalHeading(date: string) {
  return new Date(date + "T12:00:00+07:00").toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatJamWib(value: string | null) {
  if (!value) return "—";

  return new Date(value)
    .toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(":", ".");
}

function nomorUrut(transactionNumber: string) {
  const ownerFinal = transactionNumber.match(/^BTRDTRX-(\d+)$/i);
  if (ownerFinal) return ownerFinal[1];

  const official = transactionNumber.match(/^BTRD25-TRX-(\d+)-\d{2}$/i);
  if (official) return official[1];

  const legacy = transactionNumber.match(/^BTRD25-(\d+)$/i);
  return legacy?.[1] ?? null;
}

function cocokNomorTransaksi(transactionNumber: string, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  if (/^\d+$/.test(term)) {
    const sequence = nomorUrut(transactionNumber);
    if (!sequence) return false;

    if (term.length === 1) {
      return sequence.includes(term);
    }

    const normalizedTerm = term.replace(/^0+/, "") || "0";
    const normalizedSequence = sequence.replace(/^0+/, "") || "0";
    return normalizedTerm === normalizedSequence;
  }

  return transactionNumber.toLowerCase().includes(term);
}

function Halaman() {
  const { posisiKode } = usePeran();
  const canCheckIn = ["owner", "supervisor", "receptionist"].includes(posisiKode ?? "");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);

  const { rows, error, refresh } = useTable("transactions");
  const guests = useTable("guests");
  const rooms = useTable("rooms");
  const roomTypes = useTable("room_types");

  const { bagian = "semua" } = Route.useSearch();
  const filteredRows = useMemo(() => {
    const hariIni = formatTanggalGroup(new Date().toISOString());
    const kemarin = formatTanggalGroup(new Date(Date.now() - 86400000).toISOString());
    return rows.filter((transaction) => {
      if (!cocokNomorTransaksi(transaction.transaction_number, search)) return false;
      const tgl = formatTanggalGroup(transaction.created_at);
      if (bagian === "hari-ini") return tgl === hariIni;
      if (bagian === "kemarin") return tgl === kemarin;
      if (bagian === "riwayat") return tgl < kemarin;
      return true;
    });
  }, [rows, search, bagian]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, typeof filteredRows>();

    for (const transaction of filteredRows) {
      const groupKey = formatTanggalGroup(transaction.created_at);
      const current = groups.get(groupKey) ?? [];
      current.push(transaction);
      groups.set(groupKey, current);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, transactions]) => ({
        date,
        transactions: transactions.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      }));
  }, [filteredRows]);

  return (
    <Kerangka
      judul="Daftar Transaksi"
      keterangan="Daftar transaksi tamu"
      aksi={
        canCheckIn && (
          <Button className="h-11 shrink-0 gap-2 rounded-xl px-5" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            <span className="leading-none">Check-in Langsung</span>
          </Button>
        )
      }
    >
      <form onSubmit={(e) => e.preventDefault()} className="flex w-full min-w-0 items-center gap-2 rounded-full border border-gold/25 bg-navy-deep/70 py-1.5 pl-4 pr-1.5 backdrop-blur-md sm:max-w-md">
        <Search className="size-4 shrink-0 text-foreground/90" aria-hidden="true" />
        <input aria-label="Pencarian transaksi" placeholder="Cari Nomor Transaksi..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-gold/50" />
        <Button type="submit" size="sm" className="shrink-0 rounded-full px-4"><Search className="size-4" />Cari</Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!groupedTransactions.length && (
        <p className="mt-5 rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {search ? "Nomor transaksi tidak ditemukan." : "Belum ada transaksi."}
        </p>
      )}

      <div className="mt-5 space-y-6">
        {groupedTransactions.map((group) => (
          <section key={group.date} aria-labelledby={"transaksi-" + group.date}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id={"transaksi-" + group.date} className="text-sm font-bold capitalize">
                {formatTanggalHeading(group.date)}
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {group.transactions.length} transaksi
              </span>
            </div>

            <Daftar>
              {group.transactions.map((transaction) => {
                const room = rooms.rows.find((item) => item.id === transaction.room_id);
                const roomType = roomTypes.rows.find((item) => item.id === room?.room_type_id);
                const guest = guests.rows.find((item) => item.id === transaction.guest_id);
                const phoneDigits = guest?.phone?.replace(/\D/g, "") ?? "";
                const lastFourPhone = phoneDigits ? phoneDigits.slice(-4) : "—";
                const guestName = guest?.full_name?.toUpperCase() ?? "TAMU";

                return (
                  <li key={transaction.id} className="px-4 py-3 transition hover:bg-gold/[0.04] sm:px-6 sm:py-4">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[auto_minmax(0,1.35fr)_minmax(170px,.9fr)_minmax(120px,.65fr)] sm:items-center">
                      <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-gold/30 bg-gradient-to-b from-navy-soft to-navy-deep px-2 py-2.5 text-center shadow-[0_0_18px_-8px_var(--gold)]">
                        <p className="max-w-full truncate text-[10px] font-bold uppercase tracking-wide text-gold/80">
                          {roomType?.name ?? "ROOM"}
                        </p>
                        <p className="mt-1 font-serif text-xl font-semibold leading-none text-gold-light">
                          {room?.room_number ?? "—"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {guestName} ∙ {lastFourPhone}
                        </p>
                        <button
                          type="button"
                          className="mt-0.5 block max-w-full truncate text-left font-mono text-sm font-semibold text-primary hover:underline"
                          onClick={() => setDetailTransactionId(transaction.id)}
                        >
                          {transaction.transaction_number}
                        </button>
                      </div>

                      <div className="col-span-2 grid grid-cols-2 gap-3 text-xs sm:col-span-1 sm:self-center sm:justify-self-center">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Check-in
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                            {formatJamWib(transaction.started_at)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Check-out
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                            {formatJamWib(transaction.checked_out_at)}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-2 flex min-w-0 flex-col items-end justify-center gap-1.5 border-t border-border/70 pt-2 sm:col-span-1 sm:self-center sm:justify-self-end sm:border-0 sm:pt-0">
                        <Lencana kelas={labelClasses[transaction.status]}>
                          {labels[transaction.status]}
                        </Lencana>
                        <p className="truncate text-right font-bold leading-tight">
                          {transaction.price_snapshot === null
                            ? "—"
                            : rupiah(Number(transaction.price_snapshot))}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </Daftar>
          </section>
        ))}
      </div>

      {open && canCheckIn && (
        <FormulirPemesanan mode="check_in" onClose={() => setOpen(false)} onSaved={refresh} />
      )}

      {detailTransactionId && (
        <DetailTransaksi
          transactionId={detailTransactionId}
          onClose={() => setDetailTransactionId(null)}
        />
      )}
    </Kerangka>
  );
}
