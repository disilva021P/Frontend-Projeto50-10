"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface UtilizadorResponseDto {
  id: string;
  nome: string;
  email: string;
  nif: string;
  telefone: string;
  tipoUtilizador: string;
  ativo: boolean;
  dataNascimento: string;
  criadoEm: string;
}

interface PageResponse {
  content: UtilizadorResponseDto[];
  totalPages: number;
  number: number;
  totalElements: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:8080";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

function getUserData(): { nome: string; role: Role | null } {
  if (typeof window === "undefined") return { nome: "", role: null };
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return { nome: "", role: null };
    const u = JSON.parse(raw);
    return { nome: u.nome ?? "", role: (u.tipoUtilizadorId as Role) ?? null };
  } catch { return { nome: "", role: null }; }
}

function initials(name: string = ""): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatDate(dt: string | null): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

const TIPO_LABELS: Record<string, string> = {
  ALUNO: "Aluno",
  PROFESSOR: "Professor",
  ENCARREGADO: "Encarregado",
  COORDENACAO: "Coordenação",
};

const TIPO_CORES: Record<string, { bg: string; text: string; border: string }> = {
  ROLE_ALUNO:       { bg: "rgba(78,114,169,0.10)", text: "#2D4E7A", border: "rgba(78,114,169,0.25)" },
  ROLE_PROFESSOR:   { bg: "rgba(160,133,96,0.12)", text: "#7A5020", border: "rgba(160,133,96,0.30)" },
  ROLE_ENCARREGADO: { bg: "rgba(74,143,89,0.10)",  text: "#2D6A3F", border: "rgba(74,143,89,0.25)"  },
  ROLE_COORDENACAO: { bg: "rgba(44,28,10,0.08)",   text: "#402F1D", border: "rgba(44,28,10,0.20)"   },
};

const TIPOS_CRIAR = ["ALUNO", "PROFESSOR", "ENCARREGADO"];

// ─── Navbar ───────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { title: "Principal", items: [
    { icon: "ti-home",        label: "Início",      href: "/landingPage" },
    { icon: "ti-calendar",    label: "Horários",    href: "/horarios"    },
    { icon: "ti-credit-card", label: "Pagamentos",  href: "/pagamentos"  },
  ]},
  { title: "Comunidade", items: [
    { icon: "ti-mail",         label: "Mensagens",   href: "/mensagens"   },
    { icon: "ti-star",         label: "Eventos",     href: "/eventos"     },
    { icon: "ti-shopping-bag", label: "Marketplace", href: "/marketplace" },
  ]},
  { title: "Gestão", items: [
    { icon: "ti-users",     label: "Utilizadores",    href: "/utilizadores" },
    { icon: "ti-chart-bar", label: "Gestão de Faltas", href: "/faltas"      },
  ]},
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function UtilizadoresPage() {
  const router = useRouter();

  // Auth
  const [userName, setUserName] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Lista
  const [utilizadores, setUtilizadores] = useState<UtilizadorResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [totalElementos, setTotalElementos] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [search, setSearch] = useState("");

  // Modal detalhe
  const [detalhe, setDetalhe] = useState<UtilizadorResponseDto | null>(null);

  // Modal repor password
  const [reporTarget, setReporTarget] = useState<UtilizadorResponseDto | null>(null);
  const [novaPass, setNovaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [loadingRepor, setLoadingRepor] = useState(false);

  // ── ESTADOS ADICIONADOS (IGUAL AO MARKETPLACE) ──
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingInserir, setLoadingInserir] = useState(false);
  const [loadingHashes, setLoadingHashes] = useState(true);
  const [hashesDiscobertas, setHashesDiscobertas] = useState<Record<string, string>>({
    ALUNO: "", PROFESSOR: "", ENCARREGADO: ""
  });

  // Formulário do Pop-up interno
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    nif: "",
    dataNascimento: "",
    id_tipoUtilizador: "",
  });

  // Feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Inicialização ──
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const { nome, role } = getUserData();
    setUserName(nome);
    if (role !== "COORDENACAO") { router.push("/landingPage"); }

    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [router]);

  // ── Carregar as hashes de funções para o formulário (igual à lógica do Java) ──
  const carregarHashesOficiais = async () => {
    try {
      setLoadingHashes(true);
      const res = await fetch(`${BASE_URL}/api/utilizadores/tipos-hashes`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHashesDiscobertas(data);
        // Deixa a opção "Aluno" selecionada por defeito
        if (data.ALUNO) {
          setForm(prev => ({ ...prev, id_tipoUtilizador: data.ALUNO }));
        }
      }
    } catch (err) {
      console.error("Erro ao carregar hashes de funções:", err);
    } finally {
      setLoadingHashes(false);
    }
  };

  useEffect(() => {
    carregarHashesOficiais();
  }, []);

  // ── Carregar utilizadores ──
  const carregar = useCallback(async (pagina: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pagina), size: "10", sort: "id" });
      if (filtroTipo) params.set("tipo", filtroTipo);
      const res = await fetch(`${BASE_URL}/api/utilizadores?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const data: PageResponse = await res.json();
      setUtilizadores(data.content);
      setTotalPaginas(data.totalPages);
      setPaginaAtual(data.number);
      setTotalElementos(data.totalElements);
    } catch {
      setErrorMsg("Erro ao carregar utilizadores.");
    } finally {
      setLoading(false);
    }
  }, [filtroTipo]);

  useEffect(() => { carregar(0); }, [carregar]);

  // Limpar alertas de feedback automaticamente após 4 segundos
  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  // Handler para os inputs do formulário interno
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ── Guardar Utilizador (Submissão do formulário pop-up) ──
  const handleSalvarUtilizador = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.nome || !form.email || !form.id_tipoUtilizador || !form.dataNascimento) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoadingInserir(true);
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const erroDados = await res.json().catch(() => ({}));
        throw new Error(erroDados.message || "Erro ao criar utilizador.");
      }

      setSuccessMsg("Utilizador criado com sucesso!");
      setModalAberto(false);
      
      // Limpa os campos mantendo a hash inicial padrão
      setForm({
        nome: "",
        email: "",
        telefone: "",
        nif: "",
        dataNascimento: "",
        id_tipoUtilizador: hashesDiscobertas.ALUNO || "",
      });

      // Atualiza a tabela imediatamente
      carregar(0);
    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro ao guardar o utilizador.");
    } finally {
      setLoadingInserir(false);
    }
  };

  // ── Toggle ativo ──
  async function toggleAtivo(u: UtilizadorResponseDto) {
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${u.id}/toggle-ativo`, {
        method: "PATCH", headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setSuccessMsg(`${u.nome} foi ${u.ativo ? "desativado" : "ativado"}.`);
      setDetalhe(prev => prev?.id === u.id ? { ...prev, ativo: !prev.ativo } : prev);
      carregar(paginaAtual);
    } catch { setErrorMsg("Erro ao alterar estado."); }
  }

  // ── Apagar (soft delete) ──
  async function apagar(u: UtilizadorResponseDto) {
    if (!confirm(`Tens a certeza que queres apagar ${u.nome}?`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${u.id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      setSuccessMsg(`${u.nome} foi removido.`);
      setDetalhe(null);
      carregar(paginaAtual);
    } catch { setErrorMsg("Erro ao apagar utilizador."); }
  }

  // ── Repor password ──
  async function reporPassword(e: React.FormEvent) {
    e.preventDefault();
    if (novaPass !== confirmarPass) { setErrorMsg("As passwords não coincidem."); return; }
    if (!reporTarget) return;
    setLoadingRepor(true);
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${reporTarget.id}/repor-password`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ novaPassword: novaPass, confirmarNovaPassword: confirmarPass }),
      });
      if (!res.ok) throw new Error();
      setSuccessMsg(`Password de ${reporTarget.nome} reposta com sucesso!`);
      setReporTarget(null);
      setNovaPass(""); setConfirmarPass("");
    } catch { setErrorMsg("Erro ao repor password."); }
    finally { setLoadingRepor(false); }
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const filtrados = utilizadores.filter(u =>
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const userInitials = initials(userName);

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--background)", fontFamily: "var(--font-lato)" }}>

        {/* Notificações Rápidas de Feedback */}
        {(successMsg || errorMsg) && (
          <div style={{ position: "fixed", top: 68, right: 24, zIndex: 110, animation: "fadeUp 0.2s ease", maxWidth: 320, padding: "12px 16px", borderRadius: 6, fontSize: 13, border: "1px solid", background: successMsg ? "#f0fdf4" : "#fef2f2", color: successMsg ? "#15803d" : "#991b1b", borderColor: successMsg ? "#bbf7d0" : "#fecaca", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            {successMsg || errorMsg}
          </div>
        )}

        {/* ── NAVBAR ── */}
        <nav style={{ height: 52, borderBottom: "1px solid var(--border-warm)", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0, position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setDrawerOpen(true)} aria-label="Abrir menu"
              style={{ width: 32, height: 32, border: "1px solid var(--border-warm)", borderRadius: 4, background: "#FFFCF8", color: "var(--panel-dark)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-menu-2" style={{ fontSize: 16 }} />
            </button>
            <div>
              <span style={{ fontFamily: "var(--font-playfair)", fontSize: 16, letterSpacing: 4, color: "var(--panel-dark)", fontWeight: 400 }}>entartes</span>
              <span style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginLeft: 4 }}>· utilizadores</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300 }}>
              {userName ? `Bem-vindo, ${userName.split(" ")[0]}` : ""}
            </span>
            <div style={{ position: "relative" }}>
              <div onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", fontSize: 11, letterSpacing: 1, fontFamily: "var(--font-playfair)", fontWeight: 400, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {userInitials}
              </div>
              {showProfileMenu && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 192, background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 4, boxShadow: "0 8px 24px rgba(44,28,10,0.12)", zIndex: 50, overflow: "hidden", padding: "4px 0" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(160,133,96,0.15)", background: "#FFFCF8" }}>
                    <p style={{ fontSize: 9, color: "var(--accent-muted)", textTransform: "uppercase", letterSpacing: 2, fontWeight: 300, marginBottom: 2 }}>Sessão iniciada</p>
                    <p style={{ fontSize: 12, color: "var(--panel-dark)", fontWeight: 400 }}>{userName || "Utilizador"}</p>
                  </div>
                  <button onClick={() => { router.push("/utilizadores/verPerfil"); setShowProfileMenu(false); }}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--panel-dark)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(44,28,10,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <i className="ti ti-user-cog" style={{ color: "var(--accent-muted)" }} /> O meu perfil
                  </button>
                  <div style={{ height: 1, background: "rgba(160,133,96,0.15)", margin: "4px 0" }} />
                  <button onClick={handleLogout}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#c0392b", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fdf2f2")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <i className="ti ti-logout" /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <div style={{ display: "flex", flex: 1, position: "relative", overflow: "hidden" }}>

          {/* Overlay drawer */}
          {drawerOpen && (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(44,31,20,0.30)" }} onClick={() => setDrawerOpen(false)} />
          )}

          {/* ── DRAWER ── */}
          <aside style={{ position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 20, width: 220, background: "#503c25", boxShadow: "4px 0 24px rgba(44,28,10,0.30)", transform: drawerOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform .28s cubic-bezier(.4,0,.2,1)", display: "flex", flexDirection: "column", borderRight: "1px solid rgba(245,217,168,0.12)" }}>
            <div style={{ padding: "20px", borderBottom: "1px solid rgba(245,217,168,0.12)" }}>
              <span style={{ fontFamily: "var(--font-playfair)", fontSize: 14, letterSpacing: 3, color: "#FFF8EE", fontWeight: 500, display: "block" }}>entartes</span>
              <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "rgba(245,217,168,0.65)", fontWeight: 400, marginTop: 4, display: "block" }}>escola de dança</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {NAV_SECTIONS.map(section => (
                <div key={section.title} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px 8px" }}>
                    <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(245,217,168,0.75)", fontWeight: 500, whiteSpace: "nowrap" }}>{section.title}</span>
                    <div style={{ flex: 1, borderBottom: "1px solid rgba(245,217,168,0.18)", marginTop: 2 }} />
                  </div>
                  {section.items.map(item => (
                    <button key={item.href} onClick={() => { router.push(item.href); setDrawerOpen(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 20px", color: item.href === "/utilizadores" ? "var(--accent-gold)" : "rgba(255,248,238,0.75)", background: item.href === "/utilizadores" ? "rgba(255,255,255,0.08)" : "transparent", border: "none", fontSize: 13, letterSpacing: .4, fontWeight: 300, cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={e => { if (item.href !== "/utilizadores") { (e.currentTarget).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget).style.color = "var(--accent-gold)"; } }}
                      onMouseLeave={e => { if (item.href !== "/utilizadores") { (e.currentTarget).style.background = "transparent"; (e.currentTarget).style.color = "rgba(255,248,238,0.75)"; } }}>
                      <i className={`ti ${item.icon}`} style={{ fontSize: 15, opacity: .85 }} aria-hidden="true" />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(245,217,168,0.12)" }}>
              <button onClick={handleLogout}
                style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(245,217,168,0.45)", fontSize: 13, fontWeight: 300, background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => ((e.currentTarget).style.color = "#F3AEAE")}
                onMouseLeave={e => ((e.currentTarget).style.color = "rgba(245,217,168,0.45)")}>
                <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true" /> Sair
              </button>
            </div>
          </aside>

          {/* ── CONTEÚDO ── */}
          <main style={{ flex: 1, overflowY: "auto", padding: "28px 28px 40px" }}>

            {/* Cabeçalho */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Coordenação</p>
                <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 26, color: "var(--panel-dark)", fontWeight: 400, marginBottom: 0 }}>
                  Utilizadores
                </h1>
                <p style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300, marginTop: 4 }}>
                  {totalElementos} {totalElementos === 1 ? "utilizador registado" : "utilizadores registados"}
                </p>
              </div>
              {/* ATUALIZADO: Agora abre o pop-up interno em vez de redirecionar de página */}
              <button onClick={() => setModalAberto(true)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--panel-dark)", border: "none", borderRadius: 6, color: "var(--accent-gold)", fontFamily: "var(--font-lato)", fontSize: 12, fontWeight: 400, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", transition: "opacity .2s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = ".85")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                <i className="ti ti-user-plus" style={{ fontSize: 15 }} /> Novo utilizador
              </button>
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--accent-muted)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Pesquisar por nome ou email…"
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px 9px 36px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--panel-dark)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border-warm)")} />
              </div>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                style={{ background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none", cursor: "pointer", minWidth: 180 }}>
                <option value="">Todos os tipos</option>
                {TIPOS_CRIAR.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--border-warm)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}

            {/* Lista */}
            {!loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtrados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 24px", border: "1px dashed var(--border-warm)", borderRadius: 8, background: "rgba(160,133,96,0.03)" }}>
                    <i className="ti ti-users" style={{ fontSize: 28, color: "var(--border-warm)", display: "block", marginBottom: 10 }} />
                    <p style={{ fontFamily: "var(--font-playfair)", fontSize: 15, color: "var(--panel-dark)", marginBottom: 6 }}>Nenhum utilizador encontrado</p>
                    <p style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300 }}>Experimenta ajustar os filtros ou criar um novo utilizador.</p>
                  </div>
                ) : filtrados.map(u => {
                  const cor = TIPO_CORES[u.tipoUtilizador] ?? TIPO_CORES.ROLE_ALUNO;
                  return (
                    <div key={u.id} onClick={() => setDetalhe(u)}
                      style={{ display: "flex", alignItems: "center", gap: 14, background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 8, padding: "14px 18px", cursor: "pointer", transition: "border-color .15s, box-shadow .15s", animation: "fadeUp .2s ease" }}
                      onMouseEnter={e => { (e.currentTarget).style.borderColor = "rgba(160,133,96,0.45)"; (e.currentTarget).style.boxShadow = "0 2px 12px rgba(44,28,10,0.06)"; }}
                      onMouseLeave={e => { (e.currentTarget).style.borderColor = "var(--border-warm)"; (e.currentTarget).style.boxShadow = "none"; }}>

                      {/* Avatar */}
                      <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontWeight: 400, fontSize: 14, letterSpacing: 1 }}>
                        {initials(u.nome)}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                          <span style={{ fontWeight: 400, fontSize: 14, color: "var(--panel-dark)" }}>{u.nome}</span>
                          <span style={{ background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text, borderRadius: 4, padding: "1px 8px", fontSize: 10, fontWeight: 400, letterSpacing: .5 }}>
                            {TIPO_LABELS[u.tipoUtilizador] ?? u.tipoUtilizador}
                          </span>
                          {!u.ativo && (
                            <span style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.20)", color: "#c0392b", borderRadius: 4, padding: "1px 8px", fontSize: 10 }}>
                              Inativo
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300 }}>{u.email}</span>
                      </div>

                      {/* Data */}
                      <div style={{ fontSize: 11, color: "var(--accent-muted)", flexShrink: 0, fontWeight: 300 }}>
                        {formatDate(u.criadoEm)}
                      </div>

                      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--border-warm)", flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 28 }}>
                <button disabled={paginaAtual === 0} onClick={() => carregar(paginaAtual - 1)}
                  style={{ padding: "6px 14px", border: "1px solid var(--border-warm)", borderRadius: 6, background: "#FFFCF8", color: "var(--panel-dark)", fontSize: 12, cursor: paginaAtual === 0 ? "not-allowed" : "pointer", opacity: paginaAtual === 0 ? .4 : 1, fontFamily: "var(--font-lato)" }}>
                  ← Anterior
                </button>
                <span style={{ fontSize: 11, color: "var(--accent-muted)", fontWeight: 300 }}>
                  Página {paginaAtual + 1} de {totalPaginas}
                </span>
                <button disabled={paginaAtual >= totalPaginas - 1} onClick={() => carregar(paginaAtual + 1)}
                  style={{ padding: "6px 14px", border: "1px solid var(--border-warm)", borderRadius: 6, background: "#FFFCF8", color: "var(--panel-dark)", fontSize: 12, cursor: paginaAtual >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: paginaAtual >= totalPaginas - 1 ? .4 : 1, fontFamily: "var(--font-lato)" }}>
                  Próxima →
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <footer style={{ padding: "12px 24px", borderTop: "1px solid var(--border-warm)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: 12, letterSpacing: 3, color: "var(--accent-muted)", fontWeight: 400 }}>entartes</span>
          <span style={{ fontSize: 10, color: "var(--accent-muted)", fontWeight: 300 }}>© 2026 Entartes — Escola de Dança</span>
        </footer>
      </div>

      {/* ══ POP-UP INTERNO: NOVO UTILIZADOR (IGUAL À ESTRUTURA DO MARKETPLACE) ══ */}
      {modalAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setModalAberto(false)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90dvh", overflowY: "auto", animation: "fadeUp .2s ease", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            
            {/* Barra lateral decorativa coerente com os teus outros pop-ups */}
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "12px 0 0 12px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingLeft: 8 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 18, color: "var(--panel-dark)", fontWeight: 400, margin: 0 }}>Novo Utilizador</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={handleSalvarUtilizador} style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 8 }}>
              
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Nome Completo *</label>
                <input type="text" required name="nome" value={form.nome} onChange={handleInputChange}
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Email *</label>
                <input type="email" required name="email" value={form.email} onChange={handleInputChange}
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Telefone</label>
                  <input type="text" name="telefone" value={form.telefone} onChange={handleInputChange}
                    style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>NIF</label>
                  <input type="text" name="nif" value={form.nif} onChange={handleInputChange}
                    style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Data de Nascimento *</label>
                <input type="date" required name="dataNascimento" value={form.dataNascimento} onChange={handleInputChange}
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Tipo de Utilizador *</label>
                {loadingHashes ? (
                  <div style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300, padding: "8px 0" }}>A validar chaves com o servidor...</div>
                ) : (
                  <select name="id_tipoUtilizador" value={form.id_tipoUtilizador} onChange={handleInputChange}
                    style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none", cursor: "pointer" }}>
                    <option value={hashesDiscobertas.ALUNO}>Aluno</option>
                    <option value={hashesDiscobertas.PROFESSOR}>Professor</option>
                    <option value={hashesDiscobertas.ENCARREGADO}>Encarregado</option>
                  </select>
                )}
              </div>

              <button type="submit" disabled={loadingInserir || loadingHashes}
                style={{ width: "100%", padding: "11px", background: "var(--panel-dark)", border: "none", borderRadius: 6, color: "var(--accent-gold)", fontFamily: "var(--font-lato)", fontSize: 12, fontWeight: 400, letterSpacing: 1, textTransform: "uppercase", cursor: (loadingInserir || loadingHashes) ? "not-allowed" : "pointer", opacity: (loadingInserir || loadingHashes) ? 0.6 : 1, transition: "opacity 0.2s", marginTop: 8 }}>
                {loadingInserir ? "A processar..." : "Criar Conta"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL DETALHE ══ */}
      {detalhe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setDetalhe(null)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90dvh", overflowY: "auto", animation: "fadeUp .2s ease", position: "relative" }}
            onClick={e => e.stopPropagation()}>

            {/* Barra lateral decorativa */}
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "12px 0 0 12px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingLeft: 8 }}>
              <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300 }}>Detalhe do utilizador</p>
              <button onClick={() => setDetalhe(null)} style={{ background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            {/* Avatar + nome */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--border-warm)", paddingLeft: 8 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontWeight: 400, fontSize: 18, letterSpacing: 1, flexShrink: 0 }}>
                {initials(detalhe.nome)}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-playfair)", fontWeight: 400, fontSize: 18, color: "var(--panel-dark)", marginBottom: 4 }}>{detalhe.nome}</div>
                <div style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300, marginBottom: 6 }}>{detalhe.email}</div>
                {(() => { const cor = TIPO_CORES[detalhe.tipoUtilizador] ?? TIPO_CORES.ROLE_ALUNO; return (
                  <span style={{ background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text, borderRadius: 4, padding: "2px 10px", fontSize: 10, fontWeight: 400, letterSpacing: .5 }}>
                    {TIPO_LABELS[detalhe.tipoUtilizador] ?? detalhe.tipoUtilizador}
                  </span>
                ); })()}
              </div>
            </div>

            {/* Campos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, paddingLeft: 8 }}>
              {[
                { label: "Telefone",       value: detalhe.telefone || "—" },
                { label: "NIF",            value: detalhe.nif || "—" },
                { label: "Nascimento",     value: formatDate(detalhe.dataNascimento) },
                { label: "Membro desde",   value: formatDate(detalhe.criadoEm) },
                { label: "Estado",         value: detalhe.ativo ? "✓ Ativo" : "✗ Inativo" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "var(--panel-dark)", fontWeight: 400 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
              <button onClick={() => { setReporTarget(detalhe); setDetalhe(null); }}
                style={{ padding: "10px", borderRadius: 8, background: "rgba(78,114,169,0.08)", border: "1px solid rgba(78,114,169,0.25)", color: "#2D4E7A", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                <i className="ti ti-key" style={{ marginRight: 8 }} />Repor palavra-passe
              </button>
              <button onClick={() => toggleAtivo(detalhe)}
                style={{ padding: "10px", borderRadius: 8, background: "#FFFCF8", border: "1px solid var(--border-warm)", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                <i className={`ti ${detalhe.ativo ? "ti-user-off" : "ti-user-check"}`} style={{ marginRight: 8 }} />
                {detalhe.ativo ? "Desativar conta" : "Ativar conta"}
              </button>
              <button onClick={() => apagar(detalhe)}
                style={{ padding: "10px", borderRadius: 8, background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.20)", color: "#c0392b", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                <i className="ti ti-trash" style={{ marginRight: 8 }} />Apagar utilizador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL REPOR PASSWORD ══ */}
      {reporTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setReporTarget(null)}>
          <form style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400, animation: "fadeUp .2s ease", position: "relative" }}
            onSubmit={reporPassword} onClick={e => e.stopPropagation()}>

            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "12px 0 0 12px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingLeft: 8 }}>
              <p style={{ fontFamily: "var(--font-playfair)", fontSize: 17, color: "var(--panel-dark)", fontWeight: 400 }}>Repor palavra-passe</p>
              <button type="button" onClick={() => setReporTarget(null)} style={{ background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            <p style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300, marginBottom: 20, paddingLeft: 8 }}>
              A alterar a credencial de <strong>{reporTarget.nome}</strong>.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 8, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Nova palavra-passe</label>
                <input type="password" required value={novaPass} onChange={e => setNovaPass(e.target.value)}
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Confirmar nova palavra-passe</label>
                <input type="password" required value={confirmarPass} onChange={e => setConfirmarPass(e.target.value)}
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, outline: "none" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingLeft: 8 }}>
              <button type="button" onClick={() => setReporTarget(null)}
                style={{ padding: "8px 16px", border: "1px solid var(--border-warm)", borderRadius: 6, background: "transparent", color: "var(--panel-dark)", fontSize: 12, cursor: "pointer", fontFamily: "var(--font-lato)" }}>
                Cancelar
              </button>
              <button type="submit" disabled={loadingRepor}
                style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "var(--panel-dark)", color: "var(--accent-gold)", fontSize: 12, cursor: loadingRepor ? "not-allowed" : "pointer", opacity: loadingRepor ? 0.6 : 1, fontFamily: "var(--font-lato)" }}>
                {loadingRepor ? "A guardar..." : "Alterar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}