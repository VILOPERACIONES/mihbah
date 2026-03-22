import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EmpresaFiltro = "TODAS" | "BM CORP" | "MIHBAH" | "YCDI";

interface AppStore {
  empresaActiva: EmpresaFiltro;
  setEmpresaActiva: (e: EmpresaFiltro) => void;
  filtroTipo: string[];
  filtroCategoria: string;
  filtroProyecto: string;
  filtroCuenta: string;
  filtroDesde: string;
  filtroHasta: string;
  filtroBusqueda: string;
  setFiltro: (key: string, value: unknown) => void;
  resetFiltros: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      empresaActiva: "TODAS",
      setEmpresaActiva: (e) => set({ empresaActiva: e }),
      filtroTipo: [],
      filtroCategoria: "",
      filtroProyecto: "",
      filtroCuenta: "",
      filtroDesde: "",
      filtroHasta: "",
      filtroBusqueda: "",
      setFiltro: (key, value) => set({ [key]: value } as Partial<AppStore>),
      resetFiltros: () =>
        set({
          filtroTipo: [],
          filtroCategoria: "",
          filtroProyecto: "",
          filtroCuenta: "",
          filtroDesde: "",
          filtroHasta: "",
          filtroBusqueda: "",
        }),
    }),
    { name: "sig-app-state" }
  )
);
