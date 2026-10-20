import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Kerangka } from '@/components/kerangka';
import { FormulirPemesanan } from '@/components/formulir-pemesanan';
import { meta } from '@/lib/meta';

export const Route=createFileRoute('/check-in')({head:()=>meta('Check-in','Proses check-in tamu Baturaden 25 Homestay.'),component:Halaman});
function Halaman() {
  const navigate = useNavigate();

  return (
    <Kerangka
      judul="Check-in"
      keterangan="Check-in langsung menggunakan harga resmi dan kalender operasional."
    >
      <FormulirPemesanan
        mode="check_in"
        onClose={() => void navigate({ to: '/transaksi' })}
        onSaved={async () => {}}
      />
    </Kerangka>
  );
}
