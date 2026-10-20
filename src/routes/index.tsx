import { rpc } from "@/lib/data-live";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  X,
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
import skyline from "@/assets/skyline-malam.jpg";
import { FormulirPemesanan } from "@/components/formulir-pemesanan";
import { LencanaStatus } from "@/components/status-kamar";
import { skalaGrafik, skalaAdaptif, posisiSkala, labelJuta, type ModeGrafik } from "@/lib/skala-grafik";
import { DetailTransaksi } from "@/components/detail-transaksi";
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
      kelas: "text-v0-warning",
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

const statusKamarMap = { ready: "siap", occupied: "terisi", dirty: "perlu", cleaning: "sedang" } as const;

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
      const { error } = await rpc(
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

  const jumlahTerisi = hitung("terisi");
  const jumlahSiap = hitung("siap");
  const jumlahPerlu = hitung("perlu");
  const persenTerisi = kamarAktif.length > 0 ? Math.round((jumlahTerisi / kamarAktif.length) * 100) : 0;

  const statistik: Kpi[] = [
    ...(peran === "owner"
      ? [{
          label: "Pendapatan Hari Ini",
          nilai: rupiah(pembayaranHariIni.reduce((total, payment) => total + Number(payment.amount), 0)),
          catatan: "pembayaran tercatat hari ini",
          ikon: CircleDollarSign,
          varian: "hijau" as const,
        }]
      : []),
    {
      label: "Booking Aktif",
      nilai: String(bookingAktif.length),
      catatan: "reservasi menunggu kedatangan",
      ikon: CalendarDays,
      varian: "emas",
    },
    {
      label: "Kamar Terisi",
      nilai: String(jumlahTerisi),
      catatan: `dari ${kamarAktif.length} kamar aktif`,
      ikon: BedDouble,
      varian: "emas",
      cincin: persenTerisi,
    },
    {
      label: "Kamar Tersedia",
      nilai: String(jumlahSiap),
      catatan: peran === "owner" ? `${jumlahPerlu} perlu dibersihkan` : "siap ditempati",
      ikon: Sparkles,
      varian: peran === "owner" && jumlahPerlu > 0 ? "amber" : "hijau",
    },
    ...(peran !== "owner"
      ? [{
          label: "Perlu Dibersihkan",
          nilai: String(jumlahPerlu),
          catatan: "setelah Check-out",
          ikon: Brush,
          varian: "amber" as const,
        }]
      : []),
  ];
  const isFinanceViewer = peran === "owner" || posisiKode === "supervisor";
  const pengeluaranRows = financeExpenses.rows as unknown as {
    id: string; category: string; expense_number: string | null; amount: number; method: string; created_at: string;
  }[];
  const hariIni = tanggalWib(sekarang);
  const pemasukanHariIni = payments.rows.filter((p) => tanggalWib(p.created_at) === hariIni);
  const pengeluaranHariIni = isFinanceViewer && !financeExpenses.error
    ? pengeluaranRows.filter((e) => tanggalWib(e.created_at) === hariIni)
    : [];
  const totalMetode = (m: string) =>
    pemasukanHariIni.filter((p) => p.method.toLowerCase() === m).reduce((t, p) => t + Number(p.amount), 0);
  const komposisi = [
    { label: "QRIS", warna: "var(--v0-info)", nominal: totalMetode("qris") },
    { label: "Transfer Bank", warna: "var(--gold)", nominal: totalMetode("transfer") },
    { label: "Cash", warna: "var(--v0-success)", nominal: totalMetode("cash") },
    ...(isFinanceViewer
      ? [{ label: "Pengeluaran", warna: "var(--v0-danger)", nominal: pengeluaranHariIni.reduce((t, e) => t + Number(e.amount), 0) }]
      : []),
  ];

  // Hanya kamar yang benar-benar TERISI, diurutkan dari sisa waktu paling dekat habis.
  const statusKamarBaris = useMemo(
    () => kamarTerisi.flatMap((k) => (k.room ? [{ room: k.room, roomType: k.roomType, terisi: k }] : [])),
    [kamarTerisi],
  );

  const transaksiTerbaru = useMemo(() => {
    const masuk = payments.rows.map((p) => {
      const trx = transaksi.find((t) => t.id === p.transaction_id);
      const guest = guests.rows.find((g) => g.id === trx?.guest_id);
      return {
        id: `in-${p.id}`,
        jenis: "masuk" as const,
        judul: guest?.full_name ?? "Tamu",
        sub: guest?.phone ? `••••${guest.phone.replace(/\D/g, "").slice(-4)}` : "",
        nomor: trx?.transaction_number ?? "—",
        nominal: Number(p.amount),
        metode: p.method,
        waktu: p.created_at,
      };
    });
    const keluar = isFinanceViewer && !financeExpenses.error
      ? pengeluaranRows.map((e) => ({
          id: `out-${e.id}`,
          jenis: "keluar" as const,
          judul: e.category,
          sub: "",
          nomor: e.expense_number ?? "—",
          nominal: Number(e.amount),
          metode: e.method,
          waktu: e.created_at,
        }))
      : [];
    return [...masuk, ...keluar]
      .sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime())
      .slice(0, 8);
  }, [payments.rows, transaksi, guests.rows, pengeluaranRows, financeExpenses.error, isFinanceViewer]);

  const [modeGrafik, setModeGrafik] = useState<ModeGrafik>("harian");
  const dataGrafik = useMemo(() => {
    const satuHari = 86_400_000;
    const bulanWib = (v: string | number) => tanggalWib(v).slice(0, 7);
    if (modeGrafik === "harian") {
      return Array.from({ length: 7 }, (_, i) => {
        const t = sekarang - (6 - i) * satuHari;
        const d = tanggalWib(t);
        return {
          label: new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }).format(new Date(t)).replace(".", ""),
          nilai: payments.rows.filter((p) => tanggalWib(p.created_at) === d).reduce((s, p) => s + Number(p.amount), 0),
        };
      });
    }
    if (modeGrafik === "mingguan") {
      return Array.from({ length: 6 }, (_, i) => {
        const minggu = 5 - i;
        const hari = new Set(Array.from({ length: 7 }, (_, k) => tanggalWib(sekarang - (minggu * 7 + k) * satuHari)));
        return {
          label: minggu === 0 ? "Mg ini" : `-${minggu} mg`,
          nilai: payments.rows.filter((p) => hari.has(tanggalWib(p.created_at))).reduce((s, p) => s + Number(p.amount), 0),
        };
      });
    }
    const [y = 2026, m = 1] = bulanWib(sekarang).split("-").map(Number);
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 1 - (5 - i), 15));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      return {
        label: new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(date),
        nilai: payments.rows.filter((p) => bulanWib(p.created_at) === key).reduce((s, p) => s + Number(p.amount), 0),
      };
    });
  }, [modeGrafik, payments.rows, sekarang]);

  const omzetBulanIni = payments.rows
    .filter((p) => tanggalWib(p.created_at).slice(0, 7) === hariIni.slice(0, 7))
    .reduce((s, p) => s + Number(p.amount), 0);
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const tersimpan = Number(window.localStorage.getItem(KUNCI_TARGET) ?? 0);
    if (tersimpan > 0) setTarget(tersimpan);
  }, []);

  const [modal, setModal] = useState<"check_in" | "booking" | "pengeluaran" | null>(null);
  const refreshSemua = async () => {
    await Promise.all([transactions.refresh(), rooms.refresh(), payments.refresh(), guests.refresh()]);
  };

  const ikonStatistik: Record<string, string> = {
    "Pendapatan hari ini": "text-primary",
    "Booking aktif": "text-v0-info",
    "Kamar tersedia": "text-siap-foreground",
    "Kamar terisi": "text-terisi-foreground",
    "Perlu dibersihkan": "text-perlu-foreground",
  };

  const bolehAksiTransaksi = !["housekeeping", "investor", "inspector"].includes(posisiKode ?? "");

  return (
    <Kerangka judul="Ringkasan" tanpaJudul>
      {/* Hero premium */}
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-border shadow-lembut">
        <img src={skyline} alt="" width={1920} height={640} className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 px-6 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-primary">Baturaden 25 Homestay</p>
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              Selamat datang, <span className="text-primary">{nama.split(" ")[0] || "Pengguna"}</span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Setiap tamu adalah cerita. Pastikan setiap kamar siap menyambut dengan sempurna.
            </p>
            <time className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium backdrop-blur">
              <CalendarDays className="size-3.5 text-primary" />
              {new Date(sekarang).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
            </time>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl border border-border bg-background/60 px-3 py-2 backdrop-blur">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold-dark text-sm font-bold text-primary-foreground">
              {(nama || "P").slice(0, 1).toUpperCase()}
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{nama || "Pengguna"}</p>
              <p className="text-xs text-primary">{posisi || "Pengguna"}</p>
            </div>
          </div>
        </div>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {statistik.map((item) => {
          const Icon = item.ikon as LucideIcon;
          return (
            <article key={item.label} className={`rounded-2xl border border-border bg-card p-4 shadow-lembut transition hover:border-primary/40 ${item.lebar ? "col-span-2 lg:col-span-1" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</h2>
                <span className={`grid size-9 place-items-center rounded-xl bg-secondary ${ikonStatistik[item.label] ?? "text-primary"}`}>
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
              </div>
              <p className={`mt-3 text-2xl font-bold tracking-tight ${ikonStatistik[item.label] ?? ""}`}>{item.nilai}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.catatan}</p>
            </article>
          );
        })}
      </div>

      {/* Aksi cepat */}
      <section className="mt-6">
        <Judul>Aksi Cepat</Judul>
        {bolehAksiTransaksi ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TombolAksi ikon={LogIn} judul="Check-in Langsung" ket="Tamu datang sekarang" utama onClick={() => setModal("check_in")} />
            <TombolAksi ikon={CalendarPlus} judul="Buat Booking" ket="Reservasi baru" onClick={() => setModal("booking")} />
            <TombolAksi ikon={ArrowUpRight} judul="Pengeluaran" ket="Catat uang keluar" onClick={() => setModal("pengeluaran")} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {posisiKode === "housekeeping" || posisiKode === "inspector" ? (
              <Link to="/housekeeping" className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-5 shadow-lembut transition hover:border-primary/40">
                <div><p className="text-sm font-semibold">Housekeeping</p><p className="mt-1 text-xs text-muted-foreground">Lihat kamar yang perlu ditangani</p></div>
                <Sparkles className="h-6 w-6 text-primary" />
              </Link>
            ) : null}
            <Link to="/kamar" className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-5 shadow-lembut transition hover:border-primary/40">
              <div><p className="text-sm font-semibold">Status Kamar</p><p className="mt-1 text-xs text-muted-foreground">Pantau kondisi kamar</p></div>
              <Clock3 className="h-6 w-6 text-primary" />
            </Link>
          </div>
        )}
      </section>

      {/* Status kamar real-time */}
      <section className="mt-6 rounded-2xl border border-border bg-card shadow-lembut">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-serif text-xl font-semibold">Status Kamar</h2>
            <p className="text-xs text-muted-foreground">Real-time · hanya kamar terisi, urut sisa waktu terdekat</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-siap-foreground">
            <span className="size-2 animate-pulse rounded-full bg-current" /> Langsung
          </span>
        </div>
        {dashboardMessage && (
          <p role="status" className="mx-5 mt-4 rounded-xl bg-secondary px-3 py-2 text-sm">{dashboardMessage}</p>
        )}
        {statusKamarBaris.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Tidak ada kamar sedang terisi.</p>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-semibold">Kamar</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Tamu</th>
                  <th className="px-3 py-3 font-semibold">Paket</th>
                  <th className="px-3 py-3 font-semibold">Check-in / out</th>
                  <th className="px-3 py-3 font-semibold">Sisa waktu</th>
                  <th className="px-5 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {statusKamarBaris.map(({ room, roomType, terisi }) => {
                  const item = terisi?.transaksi;
                  const guest = terisi?.guest;
                  const sisa = item ? formatSisaWaktu(item.ends_at, sekarang) : null;
                  const packageItem = item ? packages.rows.find((p) => p.id === item.package_id) : undefined;
                  const phoneNumber = guest?.phone ? normalizeWhatsAppNumber(guest.phone) : "";
                  const phoneValid = /^62\d{8,13}$/.test(phoneNumber);
                  const checkoutReason = item ? checkoutDisabledReason(item, room) : "";
                  const checkoutDisabled = !item || Boolean(checkoutReason) || checkingOutId !== null;
                  const status = statusKamarMap[room.status as keyof typeof statusKamarMap];
                  return (
                    <tr key={room.id} className="transition hover:bg-secondary/60">
                      <td className="px-5 py-3.5">
                        <p className="font-serif text-lg font-semibold leading-none">{room.room_number}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{roomType?.name ?? "—"}</p>
                      </td>
                      <td className="px-3 py-3.5">{status ? <LencanaStatus status={status} /> : room.status}</td>
                      <td className="px-3 py-3.5">
                        {guest ? (
                          <>
                            <p className="font-semibold">{guest.full_name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">WA ••••{guest.phone.replace(/\D/g, "").slice(-4)}</p>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3.5">
                        {item ? (
                          <>
                            <p className="font-semibold">{kodePaket(packageItem?.name)}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.transaction_number}</p>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-xs tabular-nums text-muted-foreground">
                        {item?.started_at ? `${jamWib(item.started_at)} → ${item.ends_at ? jamWib(item.ends_at) : "—"}` : "—"}
                      </td>
                      <td className="px-3 py-3.5">
                        {sisa ? (
                          <p className={`font-mono font-bold tabular-nums ${sisa.kelas}`}>{sisa.waktu}</p>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {item ? (
                          <div className="flex justify-end gap-1.5">
                            <IkonAksi label="Detail transaksi" onClick={() => setDetailTransactionId(item.id)}><Eye className="h-4 w-4" /></IkonAksi>
                            <IkonAksi
                              label={phoneValid ? "Hubungi tamu via WhatsApp" : "WhatsApp tidak tersedia"}
                              disabled={!phoneValid}
                              kelas="text-siap-foreground"
                              onClick={() => {
                                if (!guest?.phone || !phoneValid) return;
                                openWhatsApp(guest.phone, `Halo ${guest.full_name}, kami dari Baturaden 25 Homestay.\nNo. Transaksi: ${item.transaction_number}`);
                              }}
                            ><MessageCircle className="h-4 w-4" /></IkonAksi>
                            <IkonAksi
                              label={checkoutDisabled ? checkoutReason || "Check-out sedang diproses" : "Check-out"}
                              disabled={checkoutDisabled}
                              kelas="text-bahaya-foreground"
                              onClick={() => void checkOut(item.id)}
                            ><LogOut className="h-4 w-4" /></IkonAksi>
                          </div>
                        ) : <span className="block text-right text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[2fr_3fr]">
        {/* Komposisi pendapatan hari ini */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-lembut">
          <h2 className="font-serif text-xl font-semibold">Pendapatan Hari Ini</h2>
          <p className="text-xs text-muted-foreground">QRIS, Transfer Bank, Cash{isFinanceViewer ? " & Pengeluaran" : ""}</p>
          <Donat data={komposisi} />
        </section>

        {/* Transaksi terbaru */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-lembut">
          <h2 className="font-serif text-xl font-semibold">Transaksi Terbaru</h2>
          {transaksiTerbaru.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Belum ada transaksi tercatat.</p>
          ) : (
            <ol className="mt-4 divide-y divide-border">
              {transaksiTerbaru.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${t.jenis === "masuk" ? "bg-siap text-siap-foreground" : "bg-bahaya text-bahaya-foreground"}`}>
                    {t.jenis === "masuk" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {t.judul}{t.sub && <span className="ml-2 font-normal text-muted-foreground">{t.sub}</span>}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{t.nomor} · {jamWib(t.waktu)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold tabular-nums ${t.jenis === "masuk" ? "text-siap-foreground" : "text-bahaya-foreground"}`}>
                      {t.jenis === "masuk" ? "+" : "−"}{rupiah(t.nominal)}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.metode}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>

      <section className={`mt-4 grid grid-cols-1 gap-4 ${peran === "owner" ? "xl:grid-cols-[3fr_2fr]" : ""}`}>
        {/* Grafik pendapatan */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-lembut">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold">Grafik Pendapatan</h2>
              <p className="text-xs text-muted-foreground">Berdasarkan pembayaran tercatat · M = juta rupiah</p>
            </div>
            <div className="flex rounded-xl border border-border bg-secondary p-1 text-xs font-semibold" role="tablist">
              {(["harian", "mingguan", "bulanan"] as ModeGrafik[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={modeGrafik === m}
                  onClick={() => setModeGrafik(m)}
                  className={`rounded-lg px-3 py-1.5 capitalize transition ${modeGrafik === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Grafik data={dataGrafik} ticks={skalaAdaptif(skalaGrafik[modeGrafik], Math.max(0, ...dataGrafik.map((d) => d.nilai)))} />
        </section>

        {peran === "owner" && (
          <TargetOmzet
            realisasi={omzetBulanIni}
            target={target}
            onUbah={(nilai) => {
              setTarget(nilai);
              window.localStorage.setItem(KUNCI_TARGET, String(nilai));
            }}
          />
        )}
      </section>

      {peran === "owner" && (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-lembut">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold">Aktivitas Terbaru</h2>
            <FileText className="size-5 text-primary" aria-hidden="true" />
          </div>
          {activityItems.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-3">
              {activityItems.map((activity) => (
                <li key={activity.id} className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.actor} · {jamWib(activity.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}


      {modal === "check_in" && <FormulirPemesanan mode="check_in" onClose={() => setModal(null)} onSaved={refreshSemua} />}
      {modal === "booking" && <FormulirPemesanan mode="booking" onClose={() => setModal(null)} onSaved={refreshSemua} />}
      {modal === "pengeluaran" && (
        <FormulirPengeluaran
          sessionId={checkoutSessionId}
          isTraining={isCheckoutTraining}
          onClose={() => setModal(null)}
          onSaved={async () => { await Promise.all([financeExpenses.refresh(), refreshSemua()]); }}
        />
      )}

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

const KUNCI_TARGET = "baturaden25.target_omzet_bulanan";

function TombolAksi({ ikon: Ikon, judul, ket, utama, onClick }: { ikon: LucideIcon; judul: string; ket: string; utama?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between rounded-2xl border px-5 py-4 text-left shadow-lembut transition hover:-translate-y-0.5 ${utama ? "border-transparent bg-gradient-to-r from-gold-light via-gold to-gold-dark text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
    >
      <div>
        <p className="text-sm font-bold">{judul}</p>
        <p className={`mt-0.5 text-xs ${utama ? "opacity-75" : "text-muted-foreground"}`}>{ket}</p>
      </div>
      <span className={`grid size-10 place-items-center rounded-xl ${utama ? "bg-background/20" : "bg-secondary text-primary"}`}>
        <Ikon className="h-5 w-5" />
      </span>
    </button>
  );
}

function IkonAksi({ label, disabled, kelas = "text-primary", onClick, children }: { label: string; disabled?: boolean; kelas?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-lg border border-border bg-secondary transition hover:border-current focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-35 ${kelas}`}
    >
      {children}
    </button>
  );
}

function Donat({ data }: { data: { label: string; warna: string; nominal: number }[] }) {
  const total = data.reduce((s, d) => s + d.nominal, 0);
  const r = 52;
  const keliling = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <svg viewBox="0 0 140 140" className="size-40 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--secondary)" strokeWidth="16" />
        {total > 0 && data.map((d) => {
          const panjang = (d.nominal / total) * keliling;
          const el = (
            <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.warna} strokeWidth="16"
              strokeDasharray={`${panjang} ${keliling - panjang}`} strokeDashoffset={-offset} />
          );
          offset += panjang;
          return el;
        })}
      </svg>
      <ul className="w-full space-y-2.5">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
            <span className="size-3 rounded-full" style={{ backgroundColor: d.warna }} aria-hidden="true" />
            <span className="text-muted-foreground">{d.label} <span className="text-xs">({total > 0 ? Math.round((d.nominal / total) * 100) : 0}%)</span></span>
            <span className="font-semibold tabular-nums">{rupiah(d.nominal)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Grafik({ data, ticks }: { data: { label: string; nilai: number }[]; ticks: number[] }) {
  return (
    <div className="mt-5 grid grid-cols-[auto_1fr] gap-3">
      <div className="relative h-48 w-8 text-right text-[11px] text-muted-foreground">
        {ticks.map((t, i) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `calc(${(i / (ticks.length - 1)) * 100}% - 0.5rem)`, transform: "none" }}>
            {labelJuta(t)}
          </span>
        ))}
      </div>
      <div>
        <div className="relative flex h-48 items-end gap-2 sm:gap-4">
          {ticks.map((t, i) => (
            <span key={t} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${(i / (ticks.length - 1)) * 100}%` }} aria-hidden="true" />
          ))}
          {data.map((d) => (
            <div key={d.label} className="relative flex h-full flex-1 items-end justify-center" title={`${d.label}: ${rupiah(d.nilai)}`}>
              <span
                className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-gold-dark to-gold-light transition-all duration-500"
                style={{ height: `${Math.max(d.nilai > 0 ? 2 : 0, posisiSkala(d.nilai, ticks) * 100)}%` }}
              />
              <span className="sr-only">{d.label}: {rupiah(d.nilai)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 text-center text-[11px] text-muted-foreground sm:gap-4">
          {data.map((d) => <span key={d.label} className="flex-1 capitalize">{d.label}</span>)}
        </div>
      </div>
    </div>
  );
}

function TargetOmzet({ realisasi, target, onUbah }: { realisasi: number; target: number; onUbah: (n: number) => void }) {
  const [ubah, setUbah] = useState(false);
  const [isian, setIsian] = useState("");
  const persen = target > 0 ? (realisasi / target) * 100 : 0;
  const r = 58;
  const keliling = 2 * Math.PI * r;
  const isi = Math.min(100, persen) / 100 * keliling;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-lembut">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl font-semibold">Target Omzet</h2>
          <p className="text-xs text-muted-foreground">Bulan ini</p>
        </div>
        <button type="button" onClick={() => { setIsian(target ? String(target) : ""); setUbah((v) => !v); }} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary">
          {target > 0 ? "Ubah target" : "Atur target"}
        </button>
      </div>
      {ubah && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); const n = Number(isian); if (n > 0) { onUbah(n); setUbah(false); } }}
        >
          <input type="number" min="1" value={isian} onChange={(e) => setIsian(e.target.value)} placeholder="Target (Rp)" className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          <button type="submit" className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Simpan</button>
        </form>
      )}
      <div className="mt-4 flex items-center gap-5">
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 140 140" className="size-full -rotate-90">
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--secondary)" strokeWidth="12" />
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--gold)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${isi} ${keliling}`} className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{target > 0 ? `${Math.round(persen)}%` : "—"}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">tercapai</p>
            </div>
          </div>
        </div>
        <dl className="space-y-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Target</dt><dd className="font-semibold">{target > 0 ? rupiah(target) : "Belum diatur"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Realisasi</dt><dd className="font-semibold text-primary">{rupiah(realisasi)}</dd></div>
          {target > 0 && <div><dt className="text-xs text-muted-foreground">Kekurangan</dt><dd className="font-semibold">{rupiah(Math.max(0, target - realisasi))}</dd></div>}
        </dl>
      </div>
    </section>
  );
}

function FormulirPengeluaran({ sessionId, isTraining, onClose, onSaved }: { sessionId: string; isTraining: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [kategori, setKategori] = useState("");
  const [nominal, setNominal] = useState("");
  const [metode, setMetode] = useState("CASH");
  const [catatan, setCatatan] = useState("");
  const [pesan, setPesan] = useState("");
  const [simpan, setSimpan] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) { setPesan("Belum ada sesi kas terbuka. Buka sesi kas di halaman Keuangan terlebih dahulu."); return; }
    if (!kategori.trim() || !(Number(nominal) > 0)) { setPesan("Isi jenis pengeluaran dan nominal yang benar."); return; }
    setSimpan(true);
    setPesan("");
    const { error } = await rpc(isTraining ? "record_training_finance_expense" : "record_finance_expense", {
      _idempotency_key: crypto.randomUUID(),
      _session_id: sessionId,
      _amount: Number(nominal),
      _method: metode,
      _category: kategori.trim(),
      _note: catatan,
    });
    setSimpan(false);
    if (error) { setPesan(`Pengeluaran gagal disimpan: ${error.message}`); return; }
    setBerhasil(true);
    await onSaved();
  }

  const kelasInput = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={kirim} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="judul-pengeluaran" className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lembut">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Uang keluar</p>
            <h2 id="judul-pengeluaran" className="mt-1 font-serif text-2xl font-semibold">Catat Pengeluaran</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-full bg-secondary"><X className="size-4" /></button>
        </div>
        {berhasil ? (
          <div className="mt-6 text-center">
            <p className="font-semibold text-siap-foreground">Pengeluaran tersimpan.</p>
            <button type="button" onClick={onClose} className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Selesai</button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <label className="block text-xs font-semibold text-muted-foreground">Jenis pengeluaran
              <input value={kategori} onChange={(e) => setKategori(e.target.value)} className={`mt-1 ${kelasInput}`} placeholder="Contoh: Listrik, Laundry" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-muted-foreground">Nominal (Rp)
                <input type="number" min="1" value={nominal} onChange={(e) => setNominal(e.target.value)} className={`mt-1 ${kelasInput}`} />
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">Metode
                <select value={metode} onChange={(e) => setMetode(e.target.value)} className={`mt-1 ${kelasInput}`}>
                  <option value="CASH">Cash</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold text-muted-foreground">Catatan
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={`mt-1 ${kelasInput}`} />
            </label>
            {pesan && <p role="alert" className="rounded-xl bg-bahaya px-3 py-2 text-sm text-bahaya-foreground">{pesan}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Batal</button>
              <button type="submit" disabled={simpan} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{simpan ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
