import { labelStatusKamar, type StatusKamar } from "@/lib/data-contoh";

const kelas: Record<StatusKamar, string> = {
  siap: "bg-siap text-siap-foreground",
  terisi: "bg-terisi text-terisi-foreground",
  perlu: "bg-perlu text-perlu-foreground",
  sedang: "bg-sedang text-sedang-foreground",
};

export function LencanaStatus({ status }: { status: StatusKamar }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${kelas[status]}`}
    >
      {labelStatusKamar[status]}
    </span>
  );
}
