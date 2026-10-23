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
  ReceiptText,
  Sparkles,
  ChevronRight,
  Receipt,
  BarChart3,
  Target,
  Flag,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Kerangka, MenuProfil } from "@/components/kerangka";
import { Button } from "@/components/ui/button";
import panorama from "@/assets/panorama-kota-malam.png.asset.json";
import { FormulirPemesanan } from "@/components/formulir-pemesanan";
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
  head: () => {
    const metadata = meta("Ringkasan", "Ringkasan harian Baturaden 25 Homestay: pendapatan, kamar, booking, dan housekeeping.");
    return { ...metadata, meta: [...metadata.meta, { property: "og:image", content: panorama.url }, { name: "twitter:image", content: panorama.url }] };
  },
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
      label: "TERISI",
      kelas: "text-siap-foreground",
    };
  }

  if (selisih >= 0) {
    return {
      status: "hampir" as const,
      waktu: formatDurasi(selisih),
      label: "TERISI",
      kelas: "text-v0-warning",
    };
  }

  return {
    status: "expired" as const,
    waktu: formatDurasi(0),
    label: "TERISI",
    kelas: "text-bahaya-foreground",
  };
}

function formatStatusBooking(scheduledCheckIn = "", scheduledCheckOut = "", sekarang = 0) {
  const mulai = new Date(scheduledCheckIn).getTime();
  const akhir = new Date(scheduledCheckOut).getTime();
  if (!Number.isFinite(mulai) || !Number.isFinite(akhir)) {
    return { status: "unknown" as const, waktu: "—", label: "BOOKING", kelas: "text-muted-foreground" };
  }
  if (sekarang >= akhir) {
    return { status: "expired" as const, waktu: "00:00:00", label: "KEDALUWARSA", kelas: "text-bahaya-foreground" };
  }
  if (sekarang > mulai) {
    return { status: "late" as const, waktu: formatDurasi(akhir - sekarang), label: "TERLAMBAT", kelas: "text-v0-warning" };
  }
  return { status: "booking" as const, waktu: formatDurasi(mulai - sekarang), label: "BOOKING", kelas: "text-gold-light" };
}

// Tampilan tabel saja: gunakan timestamp yang sama tanpa mengubah aturan waktu.
function formatSisaTabel(endsAt: string | null, sekarang: number) {
  if (!endsAt) return "—";
  const selisih = new Date(endsAt).getTime() - sekarang;
  if (!Number.isFinite(selisih)) return "—";
  return `${selisih < 0 ? "+" : "-"}${formatDurasi(Math.abs(selisih))}`;
}

function tipeKamarRingkas(name: string | undefined) {
  if (!name) return "—";
  const tipe = name.trim().toLowerCase();
  if (/^(standard|standar|std)$/.test(tipe)) return "Std";
  if (/^(superior|sup)\s*a$/.test(tipe)) return "Sup A";
  if (/^(superior|sup)\s*b$/.test(tipe)) return "Sup B";
  if (/^(deluxe|deluks|dlx)$/.test(tipe)) return "Dlx";
  return name;
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
  const housekeepingHistory = useTable("housekeeping_history", peran === "owner" || ["supervisor", "housekeeping", "inspector"].includes(posisiKode ?? ""));
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
  const [pencarian, setPencarian] = useState("");
  const [kataCari, setKataCari] = useState("");

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

  const bookingHariIni = useMemo(() => {
    const awalHari = new Date(`${tanggalWib(sekarang)}T00:00:00+07:00`).getTime();
    const akhirHari = awalHari + 86_400_000;
    return bookingAktif.filter((item) => {
      const mulai = item.scheduled_check_in ? new Date(item.scheduled_check_in).getTime() : NaN;
      const akhir = item.scheduled_check_out ? new Date(item.scheduled_check_out).getTime() : NaN;
      return Number.isFinite(mulai) && Number.isFinite(akhir) && mulai < akhirHari && akhir > awalHari;
    });
  }, [bookingAktif, sekarang]);

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
  const jumlahPerlu = hitung("perlu");
  const persenTerisi = kamarAktif.length > 0 ? Math.round((jumlahTerisi / kamarAktif.length) * 100) : 0;

  const statistik: Kpi[] = [
    ...(peran === "owner"
      ? [{
          label: "Pendapatan Hari Ini",
          nilai: rupiah(pembayaranHariIni.reduce((total, payment) => total + Number(payment.amount), 0)),
          catatan: "pembayaran hari ini",
          ikon: CircleDollarSign,
          varian: "hijau" as const,
        }]
      : []),
    {
      label: "Booking Aktif",
      nilai: String(bookingAktif.length),
      catatan: "menunggu kedatangan",
      ikon: CalendarDays,
      varian: "emas",
    },
    {
      label: "Kamar Terisi",
      nilai: String(jumlahTerisi),
      catatan: `dari ${kamarAktif.length} kamar`,
      ikon: BedDouble,
      varian: "emas",
      cincin: persenTerisi,
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

  const bookingPeringatan = useMemo(() => bookingHariIni
    .map((item) => ({ item, status: item.scheduled_check_in && item.scheduled_check_out ? formatStatusBooking(item.scheduled_check_in, item.scheduled_check_out, sekarang) : null }))
    .filter(({ item, status }) => status?.status === "late" || status?.status === "expired" || status?.status === "booking" && new Date(item.scheduled_check_in ?? 0).getTime() - sekarang <= BATAS_HAMPIR_HABIS_MS)
    .sort((a, b) => new Date(a.item.scheduled_check_in ?? 0).getTime() - new Date(b.item.scheduled_check_in ?? 0).getTime())
    .slice(0, 3), [bookingHariIni, sekarang]);

  // Satu baris utama per kamar: stay aktif lebih dahulu, lalu booking terdekat.
  const statusKamarBaris = useMemo(
    () => kamarAktif.flatMap((room) => {
      const terisi = kamarTerisi.find((item) => item.room?.id === room.id);
      const bookings = bookingHariIni
        .filter((item) => item.room_id === room.id)
        .sort((a, b) => new Date(a.scheduled_check_in ?? 0).getTime() - new Date(b.scheduled_check_in ?? 0).getTime());
      if (!terisi && bookings.length === 0) return [];
      const booking = bookings[0];
      const bookingBerikutnya = terisi ? bookings.find((item) => new Date(item.scheduled_check_in ?? 0).getTime() > sekarang) : bookings[1];
      const roomType = roomTypes.rows.find((typeItem) => typeItem.id === room.room_type_id);
      return [{ room, roomType, terisi, booking, bookingBerikutnya }];
    }),
    [bookingHariIni, kamarAktif, kamarTerisi, roomTypes.rows, sekarang],
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
      .slice(0, 6);
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

  const bolehAksiTransaksi = !["housekeeping", "investor", "inspector"].includes(posisiKode ?? "");
  const totalPemasukanHariIni = komposisi.filter((k) => k.label !== "Pengeluaran").reduce((t, k) => t + k.nominal, 0);
  const jamSekarang = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(sekarang));
  const bulanSingkat = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sept", "Okt", "Nov", "Des"];
  const tanggalPanjang = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Jakarta" })
    .formatToParts(new Date(sekarang))
    .map((bagian) => bagian.type === "month" ? bulanSingkat[Number(bagian.value) - 1] : bagian.value.replaceAll("/", " "))
    .join("");
  const cari = kataCari.trim().toLowerCase();
  const hasilTransaksi = cari ? transaksi.filter((t) => {
    const tamu = guests.rows.find((g) => g.id === t.guest_id);
    return [t.transaction_number, tamu?.phone].some((nilai) => nilai?.toLowerCase().includes(cari));
  }).slice(0, 8) : [];
  const hasilHk = cari ? housekeepingHistory.rows.filter((h) => h.job_number?.toLowerCase().includes(cari)).filter((h, i, rows) => rows.findIndex((r) => r.job_number === h.job_number) === i).slice(0, 8) : [];
  const hasilPengeluaran = cari ? pengeluaranRows.filter((e) => e.expense_number?.toLowerCase().includes(cari)).slice(0, 8) : [];

  return (
    <Kerangka judul="Ringkasan" penuh>
      <div className="relative isolate">
        {/* Panorama kota malam selebar layar, menyatu ke latar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] overflow-hidden sm:h-[520px]" aria-hidden="true">
          <img src={panorama.url} alt="" width={1672} height={941} className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/45 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_72%_62%,oklch(0.76_0.115_82/0.22),transparent_70%)] mix-blend-screen" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-background/70 to-background" />
        </div>

        <div className="px-4 pb-10 pt-5 sm:px-6 lg:px-8 2xl:px-10">
          {/* Baris atas: tanggal & profil */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <form onSubmit={(e) => { e.preventDefault(); setKataCari(pencarian); }} className="flex w-full min-w-0 items-center gap-2 rounded-full border border-gold/25 bg-background/65 py-1.5 pl-4 pr-1.5 backdrop-blur-md xl:mr-auto xl:w-[26.5rem]">
              <Search className="size-4 shrink-0 text-foreground/90" aria-hidden="true" />
              <input aria-label="Pencarian Dashboard" placeholder="Cari Transaksi dan Tamu...." value={pencarian} onChange={(e) => { setPencarian(e.target.value); if (!e.target.value.trim()) setKataCari(""); }} className="h-8 w-full min-w-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-gold/50" />
              <Button type="submit" size="sm" className="shrink-0 rounded-full px-4"><Search className="size-4" />Cari</Button>
            </form>
            <div className="flex items-center gap-3 rounded-full border border-gold/25 bg-background/55 px-4 py-2 text-sm backdrop-blur-md">
              <CalendarDays className="size-4 text-gold" aria-hidden="true" />
              <time className="font-medium capitalize">{tanggalPanjang}</time>
              <span className="h-4 w-px bg-gold/30" aria-hidden="true" />
              <span className="font-semibold tabular-nums text-gold-light">{jamSekarang} WIB</span>
            </div>
            <div className="hidden lg:block"><MenuProfil /></div>
          </div>
          {cari && (
            <section aria-label="Hasil pencarian" className="panel-mewah mt-3 p-4">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Hasil pencarian</h2><Button variant="ghost" size="icon" aria-label="Tutup pencarian" onClick={() => { setKataCari(""); setPencarian(""); }}><X /></Button></div>
              <ul className="divide-y divide-border text-sm">
                {hasilTransaksi.map((t) => <li key={t.id}><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => setDetailTransactionId(t.id)}><Receipt className="text-gold" />{t.transaction_number} — {guests.rows.find((g) => g.id === t.guest_id)?.full_name ?? "Tamu"}</Button></li>)}
                {hasilHk.map((h) => <li key={h.id}><Link to="/housekeeping" search={{ bagian: "riwayat" }} className="flex items-center gap-2 py-3 text-gold-light"><Sparkles className="size-4" />{h.job_number} — Kamar {kamar.find((r) => r.id === h.room_id)?.room_number ?? "—"}</Link></li>)}
                {hasilPengeluaran.map((e) => <li key={e.id}><Link to="/keuangan" className="flex items-center gap-2 py-3 text-gold-light"><ArrowUpRight className="size-4" />{e.expense_number} — {e.category} · {rupiah(e.amount)}</Link></li>)}
              </ul>
              {hasilTransaksi.length + hasilHk.length + hasilPengeluaran.length === 0 && <p className="py-3 text-sm text-muted-foreground">Tidak ada hasil pada data yang dapat Anda akses.</p>}
            </section>
          )}

          {/* Sapaan */}
          <header className="mt-6 max-w-3xl sm:mt-10">
            <p className="mt-2 text-base text-foreground/90 sm:text-lg">{salamWaktu(jamSekarang)}, <span className="font-semibold text-gold-light">{posisi || "Pengguna"}</span></p>
            <h1 className="mt-1 font-serif text-[2.1rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl 2xl:text-[3.6rem]">
              <span className="bg-gradient-to-b from-gold-light to-gold bg-clip-text text-transparent">{nama || "Pengguna"}</span>
            </h1>
            <p className="mt-3 w-fit rounded-lg bg-background/70 px-3 py-2 text-sm font-medium leading-relaxed text-foreground backdrop-blur-sm sm:text-base">Dibalik Homestay yang Ramai, ada Tim yang memiliki Visi &amp; Misi yang sama.</p>
          </header>

          {/* KPI + Aksi Cepat */}
          <div className="mt-7 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(300px,1.25fr)_repeat(3,minmax(0,1fr))]">
            <section className="panel-mewah min-w-0 p-4" aria-labelledby="judul-aksi-cepat">
              <h2 id="judul-aksi-cepat" className="font-serif text-xl font-semibold">Aksi Cepat</h2>
              {bolehAksiTransaksi ? (
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <TombolAksi ikon={LogIn} judul="Check-in Langsung" utama onClick={() => setModal("check_in")} />
                  <TombolAksi ikon={CalendarPlus} judul="Tambah Booking" onClick={() => setModal("booking")} />
                  <TombolAksi ikon={ReceiptText} judul={"Kas\nKeluar"} onClick={() => setModal("pengeluaran")} />
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {posisiKode === "housekeeping" || posisiKode === "inspector" ? (
                    <Link to="/housekeeping" className="flex items-center gap-2 rounded-lg border border-gold/25 bg-navy-deep/70 px-3 py-4 text-sm font-semibold transition hover:border-gold/60">
                      <Sparkles className="h-5 w-5 text-gold" /> Housekeeping
                    </Link>
                  ) : null}
                  <Link to="/kamar" className="flex items-center gap-2 rounded-lg border border-gold/25 bg-navy-deep/70 px-3 py-4 text-sm font-semibold transition hover:border-gold/60">
                    <Clock3 className="h-5 w-5 text-gold" /> Status Kamar
                  </Link>
                </div>
              )}
            </section>
            {statistik.map((item) => <KartuKpi key={item.label} item={item} />)}
          </div>

          {/* Tabel kamar (kiri) + Transaksi terbaru (kanan) */}
          <div className="mt-5 grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.95fr)_minmax(320px,1fr)]">
            <section className="panel-mewah flex min-w-0 flex-col overflow-hidden" aria-labelledby="judul-status-kamar">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="ikon-bulat size-10 shrink-0 text-gold"><BedDouble className="size-5" strokeWidth={1.6} /></span>
                  <div>
                    <h2 id="judul-status-kamar" className="font-serif text-lg font-semibold">Status Kamar <span className="text-gold-light">(Real-time)</span></h2>
                    <p className="text-xs text-muted-foreground">Kamar terisi dan Booking hari ini.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-navy-deep/70 px-2 py-1.5 text-[11px] font-semibold">
                  <span className="size-2 animate-pulse rounded-full bg-v0-success" /> Terisi {statusKamarBaris.filter((row) => row.terisi).length} Kamar · Booking {bookingHariIni.length}
                </span>
                <Link to="/kamar" search={{ bagian: "terisi" } as never} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light">
                  Lihat semua <ChevronRight className="size-3.5" />
                </Link>
                </div>
              </div>
              {dashboardMessage && (
                <p role="status" className="mx-5 mb-3 rounded-xl border border-border bg-secondary px-3 py-2 text-sm sm:mx-6">{dashboardMessage}</p>
              )}
              {bookingPeringatan.length > 0 && (
                <div role="status" className="mx-5 mb-3 space-y-1 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 text-xs sm:mx-6">
                  {bookingPeringatan.map(({ item, status }) => <p key={item.id}><span className={`font-bold ${status?.kelas}`}>{status?.label}</span> · {guests.rows.find((guest) => guest.id === item.guest_id)?.full_name ?? "Tamu"} · {item.transaction_number}</p>)}
                </div>
              )}
              {statusKamarBaris.length === 0 ? (
                <div className="mx-5 mb-5 grid place-items-center rounded-xl border border-dashed border-gold/25 bg-navy-deep/50 px-6 py-7 text-center sm:mx-6">
                  <BedDouble className="size-8 text-gold/60" strokeWidth={1.4} />
                  <p className="mt-3 font-serif text-lg">Tidak ada kamar terisi atau Booking hari ini</p>
                  <p className="mt-1 text-xs text-muted-foreground">Kamar dan Booking akan muncul di sini secara realtime.</p>
                </div>
              ) : (
                <div className="mx-4 mb-4 max-h-[400px] min-w-0 flex-1 overflow-auto rounded-lg border border-gold/15 bg-navy-deep/50">
                  <table className="pemisah-kolom w-full min-w-[720px] table-fixed text-center text-[11px] [&_th]:text-center [&_td]:text-center xl:min-w-0">
                    <colgroup>
                      <col className="w-[44px]" />
                      <col className="w-[48px]" />
                      <col />
                      <col className="w-[40px]" />
                      <col className="w-[100px]" />
                      <col className="w-[60px]" />
                      <col className="w-[90px]" />
                      <col className="w-[64px]" />
                      <col className="w-[68px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-navy-deep text-[11px] [&_th]:normal-case [&_th]:tracking-normal [&_th]:text-gold-light">
                      <tr className="border-b border-gold/20">
                        <th className="px-1 py-2 font-semibold">Kamar</th>
                        <th className="px-1 py-2 font-semibold">Tipe</th>
                        <th className="px-1 py-2 font-semibold">Tamu</th>
                        <th className="px-1 py-2 font-semibold">Paket</th>
                        <th className="px-1 py-2 font-semibold">Status</th>
                        <th className="px-1 py-2 whitespace-nowrap font-semibold">Check-in</th>
                        <th className="px-1 py-2 font-semibold">Sisa Waktu</th>
                        <th className="px-1 py-2 whitespace-nowrap font-semibold">Check-out</th>
                        <th className="px-1 py-2 text-center font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold/10">
                      {statusKamarBaris.map(({ room, roomType, terisi, booking, bookingBerikutnya }) => {
                        const item = terisi?.transaksi ?? booking;
                        const guest = terisi?.guest ?? guests.rows.find((guestItem) => guestItem.id === booking?.guest_id);
                        const sisa = terisi ? formatSisaWaktu(item?.ends_at ?? null, sekarang) : booking?.scheduled_check_in && booking?.scheduled_check_out ? formatStatusBooking(booking.scheduled_check_in, booking.scheduled_check_out, sekarang) : null;
                        const labelStatus = terisi ? sisa?.status === "expired" ? "Overtime" : "Terisi" : sisa?.status === "late" ? "Terlambat Datang" : sisa?.status === "expired" ? "Booking kedaluwarsa" : "Booking";
                        const kelasStatus = terisi ? "text-bahaya-foreground" : sisa?.status === "late" || sisa?.status === "expired" ? "text-v0-warning" : "text-terisi-foreground";
                        const batasTimer = terisi ? item?.ends_at : sisa?.status === "booking" ? item?.scheduled_check_in : item?.scheduled_check_out;
                        const packageItem = item ? packages.rows.find((p) => p.id === item.package_id) : undefined;
                        const phoneNumber = guest?.phone ? normalizeWhatsAppNumber(guest.phone) : "";
                        const phoneValid = /^62\d{8,13}$/.test(phoneNumber);
                        const checkoutReason = terisi && item ? checkoutDisabledReason(item, room) : "Booking belum Check-in.";
                        const checkoutDisabled = !terisi || !item || Boolean(checkoutReason) || checkingOutId !== null;
                        return (
                          <tr key={room.id} className="transition hover:bg-gold/[0.04]">
                            <td className="px-1 py-2">
                              <span className="font-semibold tabular-nums">{room.room_number}</span>
                            </td>
                            <td className="truncate px-1 py-2" title={roomType?.name}>{tipeKamarRingkas(roomType?.name)}</td>
                            <td className="px-1 py-2">
                              {guest ? (
                                <>
                                  <p className="truncate font-medium" title={`${guest.full_name} · ${item?.transaction_number ?? ""}`}>{guest.full_name}</p>
                                </>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-1 py-2">
                              {item ? (
                                <>
                                  <p className="font-semibold">{kodePaket(packageItem?.name)}</p>
                                  {bookingBerikutnya && <p className="mt-1 text-[10px] text-gold-light">Booking berikutnya {jamWib(bookingBerikutnya.scheduled_check_in ?? bookingBerikutnya.created_at)}</p>}
                                </>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-1 py-2">
                              <span className={`inline-flex max-w-full items-center justify-center gap-1.5 leading-tight ${kelasStatus}`}>
                                <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                                <span>{labelStatus}</span>
                              </span>
                            </td>
                            <td className="px-1 py-2 whitespace-nowrap tabular-nums">{terisi ? item?.started_at ? jamWib(item.started_at) : "—" : item?.scheduled_check_in ? jamWib(item.scheduled_check_in) : "—"}</td>
                            <td className="px-1 py-2">
                              {sisa ? (
                                <span className={`whitespace-nowrap font-mono text-xs font-semibold tabular-nums ${sisa.status === "expired" ? "text-bahaya-foreground" : "text-gold-light"}`}>{formatSisaTabel(batasTimer ?? null, sekarang)}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-1 py-2 whitespace-nowrap tabular-nums">{terisi ? item?.ends_at ? jamWib(item.ends_at) : "—" : item?.scheduled_check_out ? jamWib(item.scheduled_check_out) : "—"}</td>
                            <td className="px-1 py-2">
                              {item ? (
                                <div className="flex justify-center gap-1">
                                  <IkonAksi
                                    label={phoneValid ? "Hubungi tamu via WhatsApp" : "WhatsApp tidak tersedia"}
                                    disabled={!phoneValid}
                                    kelas="text-siap-foreground"
                                    onClick={() => {
                                      if (!guest?.phone || !phoneValid) return;
                                      openWhatsApp(guest.phone, `Halo ${guest.full_name}, kami dari Baturaden 25 Homestay.\nNo. Transaksi: ${item.transaction_number}`);
                                    }}
                                  ><svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.16 1.6 5.98L0 24l6.23-1.63a11.96 11.96 0 0 0 5.82 1.49h.01c6.58 0 11.94-5.36 11.94-11.95 0-3.2-1.24-6.2-3.48-8.43ZM12.05 21.85a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.87 9.87 0 0 1-1.51-5.3c0-5.48 4.46-9.94 9.94-9.94a9.87 9.87 0 0 1 7.03 2.91 9.87 9.87 0 0 1 2.91 7.03c0 5.48-4.46 9.94-9.94 9.94Zm5.45-7.44c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.5 1.7.64.71.22 1.36.19 1.87.12.57-.09 1.77-.73 2.02-1.43.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35Z" /></svg></IkonAksi>
                                  {terisi && <IkonAksi
                                    label={checkoutDisabled ? checkoutReason || "Check-out sedang diproses" : "Check-out"}
                                    disabled={checkoutDisabled}
                                    kelas="text-bahaya-foreground"
                                    onClick={() => void checkOut(item.id)}
                                  ><LogOut className="h-4 w-4" /></IkonAksi>}
                                </div>
                              ) : <span className="block text-center text-[11px] text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Transaksi terbaru */}
            <section className="panel-mewah flex min-w-0 flex-col p-4" aria-labelledby="judul-trx-terbaru">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="ikon-bulat size-10 shrink-0 text-gold"><FileText className="size-5" strokeWidth={1.6} /></span>
                  <h2 id="judul-trx-terbaru" className="font-serif text-lg font-semibold">Transaksi Terbaru</h2>
                </div>
                {bolehAksiTransaksi && (
                  <Link to="/transaksi" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light">
                    Lihat semua <ChevronRight className="size-3.5" />
                  </Link>
                )}
              </div>
              <div className="mt-4 h-px bg-gradient-to-r from-gold/40 via-gold/10 to-transparent" />
              {transaksiTerbaru.length === 0 ? (
                <div className="grid flex-1 place-items-center py-10 text-center">
                  <div>
                    <Receipt className="mx-auto size-8 text-gold/60" strokeWidth={1.4} />
                    <p className="mt-3 text-sm text-muted-foreground">Belum ada transaksi tercatat.</p>
                  </div>
                </div>
              ) : (
                <ol className="mt-1 max-h-[240px] overflow-y-auto divide-y divide-gold/10">
                  {transaksiTerbaru.map((t) => (
                    <li key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2.5">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full border ${t.jenis === "masuk" ? "border-v0-success/40 bg-siap text-siap-foreground" : "border-v0-danger/40 bg-bahaya text-bahaya-foreground"}`}>
                        {t.jenis === "masuk" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {t.judul}{t.sub && <span className="ml-1.5 font-normal text-muted-foreground">({t.sub})</span>}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{t.nomor}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums ${t.jenis === "masuk" ? "text-siap-foreground" : "text-bahaya-foreground"}`}>
                          {t.jenis === "masuk" ? "+ " : "− "}{rupiah(t.nominal)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{t.metode} · {jamWib(t.waktu)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          {/* Tiga modul analitik berjajar */}
          <div className={`mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2 ${peran === "owner" ? "xl:grid-cols-3" : ""}`}>
            <section className="panel-mewah p-4" aria-labelledby="judul-komposisi">
              <JudulModul id="judul-komposisi" ikon={CircleDollarSign} judul="Pendapatan Hari Ini" sub="Komposisi berdasarkan metode pembayaran" aksi={peran === "owner" ? <Link to="/keuangan" className="shrink-0 text-xs font-semibold text-gold hover:text-gold-light">Lihat Detail ›</Link> : undefined} />
              <Donat data={komposisi} totalPemasukan={totalPemasukanHariIni} />
            </section>

            <section className="panel-mewah p-4" aria-labelledby="judul-grafik">
              <JudulModul id="judul-grafik" ikon={BarChart3} judul="Grafik Pendapatan" sub={`Perbandingan pendapatan ${modeGrafik === "harian" ? "per hari" : modeGrafik === "mingguan" ? "per minggu" : "per bulan"}`} aksi={peran === "owner" ? <Link to="/laporan" search={{ bagian: "pendapatan" } as never} className="shrink-0 text-xs font-semibold text-gold hover:text-gold-light">Lihat Detail ›</Link> : undefined} />
              <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl border border-gold/20 bg-navy-deep/70 p-1 text-xs font-semibold" role="tablist">
                {(["harian", "mingguan", "bulanan"] as ModeGrafik[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={modeGrafik === m}
                    onClick={() => setModeGrafik(m)}
                    className={`rounded-lg px-3 py-1.5 capitalize transition ${modeGrafik === m ? "emas-isi" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {m}
                  </button>
                ))}
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
          </div>

        </div>
      </div>

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

type Kpi = {
  label: string;
  nilai: string;
  catatan: string;
  ikon: LucideIcon;
  varian: "emas" | "hijau" | "merah" | "amber";
  cincin?: number;
};

const warnaVarian: Record<Kpi["varian"], string> = {
  emas: "text-gold-light",
  hijau: "text-siap-foreground",
  merah: "text-bahaya-foreground",
  amber: "text-perlu-foreground",
};

function KartuKpi({ item }: { item: Kpi }) {
  const Ikon = item.ikon;
  const r = 25;
  const keliling = 2 * Math.PI * r;
  return (
    <article className="panel-mewah group relative flex min-w-0 flex-row items-center gap-2.5 overflow-hidden px-3.5 py-4 transition hover:-translate-y-0.5 hover:border-gold/50">
      <span className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-gold/[0.07] blur-2xl" aria-hidden="true" />
      {item.cincin === undefined && (
        <span className={`grid size-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 ${item.varian === "emas" ? "text-gold" : warnaVarian[item.varian]}`}>
          <Ikon className="size-6 sm:size-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
      {item.cincin !== undefined && (
        <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold"><Ikon className="size-6 sm:size-7" strokeWidth={1.5} aria-hidden="true" /></span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-[0.8rem] leading-tight text-foreground/85">{item.label}</h2>
        <p className="mt-1.5 truncate text-[1.6rem] font-bold leading-none tabular-nums text-foreground">{item.nilai}</p>
        <p className={`mt-1.5 line-clamp-2 text-[11px] leading-snug ${warnaVarian[item.varian]}`}>{item.catatan}</p>
      </div>
      {item.cincin !== undefined && (
        <div className="relative size-11 shrink-0" aria-label={`${item.cincin}% kamar terisi`}>
          <svg viewBox="0 0 60 60" className="size-full -rotate-90 drop-shadow-[0_0_10px_oklch(0.76_0.115_82/0.35)]">
            <circle cx="30" cy="30" r={r} fill="oklch(0.16 0.006 80)" stroke="var(--secondary)" strokeWidth="5" />
            {item.cincin > 0 && (
              <circle cx="30" cy="30" r={r} fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(item.cincin / 100) * keliling} ${keliling}`} />
            )}
          </svg>
          <span className="absolute inset-0 grid place-items-center text-xs font-bold text-gold-light">{item.cincin}%</span>
        </div>
      )}
    </article>
  );
}

function JudulModul({ id, ikon: Ikon, judul, sub, aksi }: { id: string; ikon: LucideIcon; judul: string; sub?: string; aksi?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="ikon-bulat size-9 shrink-0 text-gold"><Ikon className="size-4" strokeWidth={1.6} /></span>
        <div className="min-w-0">
          <h2 id={id} className="font-serif text-lg font-semibold leading-tight">{judul}</h2>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {aksi}
    </div>
  );
}

function TombolAksi({ ikon: Ikon, judul, utama, onClick }: { ikon: LucideIcon; judul: string; utama?: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={onClick}
      className={`flex h-auto min-h-12 whitespace-pre-line flex-row items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-left text-[0.65rem] font-semibold leading-tight transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${utama ? "emas-isi border-transparent" : "border-gold/30 bg-navy-deep/70 text-foreground hover:border-gold/70 hover:text-gold-light"}`}
    >
      <Ikon className={`h-5 w-5 ${utama ? "" : "text-gold"}`} strokeWidth={1.7} />
      <span className="min-w-0">{judul}</span>
    </Button>
  );
}

function IkonAksi({ label, disabled, kelas = "text-gold-light", onClick, children }: { label: string; disabled?: boolean; kelas?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <span title={label} className="inline-flex shrink-0">
    <Button
      variant="ghost"
      size="icon"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-full border border-gold/25 bg-secondary/80 transition hover:border-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${kelas}`}
    >
      {children}
    </Button>
    </span>
  );
}

function Donat({ data, totalPemasukan }: { data: { label: string; warna: string; nominal: number }[]; totalPemasukan: number }) {
  const total = data.reduce((s, d) => s + d.nominal, 0);
  const r = 52;
  const keliling = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="mt-4 flex flex-row items-center gap-4">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90 drop-shadow-[0_0_14px_oklch(0.76_0.115_82/0.25)]">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--secondary)" strokeWidth="18" />
          {total > 0 && data.map((d) => {
            const panjang = (d.nominal / total) * keliling;
            const el = (
              <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.warna} strokeWidth="18"
                strokeDasharray={`${panjang} ${keliling - panjang}`} strokeDashoffset={-offset} />
            );
            offset += panjang;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="whitespace-pre-line text-sm font-bold leading-tight tabular-nums text-foreground">{rupiah(totalPemasukan).replace(/^Rp\s?/, "Rp\n")}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 text-xs">
            <span className="size-3 rounded-full ring-2 ring-background" style={{ backgroundColor: d.warna }} aria-hidden="true" />
            <span className="min-w-0 truncate text-muted-foreground">{d.label}</span>
            <span className={`font-semibold tabular-nums ${d.label === "Pengeluaran" ? "text-bahaya-foreground" : ""}`}>{rupiah(d.nominal)}</span>
            <span className="w-8 text-right tabular-nums text-muted-foreground">{total > 0 ? Math.round((d.nominal / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Grafik({ data, ticks }: { data: { label: string; nilai: number }[]; ticks: number[] }) {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] gap-3">
      <div className="relative h-28 w-8 text-right text-[11px] text-muted-foreground">
        {ticks.map((t, i) => (
          <span key={t} className="absolute right-0" style={{ bottom: `calc(${(i / (ticks.length - 1)) * 100}% - 0.5rem)` }}>
            {labelJuta(t)}
          </span>
        ))}
      </div>
      <div>
        <div className="relative flex h-28 items-end gap-2 sm:gap-3">
          {ticks.map((t, i) => (
            <span key={t} className="absolute inset-x-0 border-t border-dashed border-gold/15" style={{ bottom: `${(i / (ticks.length - 1)) * 100}%` }} aria-hidden="true" />
          ))}
          {data.map((d) => (
            <div key={d.label} className="relative flex h-full flex-1 items-end justify-center" title={`${d.label}: ${rupiah(d.nilai)}`}>
              <span
                className="w-full max-w-9 rounded-t-md bg-gradient-to-t from-gold-dark via-gold to-gold-light shadow-[0_0_16px_-4px_var(--gold)] transition-all duration-500"
                style={{ height: `${Math.max(d.nilai > 0 ? 2 : 0, posisiSkala(d.nilai, ticks) * 100)}%` }}
              />
              <span className="sr-only">{d.label}: {rupiah(d.nilai)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 text-center text-[11px] text-muted-foreground sm:gap-3">
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
    <section className="panel-mewah p-4" aria-labelledby="judul-target">
      <JudulModul
        id="judul-target"
        ikon={Target}
        judul="Target Omzet"
        sub="Realisasi omzet bulan ini"
        aksi={
          <button type="button" onClick={() => { setIsian(target ? String(target) : ""); setUbah((v) => !v); }} className="shrink-0 rounded-lg border border-gold/30 px-3 py-1.5 text-xs font-semibold text-gold hover:border-gold/70">
            {target > 0 ? "Ubah" : "Atur target"}
          </button>
        }
      />
      {ubah && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); const n = Number(isian); if (n > 0) { onUbah(n); setUbah(false); } }}
        >
          <input type="number" min="1" value={isian} onChange={(e) => setIsian(e.target.value)} placeholder="Target (Rp)" className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
          <button type="submit" className="emas-isi rounded-xl px-4 text-sm font-bold">Simpan</button>
        </form>
      )}
      <div className="mt-4 flex flex-row items-center gap-4">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 140 140" className="size-full -rotate-90 drop-shadow-[0_0_14px_oklch(0.76_0.115_82/0.3)]">
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--secondary)" strokeWidth="11" />
            {isi > 0 && <circle cx="70" cy="70" r={r} fill="none" stroke="var(--gold)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${isi} ${keliling}`} className="transition-all duration-700" />}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-gold-light">{target > 0 ? `${Math.round(persen)}%` : "—"}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{target > 0 ? "tercapai" : "target belum diatur"}</p>
            </div>
          </div>
        </div>
        <dl className="w-full min-w-0 space-y-2 text-sm">
          <div className="flex items-center gap-3"><Flag className="size-4 shrink-0 text-gold" /><div><dt className="text-xs text-muted-foreground">Target bulan ini</dt><dd className="font-semibold">{target > 0 ? rupiah(target) : "Belum diatur"}</dd></div></div>
          <div className="flex items-center gap-3"><BarChart3 className="size-4 shrink-0 text-gold" /><div><dt className="text-xs text-muted-foreground">Realisasi</dt><dd className="font-semibold text-gold-light">{rupiah(realisasi)}</dd></div></div>
          {target > 0 && <div className="flex items-center gap-3"><Target className="size-4 shrink-0 text-gold" /><div><dt className="text-xs text-muted-foreground">Sisa target</dt><dd className="font-semibold">{rupiah(Math.max(0, target - realisasi))}</dd></div></div>}
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

  const kelasInput = "h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={kirim} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="judul-pengeluaran" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-5 shadow-lembut">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">Uang keluar</p>
            <h2 id="judul-pengeluaran" className="mt-1 text-lg font-bold">Catat Pengeluaran</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Tutup"><X className="size-4" /></Button>
        </div>
        {berhasil ? (
          <div className="mt-6 text-center">
            <p className="font-semibold text-siap-foreground">Pengeluaran tersimpan.</p>
            <Button type="button" onClick={onClose} className="mt-4">Selesai</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">Jenis pengeluaran
              <input value={kategori} onChange={(e) => setKategori(e.target.value)} className={`mt-1 ${kelasInput}`} placeholder="Contoh: Listrik, Laundry" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">Nominal (Rp)
                <input type="number" min="1" value={nominal} onChange={(e) => setNominal(e.target.value)} className={`mt-1 ${kelasInput}`} />
              </label>
              <label className="block text-sm">Metode
                <select value={metode} onChange={(e) => setMetode(e.target.value)} className={`mt-1 ${kelasInput}`}>
                  <option value="CASH">Cash</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">Catatan
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={`mt-1 ${kelasInput}`} />
            </label>
            {pesan && <p role="alert" className="rounded-xl bg-bahaya px-3 py-2 text-sm text-bahaya-foreground">{pesan}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={simpan}>{simpan ? "Menyimpan…" : "Simpan"}</Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/** Salam sesuai jam Jakarta (format "HH:MM" atau "HH.MM"). */
function salamWaktu(jam: string) {
  const j = Number.parseInt(jam, 10);
  if (Number.isNaN(j)) return "Selamat datang";
  if (j >= 4 && j < 11) return "Selamat pagi";
  if (j >= 11 && j < 15) return "Selamat siang";
  if (j >= 15 && j < 18) return "Selamat sore";
  return "Selamat malam";
}
