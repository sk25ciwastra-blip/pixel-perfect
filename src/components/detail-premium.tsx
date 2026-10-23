import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import gedungSate from '@/assets/gedung-sate-malam.jpg';

export function HeaderDetail({ title, nomor, onClose, panorama = false }: { title: string; nomor: string; onClose: () => void; panorama?: boolean }) {
  return <header className="relative isolate overflow-hidden border-b border-gold/25 bg-navy-deep px-5 py-5 sm:px-6 sm:py-6">
    {panorama && <img src={gedungSate} alt="" aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-1/2 object-cover object-center opacity-20 [mask-image:linear-gradient(to_right,transparent,black)]" />}
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold text-gold">BATURADEN 25 HOMESTAY</p><h2 className="mt-2 break-words font-serif text-3xl leading-tight sm:text-4xl">{title}</h2><p className="mt-2 break-all font-mono text-xs text-muted-foreground sm:text-sm">ID: {nomor}</p></div><Button type="button" variant="outline" className="h-9 shrink-0 gap-1.5 border-gold/30 px-2.5 text-xs text-gold-light sm:px-3 sm:text-sm" onClick={onClose}><X className="size-4" />Tutup</Button></div>
  </header>;
}

export const kelasPopupDetail = 'max-h-[calc(100dvh-2rem)] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-gold/45 bg-background text-sm shadow-lembut';

export function BagianDetail({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return <section className="min-w-0 rounded-lg border border-gold/30 bg-navy-deep/25 p-3.5 sm:p-4"><h3 className="mb-3 flex items-center gap-2.5 border-b border-gold/15 pb-3 text-xs font-semibold uppercase text-gold-light"><Icon className="size-5 shrink-0" strokeWidth={1.5} />{title}</h3>{children}</section>;
}

export function NilaiDetail({ label, icon: Icon, children, tone = 'normal' }: { label: string; icon: LucideIcon; children: ReactNode; tone?: 'normal' | 'masuk' | 'keluar' | 'total' }) {
  const warna = { normal: 'text-foreground', masuk: 'text-siap-foreground', keluar: 'text-bahaya-foreground', total: 'text-gold-light' };
  return <div className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 ${tone === 'keluar' ? 'border-bahaya-foreground/25 bg-bahaya/30' : tone === 'total' ? 'border-gold/40 bg-gold/5' : 'border-gold/15 bg-background/60'}`}><span className="grid size-9 shrink-0 place-items-center rounded-lg border border-gold/20 bg-primary-soft/20 text-gold"><Icon className="size-5" strokeWidth={1.5} /></span><div className="min-w-0 flex-1"><p className="mb-1 text-xs text-muted-foreground">{label}</p><div className={`break-words text-sm font-medium leading-relaxed ${warna[tone]}`}>{children}</div></div></div>;
}