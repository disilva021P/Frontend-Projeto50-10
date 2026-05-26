"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
}

interface DashboardContextType {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  userName: string;
  role: Role | null;
  pinnedHrefs: string[];
  togglePin: (href: string) => void;
  showNotifPanel: boolean;
  setShowNotifPanel: (show: boolean) => void;
  showProfileMenu: boolean;
  setShowProfileMenu: (show: boolean) => void;
  unreadCount: number;
  notificacoes: Notificacao[];
  marcarTodasComoLidas: () => void;
  handleLogout: () => void;
  initials: string;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  useEffect(() => {
    const carregarDadosLocais = () => {
      const raw = localStorage.getItem("user");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setUserName(parsed.nome ?? "");
          setRole((parsed.tipoUtilizadorId as Role) ?? null);
        } catch { /* ignora */ }
      }
      const pins = localStorage.getItem("pinnedItems");
      if (pins) {
        try { setPinnedHrefs(JSON.parse(pins)); } catch { /* ignora */ }
      }
    };

    carregarDadosLocais();
    window.addEventListener("pageshow", carregarDadosLocais);
    window.addEventListener("focus", carregarDadosLocais);

    return () => {
      window.removeEventListener("pageshow", carregarDadosLocais);
      window.removeEventListener("focus", carregarDadosLocais);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const marcarTodasComoLidas = () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    setUnreadCount(0);
  };

  const togglePin = (href: string) => {
    setPinnedHrefs((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      localStorage.setItem("pinnedItems", JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <DashboardContext.Provider
      value={{
        drawerOpen, setDrawerOpen, userName, role, pinnedHrefs, togglePin,
        showNotifPanel, setShowNotifPanel, showProfileMenu, setShowProfileMenu,
        unreadCount, notificacoes, marcarTodasComoLidas, handleLogout, initials
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard deve ser usado dentro de um DashboardProvider");
  return context;
}