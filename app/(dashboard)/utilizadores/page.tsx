"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface TurmaDto { id: string; nome: string; modalidadeNome?: string; }
interface ModalidadeDto { id: string; nome: string; descricao?: string; }
interface UtilizadorResponseDto {
  id: string; nome: string; email: string; nif: string; telefone: string;
  tipoUtilizador: string; ativo: boolean; dataNascimento: string; criadoEm: string;
  valorHora?: number; professorExterno?: boolean;
  turmas?: TurmaDto[]; modalidades?: ModalidadeDto[];
}
interface PageResponse {
  content: UtilizadorResponseDto[]; totalPages: number; number: number; totalElements: number;
}

const BASE_URL = "http://localhost:8080";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }
function getUserData(): { nome: string; role: Role | null } {
  if (typeof window === "undefined") return { nome: "", role: null };
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return { nome: "", role: null };
    const u = JSON.parse(raw);
    return { nome: u.nome ?? "", role: (u.tipoUtilizadorId as Role) ?? null };
  } catch { return { nome: "", role: null }; }
}
function initials(name: string = "") { return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join(""); }
function formatDate(dt: string | null) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

const TIPO_LABELS: Record<string, string> = {
  ALUNO: "Aluno", PROFESSOR: "Professor", ENCARREGADO: "Encarregado", COORDENACAO: "Coordenação",
  ROLE_ALUNO: "Aluno", ROLE_PROFESSOR: "Professor", ROLE_ENCARREGADO: "Encarregado", ROLE_COORDENACAO: "Coordenação",
};
const TIPO_CORES: Record<string, { bg: string; text: string; border: string }> = {
  ROLE_ALUNO:       { bg: "rgba(78,114,169,0.10)",  text: "#2D4E7A", border: "rgba(78,114,169,0.25)" },
  ROLE_PROFESSOR:   { bg: "rgba(160,133,96,0.12)",  text: "#7A5020", border: "rgba(160,133,96,0.30)" },
  ROLE_ENCARREGADO: { bg: "rgba(74,143,89,0.10)",   text: "#2D6A3F", border: "rgba(74,143,89,0.25)"  },
  ROLE_COORDENACAO: { bg: "rgba(44,28,10,0.08)",    text: "#402F1D", border: "rgba(44,28,10,0.20)"   },
};
const TIPOS_CRIAR = ["ALUNO", "PROFESSOR", "ENCARREGADO"];

export default function UtilizadoresPage() {
  const router = useRouter();

  const [utilizadores, setUtilizadores] = useState<UtilizadorResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [totalElementos, setTotalElementos] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [search, setSearch] = useState("");
  const [detalhe, setDetalhe] = useState<UtilizadorResponseDto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UtilizadorResponseDto> & {
  idTurmasIniciais?: string[];
  modalidadesIds?: string[];
}>({});
  const [reporTarget, setReporTarget] = useState<UtilizadorResponseDto | null>(null);
  const [novaPass, setNovaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [loadingRepor, setLoadingRepor] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingInserir, setLoadingInserir] = useState(false);
  const [loadingHashes, setLoadingHashes] = useState(true);
  const [turmas, setTurmas] = useState<TurmaDto[]>([]);
  const [modalidadesSistema, setModalidadesSistema] = useState<ModalidadeDto[]>([]);
  const [hashesDiscobertas, setHashesDiscobertas] = useState<Record<string, string>>({ ALUNO: "", PROFESSOR: "", ENCARREGADO: "" });
  const [form, setForm] = useState<{
    nome: string; email: string; telefone: string; nif: string; dataNascimento: string;
    id_tipoUtilizador: string; valorHora: string; professorExterno: boolean;
    idTurmasIniciais: string[]; modalidadesIds: string[];
  }>({ nome: "", email: "", telefone: "", nif: "", dataNascimento: "", id_tipoUtilizador: "", valorHora: "36", professorExterno: false, idTurmasIniciais: [], modalidadesIds: [] });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const { role } = getUserData();
    if (role !== "COORDENACAO") { router.push("/landingPage"); }
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setDetalhe(null); setModalAberto(false); setReporTarget(null); } };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [router]);

  const carregarDadosConfiguracao = async () => {
    try {
      setLoadingHashes(true);
      const resHashes = await fetch(`${BASE_URL}/api/utilizadores/tipos-hashes`, { headers: authHeaders() });
      if (resHashes.ok) {
        const data = await resHashes.json();
        setHashesDiscobertas(data);
        if (data.ALUNO) setForm(prev => ({ ...prev, id_tipoUtilizador: data.ALUNO }));
      }
      const resTurmas = await fetch(`${BASE_URL}/api/turmas`, { headers: authHeaders() });
      if (resTurmas.ok) setTurmas(await resTurmas.json());
      const resMod = await fetch(`${BASE_URL}/api/modalidades`, { headers: authHeaders() });
      if (resMod.ok) {
        const dataMod = await resMod.json();
        setModalidadesSistema(dataMod.content || dataMod || []);
      }
    } catch (err) { console.error("Erro ao carregar configurações:", err); }
    finally { setLoadingHashes(false); }
  };

  useEffect(() => { carregarDadosConfiguracao(); }, []);

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
    } catch { setErrorMsg("Erro ao carregar utilizadores."); }
    finally { setLoading(false); }
  }, [filtroTipo]);

  useEffect(() => { carregar(0); }, [carregar]);

  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: checked, valorHora: checked ? prev.valorHora : "36" }));
  };

  const handleTurmaCheckboxChange = (turmaId: string) => {
    setForm(prev => {
      const jaSelecionada = prev.idTurmasIniciais.includes(turmaId);
      return { ...prev, idTurmasIniciais: jaSelecionada ? prev.idTurmasIniciais.filter(id => id !== turmaId) : [...prev.idTurmasIniciais, turmaId] };
    });
  };

  const handleSalvarUtilizador = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.nome || !form.email || !form.id_tipoUtilizador || !form.dataNascimento) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios."); return;
    }
    if (form.id_tipoUtilizador === hashesDiscobertas.ALUNO && form.idTurmasIniciais.length === 0) {
      setErrorMsg("Por favor, selecione pelo menos uma turma para o aluno."); return;
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
        valorHora: form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR
          ? parseFloat(form.valorHora || "36")
          : null,
        professorExterno: form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR
          ? form.professorExterno
          : false,
        idTurmasIniciais: form.id_tipoUtilizador === hashesDiscobertas.ALUNO
          ? form.idTurmasIniciais
          : [],
        // ✅ Adicionar esta linha:
        modalidadesIds: form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR
          ? form.modalidadesIds
          : [],
      };
      const res = await fetch(`${BASE_URL}/api/utilizadores`, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) {
        const erroDados = await res.json().catch(() => ({}));
        throw new Error(erroDados.message || "Erro ao criar utilizador.");
      }
      setSuccessMsg("Utilizador criado com sucesso!");
      setModalAberto(false);
      setForm({ nome: "", email: "", telefone: "", nif: "", dataNascimento: "", id_tipoUtilizador: hashesDiscobertas.ALUNO || "", valorHora: "36", professorExterno: false, idTurmasIniciais: [], modalidadesIds: [] });
      carregar(0);
    } catch (err: any) { setErrorMsg(err.message || "Ocorreu um erro ao guardar o utilizador."); }
    finally { setLoadingInserir(false); }
  };

  const handleGuardarUtilizador = async () => {
    if (!editForm.id) return;
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${editForm.id}/editar`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Erro ao atualizar utilizador.");
      setSuccessMsg("Utilizador atualizado com sucesso!");
      setIsEditing(false);
      setDetalhe({ ...detalhe, ...editForm } as UtilizadorResponseDto);
      carregar(paginaAtual);
    } catch (err: any) { setErrorMsg(err.message || "Não foi possível guardar as alterações."); }
  };

  async function toggleAtivo(u: UtilizadorResponseDto) {
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${u.id}/toggle-ativo`, { method: "PATCH", headers: authHeaders() });
      if (!res.ok) throw new Error();
      setSuccessMsg(`${u.nome} foi ${u.ativo ? "desativado" : "ativado"}.`);
      setDetalhe(prev => prev?.id === u.id ? { ...prev, ativo: !prev.ativo } : prev);
      carregar(paginaAtual);
    } catch { setErrorMsg("Erro ao alterar estado."); }
  }

  async function eliminarPermanente(u: UtilizadorResponseDto) {
    if (!confirm(`⚠️ Tens a certeza que queres eliminar permanentemente ${u.nome}? Esta ação é irreversível!`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/eliminaPermanente/${u.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error();
      setSuccessMsg(`${u.nome} foi completamente eliminado.`);
      setDetalhe(null);
      carregar(paginaAtual);
    } catch { setErrorMsg("Erro ao eliminar utilizador."); }
  }

  async function reporPassword(e: React.FormEvent) {
    e.preventDefault();
    if (novaPass !== confirmarPass) { setErrorMsg("As passwords não coincidem."); return; }
    if (!reporTarget) return;
    setLoadingRepor(true);
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${reporTarget.id}/repor-password`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ novaPassword: novaPass, confirmarNovaPassword: confirmarPass }),
      });
      if (!res.ok) throw new Error();
      setSuccessMsg(`Password de ${reporTarget.nome} reposta com sucesso!`);
      setReporTarget(null); setNovaPass(""); setConfirmarPass("");
    } catch { setErrorMsg("Erro ao repor password."); }
    finally { setLoadingRepor(false); }
  }

  const filtrados = utilizadores.filter(u => u.nome?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--background)", fontFamily: "var(--font-lato)" }}>

        {/* Toasts */}
        {(successMsg || errorMsg) && (
          <div style={{ position: "fixed", top: 24, right: 24, zIndex: 110, animation: "fadeUp 0.2s ease", maxWidth: 320, padding: "12px 16px", borderRadius: 6, fontSize: 13, border: "1px solid", background: successMsg ? "#f0fdf4" : "#fef2f2", color: successMsg ? "#15803d" : "#991b1b", borderColor: successMsg ? "#bbf7d0" : "#fecaca" }}>
            {successMsg || errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flex: 1, position: "relative", overflow: "hidden" }}>
          
          {/* ── CONTEÚDO PRINCIPAL ── */}
          <main style={{ flex: 1, overflowY: "auto", padding: "28px 28px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Coordenação</p>
                <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 26, color: "var(--panel-dark)", fontWeight: 400 }}>Utilizadores</h1>
                <p style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300, marginTop: 4 }}>{totalElementos} utilizadores registados</p>
              </div>
              <button onClick={() => setModalAberto(true)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--panel-dark)", border: "none", borderRadius: 6, color: "var(--accent-gold)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                <i className="ti ti-user-plus" style={{ fontSize: 15 }} /> Novo utilizador
              </button>
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--accent-muted)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por nome ou email…"
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px 9px 36px", fontSize: 13, color: "var(--panel-dark)", outline: "none" }} />
              </div>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                style={{ background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", fontSize: 13, minWidth: 180, cursor: "pointer", color: "var(--panel-dark)", outline: "none" }}>
                <option value="">Todos os tipos</option>
                {TIPOS_CRIAR.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>

            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--border-warm)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}

            {!loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtrados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 24px", border: "1px dashed var(--border-warm)", borderRadius: 8 }}>
                    <p style={{ fontFamily: "var(--font-playfair)", fontSize: 15, color: "var(--panel-dark)" }}>Nenhum utilizador encontrado</p>
                  </div>
                ) : filtrados.map(u => {
                  const cor = TIPO_CORES[u.tipoUtilizador] ?? TIPO_CORES.ROLE_ALUNO;
                  return (
                    <div key={u.id} onClick={() => { setDetalhe(u); setIsEditing(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 14, background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 8, padding: "14px 18px", cursor: "pointer", transition: "border-color .15s" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(160,133,96,0.45)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-warm)")}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontSize: 14 }}>
                        {initials(u.nome)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 14, color: "var(--panel-dark)" }}>{u.nome}</span>
                          <span style={{ background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text, borderRadius: 4, padding: "1px 8px", fontSize: 10 }}>
                            {TIPO_LABELS[u.tipoUtilizador] ?? u.tipoUtilizador}
                          </span>
                          {!u.ativo && <span style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.20)", color: "#c0392b", borderRadius: 4, padding: "1px 8px", fontSize: 10 }}>Inativo</span>}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--accent-muted)" }}>{u.email}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--accent-muted)", flexShrink: 0 }}>{formatDate(u.criadoEm)}</span>
                      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--border-warm)" }} />
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && totalPaginas > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                <span style={{ fontSize: 12, color: "var(--accent-muted)" }}>Página <strong>{paginaAtual + 1}</strong> de {totalPaginas}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button disabled={paginaAtual === 0} onClick={() => carregar(paginaAtual - 1)}
                    style={{ padding: "6px 12px", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 4, fontSize: 12, cursor: paginaAtual === 0 ? "not-allowed" : "pointer", opacity: paginaAtual === 0 ? .5 : 1 }}>
                    Anterior
                  </button>
                  <button disabled={paginaAtual >= totalPaginas - 1} onClick={() => carregar(paginaAtual + 1)}
                    style={{ padding: "6px 12px", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 4, fontSize: 12, cursor: paginaAtual >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: paginaAtual >= totalPaginas - 1 ? .5 : 1 }}>
                    Seguinte
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

        <footer style={{ padding: "12px 24px", borderTop: "1px solid var(--border-warm)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: 12, letterSpacing: 3, color: "var(--accent-muted)" }}>entartes</span>
          <span style={{ fontSize: 10, color: "var(--accent-muted)", fontWeight: 300 }}>© 2026 Entartes — Escola de Dança</span>
        </footer>
      </div>

      {/* ══ MODAL DETALHE ══ */}
      {detalhe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setDetalhe(null)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 460, maxHeight: "90dvh", overflowY: "auto", position: "relative" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "12px 0 0 12px" }} />
            <button onClick={() => setDetalhe(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, paddingLeft: 8 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontSize: 18 }}>
                {initials(detalhe.nome)}
              </div>
              <div style={{ flex: 1 }}>
                {isEditing ? (
                  <input type="text" value={editForm.nome || ""} onChange={e => setEditForm({ ...editForm, nome: e.target.value })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 16, fontFamily: "var(--font-playfair)", width: "100%" }} />
                ) : (
                  <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 20, color: "var(--panel-dark)", margin: 0, fontWeight: 400 }}>{detalhe.nome}</h2>
                )}
                <p style={{ fontSize: 12, color: "var(--accent-muted)", margin: "2px 0 6px" }}>{detalhe.email}</p>
                <span style={{ background: "rgba(44,28,10,0.06)", border: "1px solid rgba(44,28,10,0.15)", borderRadius: 4, padding: "2px 8px", fontSize: 10, textTransform: "uppercase" }}>
                  {TIPO_LABELS[detalhe.tipoUtilizador] ?? detalhe.tipoUtilizador}
                </span>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid var(--border-warm)", margin: "0 0 20px 8px" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, paddingLeft: 8 }}>
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
              
              {/* 🏛️ DATA DE NASCIMENTO CORRIGIDA (AGORA EDITÁVEL) */}
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Nascimento</span>
                {isEditing ? (
                  <input type="date" value={editForm.dataNascimento ? editForm.dataNascimento.split("T")[0] : ""} 
                    onChange={e => setEditForm({ ...editForm, dataNascimento: e.target.value })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: "100%" }} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{formatDate(detalhe.dataNascimento)}</span>
                )}
              </div>

              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Membro desde</span>
                <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{formatDate(detalhe.criadoEm)}</span>
              </div>
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Estado</span>
                <span style={{ fontSize: 13, color: detalhe.ativo ? "#27ae60" : "#c0392b", fontWeight: 500 }}>
                  {detalhe.ativo ? "✓ Ativo" : "✕ Inativo"}
                </span>
              </div>
            </div>

            {/* 🎒 TURMAS (ALUNO) CORRIGIDO PARA EDIÇÃO */}
            {(detalhe.tipoUtilizador === "ROLE_ALUNO" || detalhe.tipoUtilizador === "ALUNO") && (
              <div style={{ paddingLeft: 8, marginBottom: 16 }}>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 6 }}>Turmas Inscritas</span>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto", background: "#fff", padding: 8, borderRadius: 6, border: "1px solid var(--border-warm)" }}>
                    {turmas.map(t => {
                      const idTurmasIniciais = (editForm as any).idTurmasIniciais || [];
                      const checked = idTurmasIniciais.includes(t.id);
                      return (
                        <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const novasTurmas = checked ? idTurmasIniciais.filter((id: string) => id !== t.id) : [...idTurmasIniciais, t.id];
                            setEditForm({ ...editForm, idTurmasIniciais: novasTurmas } as any);
                          }} />
                          {t.nome}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {detalhe.turmas && detalhe.turmas.length > 0 ? detalhe.turmas.map(t => (
                      <span key={t.id} style={{ fontSize: 12, padding: "3px 8px", background: "rgba(78,114,169,0.08)", color: "#2D4E7A", borderRadius: 4, border: "1px solid rgba(78,114,169,0.18)" }}>
                        {t.nome}
                      </span>
                    )) : (
                      <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>Nenhuma turma inscrita</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 🩰 MODALIDADES (PROFESSOR) CORRIGIDO PARA EDIÇÃO */}
            {(detalhe.tipoUtilizador === "ROLE_PROFESSOR" || detalhe.tipoUtilizador === "PROFESSOR") && (
              <div style={{ paddingLeft: 8, marginBottom: 16 }}>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 6 }}>Modalidades Habilitadas</span>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto", background: "#fff", padding: 8, borderRadius: 6, border: "1px solid var(--border-warm)" }}>
                    {modalidadesSistema.map(m => {
                      const modalidadesIds = (editForm as any).modalidadesIds || [];
                      const checked = modalidadesIds.includes(m.id);
                      return (
                        <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const novasMod = checked ? modalidadesIds.filter((id: string) => id !== m.id) : [...modalidadesIds, m.id];
                            setEditForm({ ...editForm, modalidadesIds: novasMod } as any);
                          }} />
                          {m.nome}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {detalhe.modalidades && detalhe.modalidades.length > 0 ? detalhe.modalidades.map(m => (
                      <span key={m.id} style={{ fontSize: 12, padding: "3px 8px", background: "rgba(160,133,96,0.10)", color: "#7A5020", borderRadius: 4, border: "1px solid rgba(160,133,96,0.20)" }}>
                        {m.nome}
                      </span>
                    )) : (
                      <span style={{ fontSize: 12, color: "var(--accent-muted)" }}>Nenhuma modalidade associada</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Campos edição valores professor */}
            {(detalhe.tipoUtilizador === "ROLE_PROFESSOR" || detalhe.tipoUtilizador === "PROFESSOR") && isEditing && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingLeft: 8, marginBottom: 16 }}>
                <div>
                  <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Valor por Hora</span>
                  <input type="number" value={editForm.valorHora ?? ""}
                    onChange={e => setEditForm({ ...editForm, valorHora: parseFloat(e.target.value) || 0 })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: "100%" }} />
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Regime</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, height: 30 }}>
                    <input type="checkbox" id="editExterno" checked={editForm.professorExterno === true}
                      onChange={e => setEditForm(prev => ({ ...prev, professorExterno: e.target.checked }))} />
                    <label htmlFor="editExterno" style={{ fontSize: 12, cursor: "pointer" }}>Externo</label>
                  </div>
                </div>
              </div>
            )}

            {/* Botões de Ações */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
              {!isEditing ? (
                <>
                  <button onClick={() => { setReporTarget(detalhe); setDetalhe(null); }}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(78,114,169,0.08)", border: "1px solid rgba(78,114,169,0.25)", color: "#2D4E7A", fontSize: 12, cursor: "pointer" }}>
                    <i className="ti ti-key" style={{ marginRight: 8 }} />Repor palavra-passe
                  </button>
                  <button onClick={() => { 
                    console.log("=== DADOS DO UTILIZADOR SELECIONADO ===", detalhe);
                    setIsEditing(true); 
                    // Mapeamos os objetos atuais para os arrays de IDs de Strings esperados pelo DTO de edição
                    setEditForm({ 
                      ...detalhe,
                      idTurmasIniciais: detalhe.turmas ? detalhe.turmas.map(t => t.id) : [],
                      modalidadesIds: detalhe.modalidades ? detalhe.modalidades.map(m => m.id) : []
                    }); 
                  }}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)", color: "#e67e22", fontSize: 12, cursor: "pointer" }}>
                    <i className="ti ti-edit" style={{ marginRight: 8 }} />Editar dados
                  </button>
                  <button onClick={() => toggleAtivo(detalhe)}
                    style={{ padding: "10px", borderRadius: 8, background: "#FFFCF8", border: "1px solid var(--border-warm)", fontSize: 12, cursor: "pointer" }}>
                    <i className={`ti ${detalhe.ativo ? "ti-user-off" : "ti-user-check"}`} style={{ marginRight: 8 }} />
                    {detalhe.ativo ? "Desativar conta" : "Ativar conta"}
                  </button>
                  <button onClick={() => eliminarPermanente(detalhe)}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.20)", color: "#c0392b", fontSize: 12, cursor: "pointer" }}>
                    <i className="ti ti-trash" style={{ marginRight: 8 }} />Apagar utilizador
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleGuardarUtilizador}
                    style={{ padding: "10px", borderRadius: 8, background: "rgba(46,204,113,0.15)", border: "1px solid #2ecc71", color: "#27ae60", fontSize: 12, fontWeight: "bold", cursor: "pointer" }}>
                    <i className="ti ti-device-floppy" style={{ marginRight: 8 }} />Guardar Alterações
                  </button>
                  <button onClick={() => setIsEditing(false)}
                    style={{ padding: "10px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #ccc", color: "#666", fontSize: 12, cursor: "pointer" }}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CRIAR UTILIZADOR ══ */}
      {modalAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setModalAberto(false)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 440, maxHeight: "90dvh", overflowY: "auto", position: "relative" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "12px 0 0 12px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingLeft: 8 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 18, color: "var(--panel-dark)", fontWeight: 400, margin: 0 }}>Novo Utilizador</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            <form onSubmit={handleSalvarUtilizador} style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 8 }}>
              {[
                { label: "Nome Completo *", name: "nome", type: "text", required: true },
                { label: "Email Institucional *", name: "email", type: "email", required: true },
              ].map(f => (
                <div key={f.name}>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} name={f.name} value={(form as any)[f.name]} onChange={handleInputChange} required={f.required}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFFCF8", color: "var(--panel-dark)", outline: "none" }} />
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Telefone", name: "telefone", type: "text" },
                  { label: "NIF", name: "nif", type: "text" },
                ].map(f => (
                  <div key={f.name}>
                    <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type} name={f.name} value={(form as any)[f.name]} onChange={handleInputChange}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFFCF8", color: "var(--panel-dark)", outline: "none" }} />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Data de Nascimento *</label>
                <input type="date" name="dataNascimento" value={form.dataNascimento} onChange={handleInputChange} required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFFCF8", color: "var(--panel-dark)", outline: "none" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Tipo de Utilizador *</label>
                <select name="id_tipoUtilizador" value={form.id_tipoUtilizador} onChange={handleInputChange} required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFFCF8", color: "var(--panel-dark)", cursor: "pointer", outline: "none" }}>
                  {loadingHashes ? (
                    <option>A carregar…</option>
                  ) : (
                    TIPOS_CRIAR.map(t => <option key={t} value={hashesDiscobertas[t]}>{TIPO_LABELS[t]}</option>)
                  )}
                </select>
              </div>

              {/* Turmas para Aluno */}
              {form.id_tipoUtilizador === hashesDiscobertas.ALUNO && hashesDiscobertas.ALUNO !== "" && (
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#2D4E7A", marginBottom: 6, fontWeight: "bold" }}>
                    Inscrição Inicial — Turmas *
                  </label>
                  <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--border-warm)", borderRadius: 6, background: "#FFFCF8", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {turmas.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>Nenhuma turma disponível.</span>
                    ) : turmas.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => handleTurmaCheckboxChange(t.id)}>
                        <input type="checkbox" checked={form.idTurmasIniciais.includes(t.id)} onChange={() => {}} style={{ cursor: "pointer", width: 15, height: 15 }} />
                        <label style={{ fontSize: 13, color: "var(--panel-dark)", cursor: "pointer", userSelect: "none" }}>
                          {t.nome} {t.modalidadeNome ? `(${t.modalidadeNome})` : ""}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campos Professor */}
              {form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR && hashesDiscobertas.PROFESSOR !== "" && (
                <div style={{ padding: 12, borderRadius: 6, background: "rgba(160,133,96,0.06)", border: "1px solid rgba(160,133,96,0.2)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" id="professorExterno" name="professorExterno" checked={form.professorExterno} onChange={handleCheckboxChange} />
                    <label htmlFor="professorExterno" style={{ fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Este professor é externo</label>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#7A5020", marginBottom: 4 }}>Valor por Hora (€)</label>
                    <input type="number" name="valorHora" value={form.valorHora} onChange={handleInputChange} disabled={!form.professorExterno}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: form.professorExterno ? "#FFFCF8" : "#f5f5f5", outline: "none" }} />
                  </div>
                </div>
              )}

              {/* Modalidades Professor */}
              {form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR && hashesDiscobertas.PROFESSOR !== "" && (
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#7A5020", marginBottom: 6, fontWeight: "bold" }}>
                    Modalidades que Lecciona
                  </label>
                  <div style={{ maxHeight: 120, overflowY: "auto", border: "1px solid var(--border-warm)", borderRadius: 6, background: "#FFFCF8", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {modalidadesSistema.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>Nenhuma modalidade disponível.</span>
                    ) : modalidadesSistema.map(mod => (
                      <div key={mod.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                        onClick={() => setForm(prev => {
                          const exists = prev.modalidadesIds.includes(mod.id);
                          return { ...prev, modalidadesIds: exists ? prev.modalidadesIds.filter(id => id !== mod.id) : [...prev.modalidadesIds, mod.id] };
                        })}>
                        <input type="checkbox" checked={form.modalidadesIds.includes(mod.id)} onChange={() => {}} style={{ cursor: "pointer", width: 15, height: 15 }} />
                        <label style={{ fontSize: 13, color: "var(--panel-dark)", cursor: "pointer", userSelect: "none" }}>{mod.nome}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" disabled={loadingInserir}
                style={{ width: "100%", padding: 12, background: "var(--panel-dark)", color: "var(--accent-gold)", border: "none", borderRadius: 6, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: loadingInserir ? "not-allowed" : "pointer", marginTop: 8, opacity: loadingInserir ? .7 : 1 }}>
                {loadingInserir ? "A guardar…" : "Criar Conta"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL REPOR PASSWORD ══ */}
      {reporTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setReporTarget(null)}>
          <form style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 400, position: "relative" }}
            onSubmit={reporPassword} onClick={e => e.stopPropagation()}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "12px 0 0 12px" }} />
            <div style={{ paddingLeft: 8 }}>
              <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: 18, margin: "0 0 6px", color: "var(--panel-dark)", fontWeight: 400 }}>Repor palavra-passe</h3>
              <p style={{ fontSize: 12, color: "var(--accent-muted)", margin: "0 0 20px", fontWeight: 300 }}>
                A repor a palavra-passe de <strong style={{ color: "var(--panel-dark)", fontWeight: 400 }}>{reporTarget.nome}</strong>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { placeholder: "Nova palavra-passe", val: novaPass, set: setNovaPass },
                  { placeholder: "Confirmar palavra-passe", val: confirmarPass, set: setConfirmarPass },
                ].map(({ placeholder, val, set }) => (
                  <input key={placeholder} type="password" placeholder={placeholder} value={val} onChange={e => set(e.target.value)} required
                    style={{ padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border-warm)", background: "#FFFCF8", color: "var(--panel-dark)", outline: "none", fontSize: 13 }} />
                ))}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" onClick={() => setReporTarget(null)}
                    style={{ padding: "8px 16px", background: "none", border: "1px solid var(--border-warm)", borderRadius: 6, color: "var(--accent-muted)", cursor: "pointer", fontSize: 12 }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={loadingRepor}
                    style={{ padding: "8px 16px", background: "var(--panel-dark)", color: "var(--accent-gold)", border: "none", borderRadius: 6, fontSize: 12, cursor: loadingRepor ? "not-allowed" : "pointer", opacity: loadingRepor ? .7 : 1 }}>
                    {loadingRepor ? "A gravar…" : "Gravar"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}