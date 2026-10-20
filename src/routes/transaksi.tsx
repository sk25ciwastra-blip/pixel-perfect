import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DetailTransaksi } from "@/components/detail-transaksi";
import { FormulirPemesanan } from "@/components/formulir-pemesanan";
import { Daftar, Kerangka, KotakCari } from "@/components/kerangka";
import { Button } from "@/components/ui/button";
import { Lencana } from "@/components/status-kamar";
import { rupiah } from "@/lib/data-contoh";
import { useTable } from "@/lib/data-live";
import { meta } from "@/lib/meta";
import { usePeran } from "@/lib/peran";

export const Route = createFileRoute("/transaksi")({
  head: () => meta("Transaksi", "Daftar transaksi Baturaden 25 Homestay."),
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

  const filteredRows = useMemo(
    () => rows.filter((transaction) => cocokNomorTransaksi(transaction.transaction_number, search)),
    [rows, search],
  );

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
          <Button className="h-11 rounded-xl" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Check-in Langsung
          </Button>
        )
      }
    >
      <KotakCari value={search} onChange={setSearch} placeholder="Cari nomor transaksi" />

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
                  <li key={transaction.id} className="px-4 py-3 sm:px-5 sm:py-4">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[auto_minmax(0,1.35fr)_minmax(170px,.9fr)_minmax(120px,.65fr)] sm:items-center">
                      <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary px-2 py-2.5 text-center">
                        <p className="max-w-full truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {roomType?.name ?? "ROOM"}
                        </p>
                        <p className="mt-1 text-lg font-bold leading-none">
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
