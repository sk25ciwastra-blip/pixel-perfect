import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  CalendarDays,
  Clock3,
  CircleDollarSign,
  Brush,
  BedDouble,
  Eye,
  FileText,
  LogIn,
  LogOut,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Kerangka, Judul } from "@/components/kerangka";
import { DetailTransaksi } from "@/components/detail-transaksi";
import { PerawatanBerkala } from "@/components/perawatan-berkala";
import { usePeran } from "@/lib/peran";
import { rupiah } from "@/lib/data-contoh";
import { useTable } from "@/lib/data-live";
import { meta } from "@/lib/meta";
import { normalizeWhatsAppNumber, openWhatsApp } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";
import { useSesiKasKonteks } from "@/lib/sesi-kas";

export const Route = createFileRoute("/")({
  head: () => meta("Ringkasan", "Ringkasan harian Baturaden 25 Homestay: pendapatan, kamar, booking, dan housekeeping."),
  component: Ringkasan,
});

const BATAS_HAMPIR_HABIS_MS = 15 * 60 * 1000;

function formatDurasi(milidetik: number) {
  const totalDetik = Math.floor(Math.max(0, milidetik) / 1000);
  const jam = Math.floor(totalDetik / 3600);
  const menit = Math.floor((totalDetik % 3600) / 60);
  const detik = totalDetik % 60;

  return [jam, menit, detik]
    .map((angka) => String(angka).padStart(2, "0"))
    .join(":");
}

function formatSisaWaktu(endsAt: string | null, sekarang: number) {
  if (!endsAt) {
    return {
      status: "unknown" as const,
      waktu: "—",
      label: "WAKTU BELUM TERSEDIA",
      kelas: "text-muted-foreground",
    };
  }

  const selisih = new Date(endsAt).getTime() - sekarang;

  if (!Number.isFinite(selisih)) {
    return {
      status: "unknown" as const,
      waktu: "—",
      label: "WAKTU BELUM TERSEDIA",
      kelas: "text-muted-foreground",
    };
  }

  if (selisih > BATAS_HAMPIR_HABIS_MS) {
    return {
      status: "normal" as const,
      waktu: formatDurasi(selisih),
      label: "lagi",
      kelas: "text-siap-foreground",
    };
  }

  if (selisih >= 0) {
    return {
      status: "hampir" as const,
      waktu: formatDurasi(selisih),
      label: "lagi",
      kelas: "text-amber-600",
    };
  }

  return {
    status: "expired" as const,
    waktu: "HABIS",
    label: "WAKTU HABIS",
    kelas: "text-bahaya-foreground",
  };
}

function kodePaket(name: string | undefined) {
  const kode: Record<string, string> = {
    "Paket 2 Jam": "P2",
    "Paket 4 Jam": "P4",
    "Paket 6 Jam": "P6",
    "Paket 12 Jam": "P12",
    "Paket 24 Jam": "P24",
    "Paket Pagi": "PP",
    "Paket Malam": "PM",
    "Paket Harian": "PH",
    "Paket Mingguan": "PW",
  };

  return name ? (kode[name] ?? name) : "—";
}

function tanggalWib(value: string | number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function jamWib(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type RevenuePoint = { label: string; previous: number; current: number };

function buildRevenueData(
  payments: { amount: number; created_at: string }[],
  sekarang: number,
  period: "mingguan" | "bulanan",
): RevenuePoint[] {
  const days = period === "mingguan" ? 7 : 28;
  const points = Array.from({ length: period === "mingguan" ? 7 : 4 }, (_, index) => ({
    label: period === "mingguan" ? "" : `Mg ${index + 1}`,
    previous: 0,
    current: 0,
  }));

  for (const payment of payments) {
    const paymentDay = tanggalWib(payment.created_at);
    for (let offset = 0; offset < days * 2; offset += 1) {
      const day = tanggalWib(sekarang - offset * 86_400_000);
      if (paymentDay !== day) continue;

      const bucket = period === "mingguan"
        ? 6 - (offset % 7)
        : Math.floor((offset % 28) / 7);
      const point = points[bucket];
      if (!point) continue;
      if (offset < days) point.current += Number(payment.amount);
      else point.previous += Number(payment.amount);
      break;
    }
  }

  if (period === "mingguan") {
    return points.map((point, index) => ({
      ...point,
      label: new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" })
        .format(new Date(sekarang - (6 - index) * 86_400_000))
        .replace(".", ""),
    }));
  }

  return points;
}

function Ringkasan() {
  const { peran, nama, posisi, posisiKode } = usePeran();

  const rooms = useTable("rooms");
  const transactions = useTable("transactions");
  const payments = useTable("payments");
  const guests = useTable("guests");
  const roomTypes = useTable("room_types");
  const packages = useTable("packages");
  const activityLogs = useTable("activity_logs", peran === "owner");
  const employees = useTable("employees", peran === "owner");
  const financeExpenses = useTable(
    "finance_expenses",
    peran === "owner" || posisiKode === "supervisor",
  );
  const {
    sessionId: checkoutSessionId,
    isTraining: isCheckoutTraining,
    loading: checkoutSessionLoading,
    error: checkoutSessionError,
  } = useSesiKasKonteks();

  const kamar = rooms.rows;
  const transaksi = transactions.rows;

  const [sekarang, setSekarang] = useState(() => Date.now());
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState<"mingguan" | "bulanan">("mingguan");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSekarang(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const kamarAktif = kamar.filter((item) => item.active);

  const hitung = (status: string) =>
    kamarAktif.filter(
      (item) =>
        item.status ===
        (
          {
            siap: "ready",
            terisi: "occupied",
            perlu: "dirty",
          } as Record<string, string>
        )[status],
    ).length;

  const pembayaranHariIni = payments.rows.filter(
    (payment) =>
      new Date(payment.created_at).toDateString() ===
      new Date(sekarang).toDateString(),
  );

  const bookingAktif = transaksi.filter(
    (item) => item.status === "booking",
  );

  const kamarTerisi = useMemo(() => {
    return transaksi
      .filter((item) => item.status === "check_in")
      .map((item) => {
        const room = kamar.find(
          (roomItem) => roomItem.id === item.room_id,
        );

        const guest = guests.rows.find(
          (guestItem) => guestItem.id === item.guest_id,
        );

        const roomType = roomTypes.rows.find(
          (typeItem) => typeItem.id === room?.room_type_id,
        );

        return {
          transaksi: item,
          room,
          guest,
          roomType,
          endsAtMs: item.ends_at
            ? new Date(item.ends_at).getTime()
            : Number.POSITIVE_INFINITY,
        };
      })
      .filter(
        (item) =>
          item.room?.active &&
          item.room.status === "occupied",
      )
      .sort((a, b) => a.endsAtMs - b.endsAtMs);
  }, [transaksi, kamar, guests.rows, roomTypes.rows]);

  const revenueData = useMemo(
    () => buildRevenueData(payments.rows, sekarang, revenuePeriod),
    [payments.rows, revenuePeriod, sekarang],
  );

  const paymentBreakdown = useMemo(() => {
    const items = [
      {
        label: "CASH",
        color: "var(--v0-success)",
        amount: payments.rows
          .filter((payment) => payment.method.toLowerCase() === "cash")
          .reduce((total, payment) => total + Number(payment.amount), 0),
      },
      {
        label: "QRIS",
        color: "var(--v0-info)",
        amount: payments.rows
          .filter((payment) => payment.method.toLowerCase() === "qris")
          .reduce((total, payment) => total + Number(payment.amount), 0),
      },
      {
        label: "TRANSFER",
        color: "var(--v0-violet)",
        amount: payments.rows
          .filter((payment) => payment.method.toLowerCase() === "transfer")
          .reduce((total, payment) => total + Number(payment.amount), 0),
      },
    ];

    if ((peran === "owner" || posisiKode === "supervisor") && !financeExpenses.error) {
      items.push({
        label: "PENGELUARAN",
        color: "var(--v0-warning)",
        amount: financeExpenses.rows.reduce((total, expense) => total + Number(expense.amount), 0),
      });
    }

    return items;
  }, [financeExpenses.error, financeExpenses.rows, payments.rows, peran, posisiKode]);

  const activityItems = useMemo(
    () => [...activityLogs.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((activity) => ({
        ...activity,
        actor: employees.rows.find((employee) => employee.user_id === activity.user_id)?.name ?? "Operator",
        title: activity.description || activity.action.replaceAll("_", " "),
      })),
    [activityLogs.rows, employees.rows],
  );

  const checkoutRoleAllowed =
    posisiKode === "owner" ||
    posisiKode === "receptionist" ||
    posisiKode === "supervisor" ||
    isCheckoutTraining;

  function totalPaid(transactionId: string) {
    return payments.rows
      .filter((payment) => payment.transaction_id === transactionId)
      .reduce((total, payment) => total + Number(payment.amount), 0);
  }

  function checkoutDisabledReason(
    item: (typeof transaksi)[number],
    room: (typeof kamar)[number] | undefined,
  ) {
    if (!checkoutRoleAllowed) return "Role ini tidak memiliki akses Check-out.";
    if (isCheckoutTraining && checkoutSessionLoading) return "Sesi Training sedang dimuat.";
    if (isCheckoutTraining && checkoutSessionError) return checkoutSessionError;
    if (isCheckoutTraining && !checkoutSessionId) return "Sesi kas Training yang sah belum tersedia.";
    if (payments.loading) return "Pembayaran sedang diverifikasi.";
    if (payments.error) return "Pembayaran belum dapat diverifikasi.";
    if (item.status !== "check_in") return "Transaksi sudah tidak aktif.";
    if (!room || room.status !== "occupied") return "Status kamar sudah berubah.";

    const total = Number(item.price_snapshot ?? NaN);
    if (!Number.isFinite(total) || total < 0 || totalPaid(item.id) < total) {
      return "Pembayaran transaksi belum sesuai ketentuan.";
    }

    return "";
  }

  async function checkOut(itemId: string) {
    const item = transactions.rows.find((transaction) => transaction.id === itemId);
    const room = kamar.find((roomItem) => roomItem.id === item?.room_id);
    const guest = guests.rows.find((guestItem) => guestItem.id === item?.guest_id);

    if (!item || !room || item.status !== "check_in" || room.status !== "occupied") {
      setDashboardMessage("Check-out gagal: transaksi atau status kamar sudah berubah.");
      await Promise.all([transactions.refresh(), rooms.refresh()]);
      return;
    }

    const disabledReason = checkoutDisabledReason(item, room);
    if (disabledReason) {
      setDashboardMessage(`Check-out belum dapat dilakukan: ${disabledReason}`);
      return;
    }

    const confirmed = window.confirm(
      `Konfirmasi Check-out\n\nKamar: ${room.room_number}\nTamu: ${guest?.full_name ?? "Tamu tidak tersedia"}\nNo. Transaksi: ${item.transaction_number}\n\nKamar akan masuk alur Housekeeping setelah berhasil.`,
    );

    if (!confirmed) return;

    setCheckingOutId(item.id);
    setDashboardMessage("");

    try {
      const { error } = await supabase.rpc(
        isCheckoutTraining
          ? "check_out_training_transaction"
          : "check_out_transaction",
        isCheckoutTraining
          ? { _transaction_id: item.id, _session_id: checkoutSessionId }
          : { _transaction_id: item.id },
      );

      if (error) {
        setDashboardMessage(`Check-out gagal: ${error.message}`);
        return;
      }

      await Promise.all([transactions.refresh(), rooms.refresh(), payments.refresh()]);
      setDashboardMessage(`Check-out ${item.transaction_number} berhasil. Kamar masuk alur Housekeeping.`);
    } finally {
      setCheckingOutId(null);
    }
  }

  const statistik = [
    ...(peran === "owner"
      ? [
          {
            label: "Pendapatan hari ini",
            nilai: rupiah(
              pembayaranHariIni.reduce(
                (total, payment) =>
                  total + Number(payment.amount),
                0,
              ),
            ),
            kelas: "text-primary",
            ikon: CircleDollarSign,
            ikonKelas: "bg-v0-success/15 text-v0-success",
            catatan: "pembayaran tercatat hari ini",
            lebar: true,
          },
        ]
      : []),
    {
      label: "Booking aktif",
      nilai: String(bookingAktif.length),
      kelas: "text-foreground",
      ikon: CalendarDays,
      ikonKelas: "bg-v0-info/12 text-v0-info",
      catatan: "reservasi aktif",
      lebar: false,
    },
    {
      label: "Kamar tersedia",
      nilai: String(hitung("siap")),
      kelas: "text-siap-foreground",
      ikon: BedDouble,
      ikonKelas: "bg-v0-warning/15 text-gold-dark",
      catatan: `dari ${kamarAktif.length} kamar aktif`,
      lebar: false,
    },
    {
      label: "Kamar terisi",
      nilai: String(hitung("terisi")),
      kelas: "text-terisi-foreground",
      ikon: BedDouble,
      ikonKelas: "bg-v0-danger/12 text-v0-danger",
      catatan: "sedang digunakan",
      lebar: false,
    },
    {
      label: "Perlu dibersihkan",
      nilai: String(hitung("perlu")),
      kelas: "text-perlu-foreground",
      ikon: Brush,
      ikonKelas: "bg-v0-warning/15 text-gold-dark",
      catatan: "setelah Check-out",
      lebar: false,
    },
  ];

  return (
    <Kerangka judul="Ringkasan" tanpaJudul>
      <header className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-r from-navy-deep via-navy to-navy-soft px-5 py-6 text-white shadow-lg sm:px-7">
        <div className="pointer-events-none absolute -right-12 -top-16 size-52 rounded-full border-[18px] border-gold-light/15" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-light">
              Ringkasan operasional
            </p>
            <p className="mt-3 text-xl font-semibold">Selamat Datang,</p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {nama.split(" ")[0] || "Pengguna"}
            </h1>
            <p className="mt-1 text-sm font-medium text-white/80">Baturaden 25 Homestay</p>
          </div>
          <div className="text-left sm:text-right">
            <time className="text-sm font-semibold text-white/90">
              {new Date(sekarang).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            <p className="mt-2 text-xs text-gold-light">{posisi || "Pengguna"}</p>
          </div>
        </div>
      </header>

      {/* Live KPI values styled after the v0 cards; no preview values are used. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1fr_1fr]">
        {statistik.map((item) => {
          const Icon = item.ikon as LucideIcon;
          return (
            <article key={item.label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-[0_6px_20px_-8px_rgb(13_42_99/0.25)]">
              <span className={`flex size-14 shrink-0 items-center justify-center rounded-full ${item.ikonKelas}`}>
                <Icon className="size-7" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-navy-deep">{item.label}</h2>
                <p className={`mt-0.5 text-2xl font-bold ${item.kelas}`}>{item.nilai}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.catatan}</p>
              </div>
            </article>
          );
        })}
      </div>

      {/* The official P0-02 occupied-room table remains the operational source. */}

      <section className="mt-5">
        <section className="rounded-xl border border-border bg-card p-4 shadow-[0_6px_20px_-8px_rgb(13_42_99/0.2)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-navy-deep">Aktivitas Terbaru</h2>
            {peran === "owner" && <FileText className="size-5 text-gold-dark" aria-hidden="true" />}
          </div>
          {peran !== "owner" ? (
            <p className="mt-4 text-sm text-muted-foreground">Aktivitas live tersedia untuk Owner.</p>
          ) : activityItems.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
          ) : (
            <ol className="relative mt-4 flex flex-col gap-4">
              <span className="absolute bottom-4 left-[1.05rem] top-4 w-px bg-border" aria-hidden="true" />
              {activityItems.map((activity) => (
                <li key={activity.id} className="relative flex items-start gap-3">
                  <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary ring-4 ring-card">
                    <FileText className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-deep">{activity.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {activity.actor} · {jamWib(activity.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[4fr_3fr]">
        <section className="rounded-xl border border-border bg-card p-5 shadow-[0_6px_20px_-8px_rgb(13_42_99/0.2)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-navy-deep">Grafik Pendapatan</h2>
              <p className="text-sm text-muted-foreground">Berdasarkan pembayaran live yang tercatat</p>
            </div>
            <select
              aria-label="Periode grafik pendapatan"
              value={revenuePeriod}
              onChange={(event) => setRevenuePeriod(event.target.value as "mingguan" | "bulanan")}
              className="rounded-lg border border-gold/40 bg-accent px-3 py-2 text-sm font-medium text-navy-deep focus:outline-2 focus:outline-gold"
            >
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>
          {revenueData.every((point) => point.current === 0 && point.previous === 0) ? (
            <p className="mt-8 text-sm text-muted-foreground">Belum ada pembayaran untuk ditampilkan.</p>
          ) : (
            <div className="mt-5 flex h-44 items-end gap-2 border-b border-l border-border px-2 pb-2 sm:gap-3">
              {revenueData.map((point) => {
                const max = Math.max(1, ...revenueData.flatMap((item) => [item.current, item.previous]));
                return (
                  <div key={point.label} className="flex h-full flex-1 items-end justify-center gap-1" title={`${point.label}: ${rupiah(point.current)}`}>
                    <span className="w-3 rounded-t bg-slate-300" style={{ height: `${Math.max(2, (point.previous / max) * 100)}%` }} />
                    <span className="w-3 rounded-t bg-v0-info" style={{ height: `${Math.max(2, (point.current / max) * 100)}%` }} />
                    <span className="sr-only">{point.label}: {rupiah(point.current)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex justify-around text-xs text-muted-foreground">
            {revenueData.map((point) => <span key={point.label}>{point.label}</span>)}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-[0_6px_20px_-8px_rgb(13_42_99/0.2)]">
          <h2 className="text-xl font-bold text-navy-deep">Cash, QRIS, Transfer &amp; Pengeluaran</h2>
          <p className="text-sm text-muted-foreground">Komposisi berdasarkan catatan live</p>
          {paymentBreakdown.every((item) => item.amount === 0) ? (
            <p className="mt-8 text-sm text-muted-foreground">Belum ada pembayaran untuk ditampilkan.</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-4">
              {paymentBreakdown.map((item) => (
                <li key={item.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
                  <span className="size-3.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                  <span className="text-navy-soft">{item.label}</span>
                  <span className="font-semibold text-navy-deep">{rupiah(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section className="mt-8">
        <Judul>Kamar Sedang Terisi</Judul>

        {dashboardMessage && (
          <p role="status" className="mb-3 rounded-xl bg-secondary px-3 py-2 text-sm">
            {dashboardMessage}
          </p>
        )}

        {kamarTerisi.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center shadow-lembut">
            <Clock3 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold">Tidak ada kamar sedang terisi</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Kamar hanya muncul setelah Check-in berhasil dan selama statusnya TERISI.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-lembut">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kamar</th>
                  <th className="px-4 py-3 font-semibold">Tamu</th>
                  <th className="px-4 py-3 font-semibold">Paket</th>
                  <th className="px-4 py-3 font-semibold">Sisa waktu</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {kamarTerisi.map(({ transaksi: item, room, guest, roomType }) => {
                  const sisa = formatSisaWaktu(item.ends_at, sekarang);
                  const packageItem = packages.rows.find((pack) => pack.id === item.package_id);
                  const phoneNumber = guest?.phone
                    ? normalizeWhatsAppNumber(guest.phone)
                    : "";
                  const phoneValid = /^62\d{8,13}$/.test(phoneNumber);
                  const checkoutReason = checkoutDisabledReason(item, room);
                  const checkoutDisabled = Boolean(checkoutReason) || checkingOutId !== null;
                  const indikator =
                    sisa.status === "normal"
                      ? "🟢"
                      : sisa.status === "hampir"
                        ? "🟡"
                        : sisa.status === "expired"
                          ? "🔴"
                          : "⚪";

                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold">{room?.room_number ?? "—"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {roomType?.name ?? "Tipe belum tersedia"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold">{guest?.full_name ?? "Tamu tidak tersedia"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {guest?.phone ? `WA ••••${guest.phone.replace(/\D/g, "").slice(-4)}` : "WhatsApp tidak tersedia"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold">{kodePaket(packageItem?.name)}</p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {item.transaction_number}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className={`font-mono font-bold tabular-nums ${sisa.kelas}`}>
                          <span className="mr-1">{indikator}</span>
                          {sisa.waktu}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{sisa.label}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title="Detail transaksi"
                            aria-label={`Detail transaksi ${item.transaction_number}`}
                            className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary transition hover:bg-primary hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            onClick={() => setDetailTransactionId(item.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title={phoneValid ? "Hubungi tamu via WhatsApp" : "Nomor WhatsApp tersimpan tidak tersedia atau tidak valid"}
                            aria-label={phoneValid ? `Hubungi ${guest?.full_name ?? "tamu"} via WhatsApp` : "WhatsApp tidak tersedia"}
                            disabled={!phoneValid}
                            className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              if (!guest?.phone || !phoneValid) return;
                              openWhatsApp(guest.phone, `Halo ${guest.full_name}, kami dari Baturaden 25 Homestay.\nNo. Transaksi: ${item.transaction_number}`);
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title={checkoutDisabled ? checkoutReason || "Check-out sedang diproses" : "Check-out"}
                            aria-label={`Check-out kamar ${room?.room_number ?? ""}`}
                            disabled={checkoutDisabled}
                            className="grid h-9 w-9 place-items-center rounded-lg bg-red-100 text-red-700 transition hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => void checkOut(item.id)}
                          >
                            <LogOut className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PerawatanBerkala
        readOnly={
          posisiKode === "receptionist" ||
          posisiKode === "inspector" ||
          posisiKode === "investor"
        }
      />

            <section className="mt-8">
        <Judul>Aksi Cepat</Judul>

        {posisiKode === "housekeeping" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              to="/housekeeping"
              className="flex items-center justify-between rounded-2xl bg-primary px-5 py-5 text-primary-foreground shadow-lembut"
            >
              <div>
                <p className="text-sm font-semibold">Housekeeping</p>
                <p className="mt-1 text-xs opacity-80">
                  Lihat kamar yang perlu ditangani
                </p>
              </div>
              <Sparkles className="h-6 w-6" />
            </Link>

            <Link
              to="/kamar"
              className="flex items-center justify-between rounded-2xl bg-primary-soft px-5 py-5 text-primary"
            >
              <div>
                <p className="text-sm font-semibold">Status Kamar</p>
                <p className="mt-1 text-xs opacity-80">
                  Pantau kondisi kamar
                </p>
              </div>
              <Clock3 className="h-6 w-6" />
            </Link>
          </div>
        ) : posisiKode === "investor" || posisiKode === "inspector" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              to="/kamar"
              className="flex items-center justify-between rounded-2xl bg-primary-soft px-5 py-5 text-primary"
            >
              <div>
                <p className="text-sm font-semibold">Status Kamar</p>
                <p className="mt-1 text-xs opacity-80">
                  Lihat kondisi operasional
                </p>
              </div>
              <Clock3 className="h-6 w-6" />
            </Link>

            <Link
              to="/housekeeping"
              className="flex items-center justify-between rounded-2xl bg-primary-soft px-5 py-5 text-primary"
            >
              <div>
                <p className="text-sm font-semibold">Housekeeping</p>
                <p className="mt-1 text-xs opacity-80">
                  Lihat kondisi kebersihan
                </p>
              </div>
              <Sparkles className="h-6 w-6" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              to="/check-in"
              className="flex items-center justify-between rounded-2xl bg-primary px-5 py-5 text-primary-foreground shadow-lembut"
            >
              <div>
                <p className="text-sm font-semibold">Check-in</p>
                <p className="mt-1 text-xs opacity-80">
                  Tamu datang sekarang
                </p>
              </div>
              <LogIn className="h-6 w-6" />
            </Link>

            <Link
              to="/booking"
              className="flex items-center justify-between rounded-2xl bg-primary-soft px-5 py-5 text-primary"
            >
              <div>
                <p className="text-sm font-semibold">Booking</p>
                <p className="mt-1 text-xs opacity-80">
                  Buat reservasi baru
                </p>
              </div>
              <CalendarPlus className="h-6 w-6" />
            </Link>

            <Link
              to="/housekeeping"
              className="flex items-center justify-between rounded-2xl bg-primary-soft px-5 py-5 text-primary"
            >
              <div>
                <p className="text-sm font-semibold">Housekeeping</p>
                <p className="mt-1 text-xs opacity-80">
                  Pantau kebersihan kamar
                </p>
              </div>
              <Sparkles className="h-6 w-6" />
            </Link>
          </div>
        )}
      </section>
      {detailTransactionId && (
        <DetailTransaksi
          transactionId={detailTransactionId}
          mode={posisiKode === "housekeeping" ? "housekeeping" : "full"}
          onClose={() => setDetailTransactionId(null)}
        />
      )}
    </Kerangka>
  );
}
