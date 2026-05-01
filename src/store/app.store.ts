import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EmpresaFiltro = string;

interface AppStore {
  dataVersion: number;
  bumpDataVersion: () => void;
  empresaActiva: EmpresaFiltro;
  setEmpresaActiva: (e: EmpresaFiltro) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
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

const getInitialChatOpen = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      dataVersion: 0,
      bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
      empresaActiva: "TODAS",
      setEmpresaActiva: (e) => set({ empresaActiva: e }),
      sidebarOpen: false,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      chatOpen: getInitialChatOpen(),
      setChatOpen: (v) => set({ chatOpen: v }),
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
    { name: "sig-app-state", partialize: (state) => ({ empresaActiva: state.empresaActiva, sidebarCollapsed: state.sidebarCollapsed }) }
  )
);
