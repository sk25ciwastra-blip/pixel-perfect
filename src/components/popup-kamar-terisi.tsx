import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, BedDouble, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PopupKamarTerisi({ nomor, onClose, onPilihKamar }: { nomor: string; onClose: () => void; onPilihKamar: () => void }) {
  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="kamar-terisi-overlay" />
        <Dialog.Content className="kamar-terisi-popup">
          <svg className="kamar-terisi-gelombang" viewBox="0 0 580 140" preserveAspectRatio="none" aria-hidden="true">
            <path className="kamar-terisi-gelombang-lembut" d="M0 12C80 26 84 76 190 94S420 150 580 140H0Z" />
            <path className="kamar-terisi-gelombang-emas" d="M0 45C70 62 96 112 220 128S460 138 580 140H0Z" />
            <path className="kamar-terisi-gelombang-terang" d="M0 67C100 91 102 123 265 140H0Z" />
            {Array.from({ length: 16 }, (_, i) => <path className="kamar-terisi-benang" key={i} d={`M0 ${51 + i * 4}C80 ${80 + i * 3} 96 ${117 + i} ${240 - i * 5} 140`} />)}
          </svg>
          <Dialog.Close asChild><Button variant="outline" size="icon" className="kamar-terisi-tutup" aria-label="Tutup pemberitahuan"><X /></Button></Dialog.Close>
          <div className="kamar-terisi-ikon" aria-hidden="true">
            <svg className="kamar-terisi-seruan" viewBox="0 0 42 38"><path d="M9 22L2 19M19 13L12 4M30 11L31 2" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" /></svg>
            <BedDouble strokeWidth={2.3} />
          </div>
          <div className="kamar-terisi-isi">
            <Dialog.Title className="kamar-terisi-judul"><span>Maaf</span>, Kamar {nomor}<br />Sedang Terisi</Dialog.Title>
            <Dialog.Description className="kamar-terisi-pesan">Silakan pilih kamar lain yang tersedia.</Dialog.Description>
            <Button className="kamar-terisi-pilih" onClick={onPilihKamar}><BedDouble /><span>Pilih Kamar Lain</span><ArrowRight /></Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}