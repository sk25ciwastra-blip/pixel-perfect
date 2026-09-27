import { labelStatusKamar, type StatusKamar } from "@/lib/data-contoh";

export const kelasStatus: Record<StatusKamar, string> = {
  siap: "bg-siap text-siap-foreground",
  terisi: "bg-terisi text-terisi-foreground",
  perlu: "bg-perlu text-perlu-foreground",
  sedang: "bg-sedang text-sedang-foreground",
};

export function LencanaStatus({ status }: { status: StatusKamar }) {
  return <Lencana kelas={kelasStatus[status]}>{labelStatusKamar[status]}</Lencana>;
}

export function Lencana({ kelas, children }: { kelas: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${kelas}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const kelasLain: Record<string, string> = {
  Booking: "bg-primary-soft text-primary",
  "Check-in": "bg-terisi text-terisi-foreground",
  "Check-out": "bg-siap text-siap-foreground",
  Dibatalkan: "bg-bahaya text-bahaya-foreground",
  Lunas: "bg-siap text-siap-foreground",
  "Menunggu Persetujuan": "bg-perlu text-perlu-foreground",
  Refund: "bg-bahaya text-bahaya-foreground",
  Aktif: "bg-siap text-siap-foreground",
  "Tidak Aktif": "bg-muted text-muted-foreground",
};

export function LencanaTeks({ status }: { status: string }) {
  return <Lencana kelas={kelasLain[status] ?? "bg-muted text-muted-foreground"}>{status}</Lencana>;
}
