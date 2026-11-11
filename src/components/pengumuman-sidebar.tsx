import { useEffect, useState } from "react";
import { ChevronRight, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeran } from "@/lib/peran";
import { PapanInformasi } from "@/components/papan-informasi";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const tanggal = (v: string) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" }).format(new Date(v));

/** Ringkasan pengumuman terbaru di sidebar; "Lihat" membuka Papan Informasi lengkap (termasuk kelola Owner). */
export function PengumumanSidebar() {
  const { siap, masuk } = usePeran();
  const [terbaru, setTerbaru] = useState<{ body: string; created_at: string } | null>(null);
  const [buka, setBuka] = useState(false);
  useEffect(() => {
    if (!siap || !masuk) return;
    let aktif = true;
    void supabase.from("operational_announcements").select("body, created_at").order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (aktif) setTerbaru(data?.[0] ?? null); });
    return () => { aktif = false; };
  }, [siap, masuk, buka]);
  return (
    <div className="relative bg-gradient-to-t from-background/95 via-background/80 to-background/40 px-5 pb-5 pt-4 [text-shadow:0_2px_10px_oklch(0_0_0/0.9)]">
      <p className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-gold"><Megaphone className="size-4" strokeWidth={1.7} />Pengumuman Owner</p>
      <p className="mt-2 line-clamp-2 text-[0.8rem] leading-snug text-foreground/90">{terbaru?.body ?? "Belum ada pengumuman operasional"}</p>
      {terbaru && <p className="mt-2 text-[0.7rem] text-muted-foreground">{tanggal(terbaru.created_at)}</p>}
      <button type="button" onClick={() => setBuka(true)} className="ml-auto mt-1 flex items-center gap-0.5 text-xs font-semibold text-gold hover:text-gold-light">Lihat <ChevronRight className="size-3.5" /></button>
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Papan Informasi</DialogTitle><DialogDescription>Informasi dan pengumuman operasional</DialogDescription></DialogHeader>
          <PapanInformasi />
        </DialogContent>
      </Dialog>
    </div>
  );
}
