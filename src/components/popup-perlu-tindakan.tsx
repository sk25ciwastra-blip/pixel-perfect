import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, BedDouble } from 'lucide-react';
import { Button } from '@/components/ui/button';
import '@/components/kamar.css';

export type KamarPerluTindakan = { roomNumber: string; transactionNumber?: string | null };

/** Read-only warning, sharing the official room-status popup template. */
export function PopupPerluTindakan({ rooms, onClose }: {
  rooms: readonly KamarPerluTindakan[];
  onClose: () => void;
}) {
  const single = rooms.length === 1;
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="kamar-terisi-overlay" />
        <Dialog.Content className="kamar-terisi-popup kamar-perlu-popup" data-status="overtime">
          <svg className="kamar-terisi-gelombang" viewBox="0 0 580 140" preserveAspectRatio="none" aria-hidden="true">
            <path className="kamar-terisi-gelombang-lembut" d="M0 12C80 26 84 76 190 94S420 150 580 140H0Z" />
            <path className="kamar-terisi-gelombang-emas" d="M0 45C70 62 96 112 220 128S460 138 580 140H0Z" />
            <path className="kamar-terisi-gelombang-terang" d="M0 67C100 91 102 123 265 140H0Z" />
            {Array.from({ length: 16 }, (_, i) => (
              <path className="kamar-terisi-benang" key={i} d={'M0 ' + (51 + i * 4) + 'C80 ' + (80 + i * 3) + ' 96 ' + (117 + i) + ' ' + (240 - i * 5) + ' 140'} />
            ))}
          </svg>
          <div className="kamar-terisi-ikon" aria-hidden="true">
            <svg className="kamar-terisi-seruan" viewBox="0 0 42 38">
              <path d="M9 22L2 19M19 13L12 4M30 11L31 2" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            </svg>
            <BedDouble strokeWidth={2.3} />
          </div>
          <div className="kamar-terisi-isi">
            <Dialog.Title className="kamar-terisi-judul">
              <span>Perlu Tindakan!</span>
              {single ? <> Kamar {rooms[0].roomNumber}</> : <> {rooms.length} Kamar</>}
            </Dialog.Title>
            <Dialog.Description className="kamar-terisi-pesan">
              {single ? 'Kamar ini' : 'Kamar berikut'} masih terisi dan melewati waktu Check-out resmi lebih dari 120 menit. Hubungi tamu dan lakukan Check-out yang sah.
            </Dialog.Description>
            <ul className="kamar-perlu-daftar" aria-label="Kamar yang perlu tindakan">
              {rooms.map((room) => (
                <li key={room.roomNumber}>
                  <strong>Kamar {room.roomNumber}</strong>
                  {room.transactionNumber && <span>{room.transactionNumber}</span>}
                </li>
              ))}
            </ul>
            <p className="mb-4 text-sm font-medium" style={{ color: 'var(--kamar-popup-muted)' }}>
              Kamar tetap TERISI dan tidak boleh digunakan untuk Check-in baru hingga benar-benar tersedia.
            </p>
            <Button type="button" className="kamar-terisi-pilih" onClick={onClose}>
              <BedDouble /><span>Mengerti</span><ArrowRight />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
