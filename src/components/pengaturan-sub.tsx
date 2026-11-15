import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import "./pengaturan-sub.css";

/** Pembungkus visual halaman tujuan menu Pengaturan: tombol kembali + gaya kartu warm white. Hanya tampilan. */
export function SubPengaturan({ children }: { children: ReactNode }) {
  return (
    <div className="atur-sub">
      <Link to="/pengaturan" className="atur-kembali"><ArrowLeft className="h-4 w-4" />Kembali ke Pengaturan</Link>
      {children}
    </div>
  );
}
