import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Peran = "owner" | "karyawan";

type PeranContextValue = {
  peran: Peran;
  setPeran: (peran: Peran) => void;
  nama: string;
  posisi: string;
};

const PeranContext = createContext<PeranContextValue>({
  peran: "owner",
  setPeran: () => {},
  nama: "Pemilik",
  posisi: "Owner",
});

const KUNCI = "baturaden25-peran";

export function PeranProvider({ children }: { children: ReactNode }) {
  const [peran, setPeranState] = useState<Peran>("owner");

  useEffect(() => {
    const tersimpan = localStorage.getItem(KUNCI);
    if (tersimpan === "owner" || tersimpan === "karyawan") {
      setPeranState(tersimpan);
    }
  }, []);

  const setPeran = (nilai: Peran) => {
    setPeranState(nilai);
    localStorage.setItem(KUNCI, nilai);
  };

  const nama = peran === "owner" ? "Bagas Pratama" : "Rina Lestari";
  const posisi = peran === "owner" ? "Owner" : "Receptionist";

  return (
    <PeranContext.Provider value={{ peran, setPeran, nama, posisi }}>
      {children}
    </PeranContext.Provider>
  );
}

export function usePeran() {
  return useContext(PeranContext);
}
