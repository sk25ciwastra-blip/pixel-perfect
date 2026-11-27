/** Informasi hak cipta tampilan aplikasi; bukan klaim atas aset pihak ketiga. */
export function FooterCopyright({ className = "" }: { className?: string }) {
  const tahun = new Date().getFullYear();

  return (
    <footer
      aria-label="Informasi hak cipta Baturaden 25 Homestay"
      className={`border-t border-gold/20 bg-navy-deep/95 text-foreground ${className}`}
    >
      <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-center gap-1 px-4 py-5 text-center">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gold">
          BATURADEN 25 HOMESTAY
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          © {tahun} Baturaden 25 Homestay. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
