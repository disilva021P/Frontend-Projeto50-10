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

  valorHora?: number;
  professorExterno?: boolean;
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
  ROLE_COORDENACAO: { bg: "rgba(44,28,10,0.08)",    text: "#402F1D", border: "rgba(44,28,10,0.20)"   },
};

const TIPOS_CRIAR = ["ALUNO", "PROFESSOR", "ENCARREGADO"];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function UtilizadoresPage() {
  const router = useRouter();

  // Lista
  const [utilizadores, setUtilizadores] = useState<UtilizadorResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [totalElementos, setTotalElementos] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [search, setSearch] = useState("");

  // Modal detalhe e edição
  const [detalhe, setDetalhe] = useState<UtilizadorResponseDto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UtilizadorResponseDto>>({});

  // Modal repor password
  const [reporTarget, setReporTarget] = useState<UtilizadorResponseDto | null>(null);
  const [novaPass, setNovaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [loadingRepor, setLoadingRepor] = useState(false);

  // Estados do Modal Criar
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
    valorHora: "36",
    professorExterno: false,
  });

  // Feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Inicialização ──
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const { role } = getUserData();
    if (role !== "COORDENACAO") { router.push("/landingPage"); }
  }, [router]);

  // ── Carregar as hashes de funções para o formulário ──
  const carregarHashesOficiais = async () => {
    try {
      setLoadingHashes(true);
      const res = await fetch(`${BASE_URL}/api/utilizadores/tipos-hashes`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHashesDiscobertas(data);
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

  // Controla a mudança do checkbox e aplica a regra do valorHora padrão (36) se for interno
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm(prev => ({ 
      ...prev, 
      [name]: checked,
      valorHora: checked ? prev.valorHora : "36"
    }));
  };

  // ── Guardar Utilizador Criado ──
  const handleSalvarUtilizador = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.nome || !form.email || !form.id_tipoUtilizador || !form.dataNascimento) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setLoadingInserir(true);
    try {
      const payload = {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        nif: form.nif,
        dataNascimento: form.dataNascimento,
        id_tipoUtilizador: form.id_tipoUtilizador,
        valorHora: form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR ? parseFloat(form.valorHora || "36") : null,
        professorExterno: form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR ? form.professorExterno : false,
      };

      const res = await fetch(`${BASE_URL}/api/utilizadores`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const erroDados = await res.json().catch(() => ({}));
        throw new Error(erroDados.message || "Erro ao criar utilizador.");
      }

      setSuccessMsg("Utilizador criado com sucesso!");
      setModalAberto(false);
      
      setForm({
        nome: "",
        email: "",
        telefone: "",
        nif: "",
        dataNascimento: "",
        id_tipoUtilizador: hashesDiscobertas.ALUNO || "",
        valorHora: "36",
        professorExterno: false,
      });

      carregar(0);
    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro ao guardar o utilizador.");
    } finally {
      setLoadingInserir(false);
    }
  };

  // ── Enviar Atualização de Edição para o Servidor ──
  const handleAtualizarUtilizador = async () => {
    if (!editForm.id) return;
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${editForm.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error("Erro ao atualizar utilizador.");

      setSuccessMsg("Utilizador atualizado com sucesso!");
      setIsEditing(false);
      setDetalhe({ ...detalhe, ...editForm } as UtilizadorResponseDto);
      carregar(paginaAtual);
    } catch (err: any) {
      setErrorMsg(err.message || "Não foi possível guardar as alterações.");
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

  // ── Apagar Permanente (Hard Delete) ──
  async function eliminarPermanente(u: UtilizadorResponseDto) {
    if (!confirm(`⚠️ ATENÇÃO: Tens a certeza que queres ELIMINAR PERMANENTEMENTE o utilizador ${u.nome}? Esta ação é irreversível!`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/eliminaPermanente/${u.id}`, {
        method: "DELETE", 
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      
      setSuccessMsg(`${u.nome} foi completamente eliminado do sistema.`);
      setDetalhe(null); 
      carregar(paginaAtual); 
    } catch { 
      setErrorMsg("Erro ao eliminar permanentemente o utilizador."); 
    }
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

  const filtrados = utilizadores.filter(u =>
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: "transparent", fontFamily: "var(--font-lato)" }}>

        {/* Notificações de Feedback */}
        {(successMsg || errorMsg) && (
          <div style={{ position: "fixed", top: 68, right: 24, zIndex: 110, animation: "fadeUp 0.2s ease", maxWidth: 320, padding: "12px 16px", borderRadius: 6, fontSize: 13, border: "1px solid", background: successMsg ? "#f0fdf4" : "#fef2f2", color: successMsg ? "#15803d" : "#991b1b", borderColor: successMsg ? "#bbf7d0" : "#fecaca", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            {successMsg || errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flex: 1, position: "relative" }}>

          {/* ── CONTEÚDO PRINCIPAL (Sem <nav>, <aside> ou <footer> globais) ── */}
          <main style={{ flex: 1, padding: "12px 0 40px" }}>

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

            {/* Lista de Utilizadores */}
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
                    <div key={u.id} onClick={() => { setDetalhe(u); setIsEditing(false); }}
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
      </div>

      {/* ══ POP-UP INTERNO: DETALHE / EDIÇÃO DO UTILIZADOR ══ */}
      {detalhe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setDetalhe(null)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 460, animation: "fadeUp .2s ease", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            
            <button onClick={() => setDetalhe(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontSize: 18 }}>
                {initials(detalhe.nome)}
              </div>
              <div>
                {isEditing ? (
                  <input type="text" value={editForm.nome || ""} onChange={e => setEditForm({ ...editForm, nome: e.target.value })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 16, fontFamily: "var(--font-playfair)", color: "var(--panel-dark)", width: "100%" }} />
                ) : (
                  <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 20, color: "var(--panel-dark)", margin: 0, fontWeight: 400 }}>{detalhe.nome}</h2>
                )}
                <p style={{ fontSize: 12, color: "var(--accent-muted)", margin: "2px 0 6px" }}>{detalhe.email}</p>
                <span style={{ background: "rgba(44,28,10,0.06)", border: "1px solid rgba(44,28,10,0.15)", borderRadius: 4, padding: "2px 8px", fontSize: 10, textTransform: "uppercase" }}>
                  {TIPO_LABELS[detalhe.tipoUtilizador] ?? detalhe.tipoUtilizador}
                </span>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid var(--border-warm)", marginBottom: 20 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Telefone</span>
                {isEditing ? (
                  <input type="text" value={editForm.telefone || ""} onChange={e => setEditForm({ ...editForm, telefone: e.target.value })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: "100%" }} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{detalhe.telefone || "—"}</span>
                )}
              </div>
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>NIF</span>
                {isEditing ? (
                  <input type="text" value={editForm.nif || ""} onChange={e => setEditForm({ ...editForm, nif: e.target.value })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: "100%" }} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{detalhe.nif || "—"}</span>
                )}
              </div>
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Nascimento</span>
                <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{formatDate(detalhe.dataNascimento)}</span>
              </div>
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Membro desde</span>
                <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{formatDate(detalhe.criadoEm)}</span>
              </div>

              {/* Extras condicionados para Professores */}
              {(detalhe.tipoUtilizador === "PROFESSOR" || detalhe.tipoUtilizador === "ROLE_PROFESSOR") && isEditing && (
                <>
                  <div>
                    <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Valor por Hora</span>
                    <input 
                      type="number" 
                      value={editForm.valorHora !== undefined ? editForm.valorHora : ""} 
                      onChange={e => setEditForm({ ...editForm, valorHora: parseFloat(e.target.value) || 0 })}
                      style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: "100%" }} 
                    />
                  </div>

                  <div>
                    <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Regime</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, height: "30px" }}>
                      <input 
                        type="checkbox" 
                        id="editExterno" 
                        checked={editForm.professorExterno === true || String(editForm.professorExterno) === "true"} 
                        onChange={e => {
                          const valorMarcado = e.target.checked;
                          setEditForm(prev => ({ ...prev, professorExterno: valorMarcado }));
                        }} 
                        style={{ cursor: "pointer" }} 
                      />
                      <label htmlFor="editExterno" style={{ fontSize: 12, color: "var(--panel-dark)", cursor: "pointer" }}>Externo</label>
                    </div>
                  </div>
                </>
              )}

              <div style={{ gridColumn: "span 2" }}>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Estado</span>
                <span style={{ fontSize: 13, color: detalhe.ativo ? "#27ae60" : "#c0392b", fontWeight: 500 }}>
                  {detalhe.ativo ? "✓ Ativo" : "✕ Inativo"}
                </span>
              </div>
            </div>

            {/* Ações Verticais */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 0 }}>
              {!isEditing ? (
                <>
                  <button onClick={() => { setReporTarget(detalhe); setDetalhe(null); }}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(78,114,169,0.08)", border: "1px solid rgba(78,114,169,0.25)", color: "#2D4E7A", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                    <i className="ti ti-key" style={{ marginRight: 8 }} />Repor palavra-passe
                  </button>

                  <button onClick={() => { 
                    setIsEditing(true); 
                    const isExterno = detalhe?.professorExterno === true || 
                                      String(detalhe?.professorExterno) === "true" || 
                                      (detalhe?.valorHora !== undefined && detalhe?.valorHora !== 36);

                    setEditForm({
                      ...detalhe,
                      valorHora: detalhe?.valorHora ?? 36,
                      professorExterno: isExterno
                    }); 
                  }}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)", color: "#e67e22", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                    <i className="ti ti-edit" style={{ marginRight: 8 }} />Editar dados
                  </button>

                  <button onClick={() => toggleAtivo(detalhe)}
                    style={{ padding: "10px", borderRadius: 8, background: "#FFFCF8", border: "1px solid var(--border-warm)", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                    <i className={`ti ${detalhe.ativo ? "ti-user-off" : "ti-user-check"}`} style={{ marginRight: 8 }} />
                    {detalhe.ativo ? "Desativar conta" : "Ativar conta"}
                  </button>

                  <button onClick={() => eliminarPermanente(detalhe)}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.20)", color: "#c0392b", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                    <i className="ti ti-trash" style={{ marginRight: 8 }} />Apagar utilizador
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleAtualizarUtilizador}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(46,204,113,0.15)", border: "1px solid #2ecc71", color: "#27ae60", fontFamily: "var(--font-lato)", fontSize: 12, fontWeight: "bold", cursor: "pointer", letterSpacing: .5 }}>
                    <i className="ti ti-device-floppy" style={{ marginRight: 8 }} />Guardar Alterações
                  </button>

                  <button onClick={() => setIsEditing(false)}
                    style={{ padding: "10px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #ccc", color: "#666", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ POP-UP INTERNO: NOVO UTILIZADOR ══ */}
      {modalAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setModalAberto(false)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90dvh", overflowY: "auto", animation: "fadeUp .2s ease", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "12px 0 0 12px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingLeft: 8 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 18, color: "var(--panel-dark)", fontWeight: 400, margin: 0 }}>Novo Utilizador</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={handleSalvarUtilizador} style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 8 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 400, marginBottom: 4 }}>Nome Completo *</label>
                <input type="text" name="nome" value={form.nome} onChange={handleInputChange} required style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFF" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 400, marginBottom: 4 }}>Email Institucional *</label>
                <input type="email" name="email" value={form.email} onChange={handleInputChange} required style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFF" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 400, marginBottom: 4 }}>Telefone</label>
                  <input type="text" name="telefone" value={form.telefone} onChange={handleInputChange} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFF" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 400, marginBottom: 4 }}>NIF</label>
                  <input type="text" name="nif" value={form.nif} onChange={handleInputChange} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFF" }} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 400, marginBottom: 4 }}>Data de Nascimento *</label>
                <input type="date" name="dataNascimento" value={form.dataNascimento} onChange={handleInputChange} required style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFF" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 400, marginBottom: 4 }}>Tipo de Utilizador *</label>
                <select name="id_tipoUtilizador" value={form.id_tipoUtilizador} onChange={handleInputChange} required style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFF", cursor: "pointer" }}>
                  {loadingHashes ? (
                    <option>A carregar funções…</option>
                  ) : (
                    TIPOS_CRIAR.map(t => <option key={t} value={hashesDiscobertas[t]}>{TIPO_LABELS[t]}</option>)
                  )}
                </select>
              </div>

              {/* Campos extras condicionados para Professores */}
              {form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR && hashesDiscobertas.PROFESSOR !== "" && (
                <div style={{ padding: "12px", borderRadius: 6, background: "rgba(160,133,96,0.06)", border: "1px solid rgba(160,133,96,0.2)", display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp .15s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <input type="checkbox" id="professorExterno" name="professorExterno" checked={form.professorExterno} onChange={handleCheckboxChange} style={{ cursor: "pointer" }} />
                    <label htmlFor="professorExterno" style={{ fontSize: 12, color: "var(--panel-dark)", cursor: "pointer", fontWeight: 500 }}>Este professor é externo</label>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#7A5020", fontWeight: 400, marginBottom: 4 }}>Valor por Hora (€)</label>
                    <input type="number" name="valorHora" value={form.valorHora} onChange={handleInputChange} disabled={!form.professorExterno} placeholder="36" style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: form.professorExterno ? "#FFF" : "#f5f5f5", color: form.professorExterno ? "var(--panel-dark)" : "#888", cursor: form.professorExterno ? "text" : "not-allowed" }} />
                    {!form.professorExterno && (
                      <span style={{ fontSize: 11, color: "var(--accent-muted)", marginTop: 4, display: "block" }}>Professores internos usam o valor padrão de 36€.</span>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" disabled={loadingInserir} style={{ width: "100%", padding: "12px", background: "var(--panel-dark)", color: "var(--accent-gold)", border: "none", borderRadius: 6, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: loadingInserir ? "not-allowed" : "pointer", marginTop: 8 }}>
                {loadingInserir ? "A guardar…" : "Criar Conta"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Repor Password */}
      {reporTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={() => setReporTarget(null)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: 18, margin: "0 0 16px" }}>Repor Password para {reporTarget.nome}</h3>
            <form onSubmit={reporPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="password" placeholder="Nova Password" value={novaPass} onChange={e => setNovaPass(e.target.value)} required style={{ padding: 10, borderRadius: 6, border: "1px solid var(--border-warm)" }} />
              <input type="password" placeholder="Confirmar Password" value={confirmarPass} onChange={e => setConfirmarPass(e.target.value)} required style={{ padding: 10, borderRadius: 6, border: "1px solid var(--border-warm)" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setReporTarget(null)} style={{ padding: "8px 16px", background: "none", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" }}>Cancelar</button>
                <button type="submit" disabled={loadingRepor} style={{ padding: "8px 16px", background: "var(--panel-dark)", color: "var(--accent-gold)", border: "none", borderRadius: 6, cursor: "pointer" }}>{loadingRepor ? "A gravar…" : "Gravar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}