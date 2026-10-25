import gedungSate from '@/assets/gedung-sate-malam.jpg';

// Decorative, locally authored interpretations — never claims of actual landmarks.
const temaHeader: Record<string, string> = {
  '/': 'gedung-sate', '/booking': 'braga', '/tamu': 'anyaman',
  '/kamar': 'kayu', '/transaksi': 'geometris', '/housekeeping': 'linen',
  '/keuangan': 'art-deco', '/laporan': 'priangan',
  '/karyawan': 'netral', '/pengaturan': 'netral',
};

export function LatarHeader({ path, dashboard = false }: { path: string; dashboard?: boolean }) {
  const tema = temaHeader[path] ?? 'netral';
  return <div aria-hidden="true" data-header-tema={tema} className={`latar-priangan pointer-events-none absolute inset-0 overflow-hidden ${dashboard ? 'latar-priangan-dashboard' : ''}`}>
    {tema === 'gedung-sate' ? <img src={gedungSate} alt="" className="h-full w-full object-cover object-[center_45%]" /> : <>
      <div className={`motif-priangan motif-${tema} absolute inset-0 text-gold`} />
      {['braga', 'kayu', 'linen', 'priangan'].includes(tema) && <svg viewBox="0 0 1000 180" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full text-gold" fill="none" stroke="currentColor" strokeWidth="1.2">
        {tema === 'braga' && <g opacity=".35">
          {[460, 610, 760, 910].map(x => <g key={x}><path d={`M${x} 170V65h120v105M${x-8} 65h136v-9h-136zM${x+14} 56V42h92v14`} />{[24, 64, 98].map(dx => <path key={dx} d={`M${x+dx} 170v-48q0-22 18-22v70M${x+dx} 83h18`} />)}</g>)}
        </g>}
        {tema === 'kayu' && <g opacity=".4"><path d="M390 140 660 36 930 140M425 140 660 52 895 140M470 125v55m380-55v55M540 105v75m240-75v75M660 52v128M450 150h420" />{[90, 105, 120, 135, 150, 165].map(y => <path key={y} d={`M480 ${y}h360`} />)}</g>}
        {tema === 'linen' && <g opacity=".32"><path d="M450 170v-90q0-10 10-10h420q10 0 10 10v90M445 140h450v40H445zM490 92h160v42H490zM690 92h160v42H690zM475 145q180 30 390 0M620 140v40m140-40v40" /><path d="M910 150V50h65v100M920 50v100m14-100v100m14-100v100m14-100v100" /></g>}
        {tema === 'priangan' && <g opacity=".32"><path d="M300 180 570 28 780 180M510 180 775 42 1000 180M410 180q280-95 590-40M430 170q280-75 570-15M475 180q250-65 525-12M580 180q180-45 420-8" /></g>}
      </svg>}
    </>}
    <div className="selubung-priangan absolute inset-0" />
  </div>;
}