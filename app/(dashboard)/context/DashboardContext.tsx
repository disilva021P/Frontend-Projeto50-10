"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api"; // 👈 Garante que importas a tua instância da API aqui

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criadaEm?: string; // 👈 Adicionada a data opcional
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

  // ─── LÓGICA DE CARREGAMENTO DAS NOTIFICAÇÕES ───
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let userId = null;
    try {
      const payload = JSON.parse(window.atob(token.split(".")[1]));
      userId = payload.sub;
    } catch (e) {
      console.error("Erro ao ler token no Contexto:", e);
      return;
    }

    const carregarNotificacoes = async () => {
      try {
        const res = await api.get("/notificacoes/me", {
          params: { userId: userId },
          headers: { Authorization: `Bearer ${token}` }
        });
        const lista = res.data.content || [];
        setNotificacoes(lista);
        setUnreadCount(lista.filter((n: any) => !n.lida).length);
      } catch (err) {
        console.error("Erro ao carregar notificações no Context:", err);
      }
    };

    // Executa no início
    carregarNotificacoes();

    // Polling ativo a cada 10 segundos
    const interval = setInterval(carregarNotificacoes, 10000);

    return () => clearInterval(interval);
  }, []);

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

  // Atualizado para ler as notificações uma a uma conforme a regra do teu Backend Java
  const marcarTodasComoLidas = async () => {
    // 1. Identifica quais são as notificações que o utilizador tem abertas e que ainda estão por ler
    const notificacoesNaoLidas = notificacoes.filter((n) => !n.lida);

    // 2. Atualiza o estado visual instantaneamente no ecrã para dar uma resposta rápida ao utilizador
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    setUnreadCount(0);

    // 3. Sincroniza com o Servidor Java disparando o PUT individual para cada ID
    try {
      const token = localStorage.getItem("token");
      if (!token || notificacoesNaoLidas.length === 0) return;

      // Executa todos os pedidos PUT em paralelo para máxima performance
      await Promise.all(
        notificacoesNaoLidas.map((notif) =>
          api.put(`/notificacoes/${notif.id}/ler`, null, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
      
      console.log("Todas as notificações foram marcadas como lidas no backend com sucesso!");
    } catch (err) {
      console.error("Erro ao sincronizar notificações lidas com o backend:", err);
    }
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