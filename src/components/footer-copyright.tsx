/** Informasi hak cipta tampilan aplikasi; bukan klaim atas aset pihak ketiga. */
export function FooterCopyright({ className = "" }: { className?: string }) {
  const tahun = new Date().getFullYear();

  return (
    <footer
      aria-label="Informasi hak cipta Baturaden 25 Homestay"
      className={`border-t border-gold/20 bg-navy-deep/95 text-foreground ${className}`}
    >
      <div className="mx-auto max-w-[1480px] px-4 py-3 text-center">
        <p className="text-xs font-normal leading-5 tracking-normal text-muted-foreground">
          © {tahun}, Baturaden 25 Homestay. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
