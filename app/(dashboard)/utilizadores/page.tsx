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
  turmas?: TurmaDto[]; modalidades?: ModalidadeDto[]; educandos?: UtilizadoreResumoDto[]; 
  encarregadoNome?: string;
}


interface UtilizadoreResumoDto {
  id: string;
  nome: string;
  email: string;
  tipoUtilizador?: string;
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

function onlyNineDigits(value: string) { return value.replace(/\D/g, "").slice(0, 9); }

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
  
  // 🟢 [CORREÇÃO] Tipagem corrigida para idEducandosIniciais como array opcional de strings
  const [editForm, setEditForm] = useState<Partial<UtilizadorResponseDto> & {
    idTurmasIniciais?: string[];
    modalidadesIds?: string[];
    idEducandosIniciais?: string[];
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
  
  //Estados para controlo e pesquisa de Alunos Menores para o Encarregado
  const [alunosMenores, setAlunosMenores] = useState<UtilizadoreResumoDto[]>([]);
  const [pesquisaAluno, setPesquisaAluno] = useState("");
  const [loadingAlunosMenores, setLoadingAlunosMenores] = useState(false);

  //Inclusão do campo idEducandosIniciais no estado do formulário de criação
  const [form, setForm] = useState<{
    nome: string; email: string; telefone: string; nif: string; dataNascimento: string;
    id_tipoUtilizador: string; valorHora: string; professorExterno: boolean;
    idTurmasIniciais: string[]; modalidadesIds: string[];
    idEducandosIniciais: string[];
  }>({ 
    nome: "", email: "", telefone: "", nif: "", dataNascimento: "", id_tipoUtilizador: "", 
    valorHora: "36", professorExterno: false, idTurmasIniciais: [], modalidadesIds: [], idEducandosIniciais: [] 
  });
  
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

  //Função para pesquisar dinamicamente os Alunos Menores na API do Backend
  const carregarAlunosMenores = useCallback(async (termo: string) => {
    setLoadingAlunosMenores(true);
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/alunos-menores?pesquisa=${encodeURIComponent(termo)}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        setAlunosMenores(await res.json());
      }
    } catch (err) {
      console.error("Erro ao carregar alunos menores:", err);
    } finally {
      setLoadingAlunosMenores(false);
    }
  }, []);

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

  // Recarrega a listagem de alunos menores sempre que um modal de alteração/criação for acionado
  useEffect(() => {
    if (modalAberto || isEditing) {
      carregarAlunosMenores("");
      setPesquisaAluno("");
    }
  }, [modalAberto, isEditing, carregarAlunosMenores]);

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
    setForm(prev => ({ ...prev, [name]: name === "telefone" || name === "nif" ? onlyNineDigits(value) : value }));
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
        modalidadesIds: form.id_tipoUtilizador === hashesDiscobertas.PROFESSOR
          ? form.modalidadesIds
          : [],
        // 🟢 [NOVO] Adicionado o envio de idEducandosIniciais no payload se for ENCARREGADO
        idEducandosIniciais: form.id_tipoUtilizador === hashesDiscobertas.ENCARREGADO
          ? form.idEducandosIniciais
          : [],
      };
      const res = await fetch(`${BASE_URL}/api/utilizadores`, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) {
        const erroDados = await res.json().catch(() => ({}));
        throw new Error(erroDados.message || "Erro ao criar utilizador.");
      }
      setSuccessMsg("Utilizador criado com sucesso!");
      setModalAberto(false);
      // Limpeza total incluindo a nova propriedade
      setForm({ nome: "", email: "", telefone: "", nif: "", dataNascimento: "", id_tipoUtilizador: hashesDiscobertas.ALUNO || "", valorHora: "36", professorExterno: false, idTurmasIniciais: [], modalidadesIds: [], idEducandosIniciais: [] });
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
    if (novaPass !== confirmarPass) { setErrorMsg("As palavras-passe não coincidem."); return; }
    if (!reporTarget) return;
    setLoadingRepor(true);
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/${reporTarget.id}/repor-password`, {
        method: "PATCH", headers: authHeaders(),
        body: JSON.stringify({ novaPassword: novaPass, confirmarNovaPassword: confirmarPass }),
      });
      if (!res.ok) throw new Error();
      setSuccessMsg(`Palavra-passe de ${reporTarget.nome} reposta com sucesso!`);
      setReporTarget(null); setNovaPass(""); setConfirmarPass("");
    } catch { setErrorMsg("Erro ao repor palavra-passe."); }
    finally { setLoadingRepor(false); }
  }

  const filtrados = utilizadores.filter(u => u.nome?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
  const ativosPagina = utilizadores.filter(u => u.ativo).length;
  const alunosPagina = utilizadores.filter(u => u.tipoUtilizador === "ROLE_ALUNO" || u.tipoUtilizador === "ALUNO").length;
  const professoresPagina = utilizadores.filter(u => u.tipoUtilizador === "ROLE_PROFESSOR" || u.tipoUtilizador === "PROFESSOR").length;
  const encarregadosPagina = utilizadores.filter(u => u.tipoUtilizador === "ROLE_ENCARREGADO" || u.tipoUtilizador === "ENCARREGADO").length;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        .u-card { box-shadow: 0 18px 42px rgba(64,47,29,.07); }
        .u-soft { box-shadow: 0 10px 28px rgba(64,47,29,.05); }
        .u-row { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease; }
        .u-row:hover { transform: translateY(-1px); box-shadow: 0 18px 36px rgba(64,47,29,.10); border-color: rgba(160,133,96,.46) !important; background: #fffdf9 !important; }
        .u-btn { transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease; }
        .u-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(64,47,29,.12); }
        .u-input:focus { border-color: rgba(160,133,96,.70) !important; box-shadow: 0 0 0 3px rgba(160,133,96,.12); }
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
          <main style={{ flex: 1, overflowY: "auto", padding: "30px 30px 42px" }}>
            <section className="u-card" style={{ background: "linear-gradient(135deg, #FFFCF8 0%, #FBF7F2 100%)", border: "1px solid var(--border-warm)", borderRadius: 10, padding: 22, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 18 }}>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, margin: "0 0 6px" }}>Coordenação</p>
                  <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 30, color: "var(--panel-dark)", fontWeight: 400, margin: 0 }}>Gestão de utilizadores</h1>
                  <p style={{ fontSize: 13, color: "var(--accent-muted)", fontWeight: 300, margin: "8px 0 0" }}>Pesquisa, cria e acompanha as contas registadas na plataforma.</p>
                </div>
                <button className="u-btn" onClick={() => setModalAberto(true)}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 18px", background: "var(--panel-dark)", border: "1px solid var(--panel-dark)", borderRadius: 8, color: "var(--accent-gold)", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                  <i className="ti ti-user-plus" style={{ fontSize: 16 }} /> Novo utilizador
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12, marginTop: 22 }}>
                {[
                  { label: "Total", value: totalElementos, icon: "ti-users", color: "var(--panel-dark)" },
                  { label: "Ativos nesta página", value: ativosPagina, icon: "ti-user-check", color: "#2D6A3F" },
                  { label: "Alunos", value: alunosPagina, icon: "ti-school", color: "#2D4E7A" },
                  { label: "Professores", value: professoresPagina, icon: "ti-chalkboard", color: "#7A5020" },
                  { label: "Encarregados", value: encarregadosPagina, icon: "ti-users-group", color: "#2D6A3F" },
                ].map(item => (
                  <div key={item.label} className="u-soft" style={{ border: "1px solid var(--border-warm)", borderRadius: 8, padding: 14, background: "rgba(255,255,255,.58)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--accent-muted)" }}>{item.label}</span>
                      <i className={`ti ${item.icon}`} style={{ color: item.color, fontSize: 17 }} />
                    </div>
                    <strong style={{ display: "block", marginTop: 8, fontFamily: "var(--font-playfair)", fontSize: 24, fontWeight: 400, color: "var(--panel-dark)" }}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <div className="u-soft" style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 190px", gap: 12, marginBottom: 18, background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10, padding: 14 }}>
              <div style={{ position: "relative" }}>
                <i className="ti ti-search" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: "var(--accent-muted)" }} />
                <input className="u-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por nome ou email..."
                  style={{ width: "100%", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 8, padding: "10px 12px 10px 38px", fontSize: 13, color: "var(--panel-dark)", outline: "none" }} />
              </div>
              <select className="u-input" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                style={{ background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 8, padding: "10px 12px", fontSize: 13, cursor: "pointer", color: "var(--panel-dark)", outline: "none" }}>
                <option value="">Todos os tipos</option>
                {TIPOS_CRIAR.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>

            {loading && (
              <div className="u-soft" style={{ display: "flex", justifyContent: "center", padding: 70, background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--border-warm)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}

            {!loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtrados.length === 0 ? (
                  <div className="u-soft" style={{ textAlign: "center", padding: "64px 24px", border: "1px dashed var(--border-warm)", borderRadius: 10, background: "#FFFCF8" }}>
                    <i className="ti ti-user-search" style={{ fontSize: 28, color: "var(--accent-muted)" }} />
                    <p style={{ fontFamily: "var(--font-playfair)", fontSize: 18, color: "var(--panel-dark)", margin: "10px 0 4px" }}>Nenhum utilizador encontrado</p>
                    <span style={{ fontSize: 12, color: "var(--accent-muted)" }}>Experimenta ajustar a pesquisa ou o filtro.</span>
                  </div>
                ) : filtrados.map(u => {
                  const cor = TIPO_CORES[u.tipoUtilizador] ?? TIPO_CORES.ROLE_ALUNO;
                  return (
                    <div key={u.id} className="u-row" onClick={() => { setDetalhe(u); setIsEditing(false); }}
                      style={{ display: "grid", gridTemplateColumns: "auto minmax(190px, 1fr) auto auto auto", alignItems: "center", gap: 16, background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10, padding: "15px 18px", cursor: "pointer" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontSize: 14 }}>
                        {initials(u.nome)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, color: "var(--panel-dark)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nome}</span>
                          <span style={{ background: cor.bg, border: `1px solid ${cor.border}`, color: cor.text, borderRadius: 999, padding: "3px 8px", fontSize: 10, letterSpacing: .5, textTransform: "uppercase" }}>
                            {TIPO_LABELS[u.tipoUtilizador] ?? u.tipoUtilizador}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", color: "var(--accent-muted)", fontSize: 12 }}>
                          <span><i className="ti ti-mail" style={{ marginRight: 5 }} />{u.email}</span>
                          {u.telefone && <span><i className="ti ti-phone" style={{ marginRight: 5 }} />{u.telefone}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 108 }}>
                        <span style={{ display: "block", fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Registo</span>
                        <strong style={{ fontSize: 12, color: "var(--panel-dark)", fontWeight: 500 }}>{formatDate(u.criadoEm)}</strong>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center", minWidth: 82, padding: "6px 9px", borderRadius: 999, background: u.ativo ? "rgba(74,143,89,.10)" : "rgba(192,57,43,.08)", color: u.ativo ? "#2D6A3F" : "#A33A2D", border: `1px solid ${u.ativo ? "rgba(74,143,89,.24)" : "rgba(192,57,43,.18)"}`, fontSize: 11 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.ativo ? "#2D6A3F" : "#A33A2D" }} />
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--border-warm)" }} />
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && totalPaginas > 1 && (
              <div className="u-soft" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, padding: "12px 14px", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: "var(--accent-muted)" }}>Página <strong style={{ color: "var(--panel-dark)" }}>{paginaAtual + 1}</strong> de {totalPaginas} · {filtrados.length} visíveis</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="u-btn" disabled={paginaAtual === 0} onClick={() => carregar(paginaAtual - 1)}
                    style={{ padding: "8px 13px", background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 7, fontSize: 12, cursor: paginaAtual === 0 ? "not-allowed" : "pointer", opacity: paginaAtual === 0 ? .5 : 1 }}>
                    Anterior
                  </button>
                  <button className="u-btn" disabled={paginaAtual >= totalPaginas - 1} onClick={() => carregar(paginaAtual + 1)}
                    style={{ padding: "8px 13px", background: "var(--panel-dark)", color: "var(--accent-gold)", border: "1px solid var(--panel-dark)", borderRadius: 7, fontSize: 12, cursor: paginaAtual >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: paginaAtual >= totalPaginas - 1 ? .5 : 1 }}>
                    Seguinte
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

      
      </div>

      {/* ══ MODAL DETALHE ══ */}
      {detalhe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setDetalhe(null)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 14, padding: 0, width: "100%", maxWidth: 720, maxHeight: "90dvh", overflowY: "auto", position: "relative", boxShadow: "0 24px 70px rgba(44,28,10,.24)" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, padding: "22px 24px", borderBottom: "1px solid var(--border-warm)", background: "#FFFCF8", borderRadius: "14px 14px 0 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: 1 }}>
                <div style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontSize: 19, flexShrink: 0 }}>
                  {initials(detalhe.nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <input type="text" value={editForm.nome || ""} onChange={e => setEditForm({ ...editForm, nome: e.target.value })}
                      style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 8, padding: "9px 12px", fontSize: 18, fontFamily: "var(--font-playfair)", width: "100%", outline: "none", color: "var(--panel-dark)" }} />
                  ) : (
                    <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", margin: 0, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detalhe.nome}</h2>
                  )}
                  <p style={{ fontSize: 12, color: "var(--accent-muted)", margin: "5px 0 8px" }}>{detalhe.email}</p>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(44,28,10,0.06)", border: "1px solid rgba(44,28,10,0.15)", borderRadius: 999, padding: "4px 10px", fontSize: 10, textTransform: "uppercase", letterSpacing: .7 }}>
                    <i className="ti ti-id" /> {TIPO_LABELS[detalhe.tipoUtilizador] ?? detalhe.tipoUtilizador}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ width: 36, height: 36, borderRadius: 9, background: "#FBF7F2", border: "1px solid var(--border-warm)", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18, flexShrink: 0 }}><i className="ti ti-x" /></button>
            </div>

            <div style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 18, background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10, padding: 16 }}>
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>Telefone</span>
                {isEditing ? (
                  <input type="text" inputMode="numeric" maxLength={9} value={editForm.telefone || ""} onChange={e => setEditForm({ ...editForm, telefone: onlyNineDigits(e.target.value) })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: "100%" }} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{detalhe.telefone || "—"}</span>
                )}
              </div>
              <div>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 4 }}>NIF</span>
                {isEditing ? (
                  <input type="text" inputMode="numeric" maxLength={9} value={editForm.nif || ""} onChange={e => setEditForm({ ...editForm, nif: onlyNineDigits(e.target.value) })}
                    style={{ background: "#FFF", border: "1px solid var(--border-warm)", borderRadius: 4, padding: "4px 8px", fontSize: 13, width: "100%" }} />
                ) : (
                  <span style={{ fontSize: 13, color: "var(--panel-dark)" }}>{detalhe.nif || "—"}</span>
                )}
              </div>
              
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

            {/* TURMAS (ALUNO) */}
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
              {/*VISUALIZAÇÃO DO ENCARREGADO DE EDUCAÇÃO NOS DETALHES DO ALUNO */}
            {(detalhe.tipoUtilizador === "ROLE_ALUNO" || detalhe.tipoUtilizador === "ALUNO") && (
              <div style={{ paddingLeft: 8, marginBottom: 16 }}>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 6 }}>
                  Encarregado de Educação
                </span>
                
                {detalhe.encarregadoNome ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, padding: "4px 10px", background: "rgba(218,165,32,0.08)", color: "#B8860B", borderRadius: 4, border: "1px solid rgba(218,165,32,0.18)", fontWeight: 500 }}>
                      <i className="ti ti-user-shield" style={{ marginRight: 6, fontSize: 12 }} />
                      {detalhe.encarregadoNome}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>
                    Nenhum encarregado associado a este aluno.
                  </span>
                )}
              </div>
            )}

            {/* MODALIDADES (PROFESSOR) */}
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
            {/* 🟢 [NOVO] SECÇÃO VISUAL DOS EDUCANDOS (ENCARREGADO DE EDUCAÇÃO) NO MODAL DETALHE/EDIÇÃO */}
           {/* 🟢 [ATUALIZADO] SECÇÃO DE EDUCANDOS (ENCARREGADO DE EDUCAÇÃO) NO MODAL DETALHE */}
            {(detalhe.tipoUtilizador === "ROLE_ENCARREGADO" || detalhe.tipoUtilizador === "ENCARREGADO") && (
              <div style={{ paddingLeft: 8, marginBottom: 16 }}>
                <span style={{ display: "block", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 6 }}>Educandos Associados</span>
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <input 
                      type="text" 
                      placeholder="Filtrar alunos por nome..." 
                      value={pesquisaAluno}
                      onChange={(e) => {
                        setPesquisaAluno(e.target.value);
                        carregarAlunosMenores(e.target.value);
                      }}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border-warm)", fontSize: 12, background: "#fff" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto", background: "#fff", padding: 8, borderRadius: 6, border: "1px solid var(--border-warm)" }}>
                      {loadingAlunosMenores ? (
                        <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>A carregar alunos...</span>
                      ) : alunosMenores.length === 0 ? (
                        <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>Nenhum aluno menor encontrado.</span>
                      ) : alunosMenores.map(aluno => {
                        const idEducandos = editForm.idEducandosIniciais || [];
                        const checked = idEducandos.includes(aluno.id);
                        return (
                          <label key={aluno.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                            <input type="checkbox" checked={checked} onChange={() => {
                              const novosEducandos = checked ? idEducandos.filter((id: string) => id !== aluno.id) : [...idEducandos, aluno.id];
                              setEditForm({ ...editForm, idEducandosIniciais: novosEducandos });
                            }} />
                            {aluno.nome}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // 🟢 Exibição direta nos Detalhes (Modo de Leitura)
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {detalhe.educandos && detalhe.educandos.length > 0 ? (
                      detalhe.educandos.map(educando => (
                        <span key={educando.id} style={{ fontSize: 12, padding: "3px 8px", background: "rgba(74,143,89,0.08)", color: "#2D6A3F", borderRadius: 4, border: "1px solid rgba(74,143,89,0.18)" }}>
                          <i className="ti ti-school" style={{ marginRight: 4, fontSize: 11 }} />
                          {educando.nome}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>
                        Nenhum educando associado a este encarregado.
                      </span>
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
                    setIsEditing(true); 
                    // Mapeamento expandido para injetar também o array vazio inicial de idEducandosIniciais
                    setEditForm({ 
                      ...detalhe,
                      idTurmasIniciais: detalhe.turmas ? detalhe.turmas.map(t => t.id) : [],
                      modalidadesIds: detalhe.modalidades ? detalhe.modalidades.map(m => m.id) : [],
                     idEducandosIniciais: detalhe.educandos ? detalhe.educandos.map(e => e.id) : []
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
        </div>
      )}

      {/* ══ MODAL CRIAR UTILIZADOR ══ */}
      {modalAberto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44,28,10,0.40)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
          onClick={() => setModalAberto(false)}>
          <div style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 14, padding: 0, width: "100%", maxWidth: 560, maxHeight: "90dvh", overflowY: "auto", position: "relative", boxShadow: "0 24px 70px rgba(44,28,10,.24)" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "22px 24px", borderBottom: "1px solid var(--border-warm)", background: "#FFFCF8", borderRadius: "14px 14px 0 0" }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", margin: "0 0 4px" }}>Nova conta</p>
                <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 23, color: "var(--panel-dark)", fontWeight: 400, margin: 0 }}>Criar utilizador</h2>
              </div>
              <button onClick={() => setModalAberto(false)} style={{ width: 36, height: 36, borderRadius: 9, background: "#FBF7F2", border: "1px solid var(--border-warm)", color: "var(--accent-muted)", cursor: "pointer", fontSize: 18 }}><i className="ti ti-x" /></button>
            </div>

            <form onSubmit={handleSalvarUtilizador} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24 }}>
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
                    <input type={f.type} name={f.name} inputMode={f.name === "telefone" || f.name === "nif" ? "numeric" : undefined} maxLength={f.name === "telefone" || f.name === "nif" ? 9 : undefined} value={(form as any)[f.name]} onChange={handleInputChange}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-warm)", background: "#FFFCF8", color: "var(--panel-dark)", outline: "none" }} />
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

              {/* 🟢 [NOVO] SECÇÃO VISUAL DE SELEÇÃO DE EDUCANDOS NO FORMULÁRIO DE CRIAÇÃO DO ENCARREGADO */}
              {form.id_tipoUtilizador === hashesDiscobertas.ENCARREGADO && hashesDiscobertas.ENCARREGADO !== "" && (
                <div>
                  <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#2D6A3F", marginBottom: 6, fontWeight: "bold" }}>
                    Associar Educandos (Alunos Menores)
                  </label>
                  
                  <input 
                    type="text" 
                    placeholder="Filtrar alunos por nome..." 
                    value={pesquisaAluno}
                    onChange={(e) => {
                      setPesquisaAluno(e.target.value);
                      carregarAlunosMenores(e.target.value);
                    }}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border-warm)", marginBottom: 8, fontSize: 12, background: "#fff" }}
                  />

                  <div style={{ maxHeight: 120, overflowY: "auto", border: "1px solid var(--border-warm)", borderRadius: 6, background: "#FFFCF8", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {loadingAlunosMenores ? (
                      <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>A pesquisar...</span>
                    ) : alunosMenores.length === 0 ? (
                      <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic" }}>Nenhum aluno menor encontrado.</span>
                    ) : alunosMenores.map(aluno => (
                      <div key={aluno.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                        onClick={() => setForm(prev => {
                          const exists = prev.idEducandosIniciais.includes(aluno.id);
                          return { ...prev, idEducandosIniciais: exists ? prev.idEducandosIniciais.filter(id => id !== aluno.id) : [...prev.idEducandosIniciais, aluno.id] };
                        })}>
                        <input type="checkbox" checked={form.idEducandosIniciais.includes(aluno.id)} onChange={() => {}} style={{ cursor: "pointer", width: 15, height: 15 }} />
                        <label style={{ fontSize: 13, color: "var(--panel-dark)", cursor: "pointer", userSelect: "none" }}>{aluno.nome}</label>
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

      {/* ══ MODAL REPOR PALAVRA-PASSE ══ */}
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
