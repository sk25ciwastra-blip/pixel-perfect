// Baturaden 25 Homestay — Dashboard Status Kamar presentation-only guards.
// This test does not import the app, run SQL, or access LIVE data.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const view = fs.readFileSync(path.join(root, "src/routes/index.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/components/dashboard-panel.css"), "utf8");
let passed = 0;
function check(label, success) {
  assert.ok(success, label);
  console.log("PASS", label);
  passed++;
}

const room = view.split('aria-labelledby="judul-status-kamar">')[1]?.split("{/* Transaksi terbaru */}")[0];
check("Room status panel remains in Dashboard", Boolean(room));
check("Room panel is flex-column with dedicated class", view.includes(
  'db-room-status-panel flex min-w-0 flex-col overflow-hidden" aria-labelledby="judul-status-kamar"'
));
check("No Agenda-labeled section in Status Kamar source (not browser UAT)", !/agenda/i.test(room));
check("Empty state only renders when no room or booking row", room.includes("statusKamarBaris.length === 0 ? ("));
check("Empty state stretches in flex column", room.includes(
  'db-room-status-empty mx-4 mb-3 flex min-w-0 flex-1 items-center justify-center'
));
check("Icon, title, description are centered as one group", room.includes(
  '<div className="flex max-w-xl flex-col items-center justify-center">'
));
check("Copy for no monitored rooms is explicit", room.includes(
  "Belum ada kamar yang perlu dipantau saat ini"
));
check("Real-time labels include all 6 statuses", room.includes(
  "terisi, booking, persiapan, terlambat, perlu tindakan, dan overtime"
));
check("If cleaning/action is outstanding, avoid false no-rooms-to-monitor claim",
  view.includes('indikator.persiapan > 0 || (indikator.perluTindakan ?? 0) > 0') &&
  room.includes('adaKondisiKamarLain ? "Tidak ada kamar terisi atau booking hari ini"')
);
check("Bottom status chips remain unchanged in data source and placement",
  room.includes('aria-label="Indikator status kamar" className="mt-auto') &&
  room.includes("indikatorStatus.map((status) =>") &&
  view.includes('label: "Overtime"') &&
  view.includes('label: "Perlu Tindakan"')
);
check("Existing room and booking action targets remain", room.includes(
  'Link to="/kamar" search={{ bagian: "terisi" } as never'
) && room.includes("onClick={() => void checkOut(item.id)}")
  && room.includes("openWhatsApp(guest.phone,")
);
check("Transient alerts and overtime actions remain", room.includes("dashboardMessage &&")
  && room.includes("bookingPeringatan.length > 0 &&")
  && room.includes("overtimePerluTindakan.length > 0 &&")
);
check("Populated room table grows toward the bottom indicators", room.includes(
  'db-room-status-table mx-4 mb-3 min-w-0 flex-1 overflow-auto'
) && !room.includes('max-h-[400px]'));
check("Long room lists remain scrollable in their own viewport",
  css.includes('.db-room-status-table {') &&
  css.includes('max-height: min(70dvh, 42rem);') &&
  css.includes('overscroll-behavior: contain;'));
check("Empty state fills remainder before bottom chips", css.includes(
  ".db-room-status-empty {"
) && css.includes("flex: 1 1 auto;") && css.includes("min-height: 13rem;"));
check("Mobile empty state uses limited minimum height", css.includes(
  "@media (max-width: 640px)"
) && css.includes("min-height: 11rem;"));
console.log(passed + " dashboard status presentation guards PASS");
