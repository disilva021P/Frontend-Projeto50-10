"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface ResumoDto { id: string; nome: string }
interface TurmaDto   { id: string; nome: string; modalidade?: ResumoDto }
interface EstudioDto { id: string; nome: string }
interface AulaDto    {
  id: string; titulo?: string; dataAula?: string; horaInicio?: string; horaFim?: string;
  turma?: TurmaDto; estudio?: EstudioDto; professor?: ResumoDto; diaSemana?: string | number;
}
interface CoachingDto {
  aulaDto: { id: string; dataAula: string; horaInicio: string; horaFim: string; duracaoMinutos: number; estudio?: EstudioDto };
  modalidadeDto: { id: string; nome: string };
  estadoAulaDto: { id: string; estado: string };
  max_alunos: number;
  professorDto?: any;
}
interface HorarioFixoDto {
  id: string; diaSemana: string; horaInicio: string; horaFim: string;
  dataInicio: string; dataValidade: string; duracaoMinutos: number;
  idturmaId: TurmaDto; estudioId: EstudioDto; idcriadoPor: ResumoDto;
}
interface DisponibilidadeDto {
  id: string; diaSemana: number; horaInicio: string; horaFim: string;
  validoDe?: string; validoAte?: string; professor?: ResumoDto;
}

const BASE = "http://localhost:8080";
const API  = `${BASE}/api/horario`;

const DIAS = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const DIAS_OPTIONS = [
  { value: 1, label: "SEGUNDA" }, { value: 2, label: "TERÇA" },
  { value: 3, label: "QUARTA"  }, { value: 4, label: "QUINTA" },
  { value: 5, label: "SEXTA"   }, { value: 6, label: "SÁBADO" },
  { value: 7, label: "DOMINGO" },
];
const HORAS = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", 
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", 
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", 
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
];

const AULA_CORES       = ["#FBF0E4","#EAF4EC","#EEF2FB","#FBF0F7","#F5F5DC"];
const AULA_CORES_BORDA = ["#D4B288","#9ECFAA","#9DBCE8","#D4A8C7","#C8C89E"];
const AULA_CORES_TEXTO = ["#7A5020","#2D6A4F","#1A3F6F","#6B2D56","#5A5A30"];

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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

async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${BASE}${url}`;
  const res = await fetch(fullUrl, { ...opts, headers: { ...authHeaders(), ...(opts.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Helpers data / grelha ───────────────────────────────────────────────────

function horaParaMin(h: string): number {
  if (!h) return 0;
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}
function diaParaIdx(dia: string | number | undefined): number {
  if (dia === undefined || dia === null) return -1;
  const n = typeof dia === "number" ? dia : parseInt(dia as string, 10);
  if (!isNaN(n) && n >= 1 && n <= 7) return n - 1;
  const mapa: Record<string, number> = {
    SEGUNDA: 0, "SEGUNDA-FEIRA": 0,
    "TERÇA": 1, TERCA: 1, "TERÇA-FEIRA": 1,
    QUARTA: 2, "QUARTA-FEIRA": 2,
    QUINTA: 3, "QUINTA-FEIRA": 3,
    SEXTA: 4, "SEXTA-FEIRA": 4,
    "SÁBADO": 5, SABADO: 5,
    DOMINGO: 6,
  };
  return mapa[(dia as string).toUpperCase()] ?? -1;
}

function trimHora(h: string | undefined): string | undefined {
  return h ? h.substring(0, 5) : h;
}

function normalizeAula(a: any): AulaDto {
  const h = a.idHorario ?? {};
  const diaSemana = a.diaSemana ?? h.diaSemana;
  const diaDerived = diaSemana ?? (a.dataAula
    ? (() => { const d = new Date(a.dataAula + "T00:00:00"); return d.getDay() === 0 ? 7 : d.getDay(); })()
    : undefined);
  return {
    id:         a.id,
    titulo:     a.titulo     ?? h.titulo,
    dataAula:   a.dataAula   ?? h.dataAula,
    horaInicio: trimHora(a.horaInicio ?? h.horaInicio),
    horaFim:    trimHora(a.horaFim    ?? h.horaFim),
    diaSemana:  diaDerived,
    turma:      a.turma      ?? h.idturmaId,
    estudio:    a.estudio    ?? h.estudioId,
    professor:  a.professor  ?? h.professor ?? h.idcriadoPor,
  };
}

// Calcula o intervalo de datas (Segunda a Domingo) baseado no offset de semanas
function obterIntervaloSemanas(offset: number): string {
  const hoje = new Date();
  const diaAtual = hoje.getDay() === 0 ? 7 : hoje.getDay();
  const segundaFeira = new Date(hoje);
  segundaFeira.setDate(hoje.getDate() - (diaAtual - 1) + (offset * 7));
  
  const domingo = new Date(segundaFeira);
  domingo.setDate(segundaFeira.getDate() + 6);

  const formatar = (d: Date) => d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
  return `${formatar(segundaFeira)} até ${formatar(domingo)}`;
}

// Filtra registos futuros (compara data e hora de fim)
function eFuturo(dataStr: string, horaFimStr?: string): boolean {
  if (!dataStr) return true;
  const hoje = new Date();
  const dataAula = new Date(`${dataStr}T${horaFimStr || "23:59"}:00`);
  return dataAula >= hoje;
}

// ─── Componentes UI internos ──────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--border-warm)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return <div style={{ color: "#c0392b", padding: "10px 14px", background: "#fde8e8", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #f5c6cb" }}>⚠️ {msg}</div>;
}
function OkMsg({ msg }: { msg: string }) {
  return <div style={{ color: "#27ae60", padding: "10px 14px", background: "#eafaf1", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #a9dfbf" }}>✓ {msg}</div>;
}

function EstadoBadge({ estado }: { estado: string }) {
  const cores: Record<string, { bg: string; text: string; label: string }> = {
    CONFIRMADO:   { bg: "#d4edda", text: "#155724", label: "CONFIRMADO" },
    VALIDADO:     { bg: "#d1ecf1", text: "#0c5460", label: "VALIDADO" },
    PENDENTE:     { bg: "#fff3cd", text: "#856404", label: "PENDENTE" },
    LISTA_ESPERA: { bg: "#fce4ec", text: "#880e4f", label: "LISTA DE ESPERA" },
    CANCELADO:    { bg: "#f8d7da", text: "#721c24", label: "CANCELADO" },
  };
  const c = cores[estado] ?? { bg: "#e9ecef", text: "#495057", label: estado };
  return <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, letterSpacing: .5 }}>{c.label}</span>;
}

const btnBase: React.CSSProperties = { borderRadius: 6, fontWeight: 700, cursor: "pointer", letterSpacing: .3, fontFamily: "Lato, sans-serif", transition: "opacity .15s" };
function BtnPrimario({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "var(--panel-dark)", border: "none", color: "var(--accent-gold)", fontSize: small ? 11 : 13, padding: small ? "6px 14px" : "10px 22px" }}>{label}</button>;
}
function BtnSecundario({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "transparent", border: "1px solid var(--panel-dark)", color: "var(--panel-dark)", fontSize: small ? 11 : 13, padding: small ? "5px 13px" : "9px 21px" }}>{label}</button>;
}
function BtnPerigo({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "transparent", border: "1px solid #c0392b", color: "#c0392b", fontSize: small ? 11 : 13, padding: small ? "5px 13px" : "8px 20px" }}>{label}</button>;
}

function InputField({ label, type = "text", value, onChange, min }: { label: string; type?: string; value: string | number; onChange: (v: string) => void; min?: string | number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 400, letterSpacing: 2, color: "var(--accent-muted)", marginBottom: 5, textTransform: "uppercase" as const }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} min={min}
        style={{ width: "100%", background: "#fff", border: "1px solid var(--border-warm)", borderRadius: 6, color: "var(--panel-dark)", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as const }} />
    </div>
  );
}
function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 400, letterSpacing: 2, color: "var(--accent-muted)", marginBottom: 5, textTransform: "uppercase" as const }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", background: "#fff", border: "1px solid var(--border-warm)", borderRadius: 6, color: "var(--panel-dark)", padding: "9px 12px", fontSize: 13, outline: "none", cursor: "pointer" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { key: T; label: string }[]; active: T; onChange: (k: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid var(--border-warm)" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{ background: "none", border: "none", borderBottom: active === t.key ? "2px solid var(--panel-dark)" : "2px solid transparent", marginBottom: -1, padding: "10px 18px", fontSize: 11, fontWeight: active === t.key ? 400 : 300, letterSpacing: 2, textTransform: "uppercase" as const, color: active === t.key ? "var(--panel-dark)" : "var(--accent-muted)", cursor: "pointer" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(44,31,20,0.40)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "var(--background)", width: "100%", maxWidth: 580, maxHeight: "90vh", borderRadius: 12, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", overflowY: "auto", display: "flex", flexDirection: "column", border: "1px solid var(--border-warm)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-warm)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--background)" }}>
          <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: 18, color: "var(--panel-dark)", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }} aria-label="Fechar modal">
            <i className="ti ti-x" />
          </button>
        </div>
        <div style={{ padding: "24px", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Grelha semanal ───────────────────────────────────────────────────────────

function GrelhaHorario({ aulas, titulo, semanaOffset, onPrev, onNext }: { aulas: AulaDto[]; titulo: string; semanaOffset: number; onPrev: () => void; onNext: () => void }) {
  const HORA_INICIO = 0;
  const HORA_FIM    = 24;
  const TOTAL_MIN   = (HORA_FIM - HORA_INICIO) * 60;
  const PX_POR_HORA = 56;
  const ALTURA      = TOTAL_MIN / 60 * PX_POR_HORA;
  const SCROLL_INICIAL = 8 * PX_POR_HORA;

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = SCROLL_INICIAL;
    }
  }, []);

  const aulasPorDia: AulaDto[][] = Array.from({ length: 7 }, () => []);
  aulas.forEach(a => {
    const i = diaParaIdx(a.diaSemana);
    if (i >= 0) aulasPorDia[i].push(a);
  });

  const pos  = (h: string) => (horaParaMin(h) / TOTAL_MIN) * ALTURA;
  const alto = (i: string, f: string) => Math.max(((horaParaMin(f) - horaParaMin(i)) / TOTAL_MIN) * ALTURA, 22);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--accent-muted)", fontStyle: "italic", fontWeight: 400 }}>{titulo}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onPrev} style={{ background: "#fff", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: "var(--panel-dark)", fontSize: 12, fontFamily: "Lato, sans-serif", fontWeight: 500 }}>← Anterior</button>
          <span style={{ fontSize: 13, color: "var(--panel-dark)", minWidth: 150, textAlign: "center", fontWeight: 600, background: "rgba(44,31,20,0.05)", padding: "6px 12px", borderRadius: 6 }}>
            {obterIntervaloSemanas(semanaOffset)}
          </span>
          <button onClick={onNext} style={{ background: "#fff", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: "var(--panel-dark)", fontSize: 12, fontFamily: "Lato, sans-serif", fontWeight: 500 }}>Próxima →</button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 700, border: "1px solid var(--border-warm)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", background: "#FAF8F5", borderBottom: "1px solid var(--border-warm)", position: "sticky", top: 0, zIndex: 2 }}>
            <div />
            {DIAS.map(dia => (
              <div key={dia} style={{ borderLeft: "1px solid var(--border-warm)", padding: "8px 4px", textAlign: "center", fontSize: 10, fontWeight: 400, letterSpacing: 2, color: "var(--accent-muted)" }}>
                {dia}
              </div>
            ))}
          </div>

          <div ref={scrollRef} style={{ overflowY: "auto", maxHeight: 560 }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)" }}>
              <div style={{ position: "relative", height: ALTURA }}>
                {HORAS.map((h, i) => {
                  const top = (horaParaMin(h) / TOTAL_MIN) * ALTURA;
                  return (
                    <div key={h} style={{ position: "absolute", top, left: 0, right: 0, display: "flex", alignItems: "flex-start" }}>
                      {i > 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, borderTop: "1px solid #EEE" }} />}
                      <span style={{ fontSize: 9, color: "var(--accent-muted)", padding: "0 4px", lineHeight: 1, marginTop: -5, position: "relative", zIndex: 1, background: "#fff" }}>{h}</span>
                    </div>
                  );
                })}
              </div>

              {DIAS.map((_, dIdx) => (
                <div key={dIdx} style={{ position: "relative", height: ALTURA, borderLeft: "1px solid var(--border-warm)" }}>
                  {HORAS.map((h, i) => {
                    const top = (horaParaMin(h) / TOTAL_MIN) * ALTURA;
                    return <div key={h} style={{ position: "absolute", top, left: 0, right: 0, borderTop: i === 0 ? "none" : "1px solid #F5F0EA", height: 1 }} />;
                  })}
                  {aulasPorDia[dIdx].map((a, aIdx) => {
                    const top    = pos(a.horaInicio ?? "08:00");
                    const height = alto(a.horaInicio ?? "08:00", a.horaFim ?? "09:00");
                    const c = aIdx % AULA_CORES.length;
                    return (
                      <div key={a.id} style={{ position: "absolute", top: top + 1, left: 3, right: 3, height: height - 2, background: AULA_CORES[c], border: `1px solid ${AULA_CORES_BORDA[c]}`, borderLeft: `3px solid ${AULA_CORES_BORDA[c]}`, borderRadius: 4, padding: "3px 5px", overflow: "hidden" }}>
                        <div style={{ fontSize: 10, fontWeight: 400, color: AULA_CORES_TEXTO[c], lineHeight: 1.2 }}>{a.turma?.nome ?? a.titulo ?? "Aula"}</div>
                        <div style={{ fontSize: 9, color: AULA_CORES_TEXTO[c], opacity: .8, marginTop: 1 }}>{trimHora(a.horaInicio)} – {trimHora(a.horaFim)}</div>
                        {height > 36 && a.professor && <div style={{ fontSize: 9, color: AULA_CORES_TEXTO[c], opacity: .65 }}>{a.professor.nome}</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Formulário Marcar Coaching ───────────────────────────────────────────────

function MarcarCoachingForm({
  onSubmit,
  err,
  ok,
  submitLabel = "Enviar pedido",
}: {
  onSubmit: (form: { professorId: string; modalidadeId: string; dataAula: string; horaInicio: string; horaFim: string; maxAlunos: number; descricao: string }) => Promise<void>;
  err: string;
  ok: string;
  submitLabel?: string;
}) {
  const [modalidades, setMods]           = useState<ResumoDto[]>([]);
  const [professores, setProfs]          = useState<any>(null); 
  const [disponibilidades, setDisps]     = useState<DisponibilidadeDto[]>([]);
  const [loadingProfs, setLoadingProfs]  = useState(false);
  const [loadingDisps, setLoadingDisps]  = useState(false);
  const [form, setForm]                  = useState({ professorId:"", modalidadeId:"", dataAula:"", horaInicio:"", horaFim:"", maxAlunos:1, descricao:"" });
  const [submitting, setSubmitting]      = useState(false);
  const [horarioSelecionadoId, setHorarioSelecionadoId] = useState<string>("");
  const [dataErro, setDataErro] = useState("");

  useEffect(() => {
    apiFetch<ResumoDto[]>(`${BASE}/api/modalidades`).then(m => setMods(m??[])).catch(console.error);
  }, []);

  useEffect(() => {
    if (!form.modalidadeId) { setProfs(null); setDisps([]); setForm(f=>({...f,professorId:"",horaInicio:"",horaFim:""})); return; }
    setLoadingProfs(true);
    apiFetch<any>(`${BASE}/api/professores/${form.modalidadeId}`)
          .then(p => setProfs(p))
      .catch(console.error)
      .finally(() => setLoadingProfs(false));
    setDisps([]); setForm(f=>({...f,professorId:"",horaInicio:"",horaFim:""}));
  }, [form.modalidadeId]);

  useEffect(() => {
    if (!form.professorId) { setDisps([]); setForm(f=>({...f,horaInicio:"",horaFim:""})); return; }
    setLoadingDisps(true);
    apiFetch<DisponibilidadeDto[]>(`${BASE}/disponibilidade/professor/${form.professorId}`)
      .then(d => setDisps(d??[]))
      .catch(console.error)
      .finally(() => setLoadingDisps(false));
    setForm(f=>({...f,horaInicio:"",horaFim:""}));
  }, [form.professorId]);

  const listaProfessores = professores?.content ?? [];
  const profSel = listaProfessores.find((p: any) => String(p.id ?? p.utilizadorId) === form.professorId);
  const dispSelecionada = disponibilidades.find(d => d.id === horarioSelecionadoId);

  const obterProximaDataPorDiaSemana = (diaSemanaAlvo: number): string => {
    const hoje = new Date();
    const resultado = new Date(hoje);
    const diaAtualJS = hoje.getDay() === 0 ? 7 : hoje.getDay();
    let diasAteAlvo = diaSemanaAlvo - diaAtualJS;
    if (diasAteAlvo <= 0) diasAteAlvo += 7;
    resultado.setDate(hoje.getDate() + diasAteAlvo);
    return resultado.toISOString().split('T')[0];
  };

  const handleDataChange = (dataString: string) => {
    if (!dataString) {
      setForm(f => ({ ...f, dataAula: "" }));
      setDataErro("");
      return;
    }
    if (dispSelecionada) {
      const dataEscolhida = new Date(dataString + "T00:00:00");
      const diaSemanaEscolhidoJS = dataEscolhida.getDay() === 0 ? 7 : dataEscolhida.getDay();
      if (diaSemanaEscolhidoJS !== dispSelecionada.diaSemana) {
        const diaNome = DIAS_OPTIONS.find(x => x.value === dispSelecionada.diaSemana)?.label;
        setDataErro(`Aviso: O horário escolhido é às ${diaNome}s. Por favor, seleciona um dia correspondente.`);
      } else {
        setDataErro("");
      }
    }
    setForm(f => ({ ...f, dataAula: dataString }));
  };

  const handleSubmit = async () => {
    if (dataErro) {
      alert("Por favor, corrige a data antes de enviar.");
      return;
    }
    setSubmitting(true);
    try { 
      await onSubmit(form); 
      setForm({ professorId:"", modalidadeId:"", dataAula:"", horaInicio:"", horaFim:"", maxAlunos:1, descricao:"" }); 
      setDisps([]); 
      setProfs(null); 
      setHorarioSelecionadoId("");
      setDataErro("");
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      {err && <ErrMsg msg={err} />}
      {ok && <OkMsg msg={ok} />}
      {dataErro && <div style={{ color: "#721c24", padding: "10px 14px", background: "#f8d7da", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #f5c6cb" }}>⚠️ {dataErro}</div>}

      <SelectField
        label="1 · Modalidade"
        value={form.modalidadeId}
        onChange={v => setForm(f=>({...f,modalidadeId:v}))}
        options={modalidades.map(m=>({value:m.id,label:m.nome}))}
        placeholder="Escolher modalidade..."
      />

      {form.modalidadeId && (
        <>
          {loadingProfs ? (
            <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:14 }}>A carregar professores…</div>
          ) : listaProfessores.length === 0 ? (
            <div style={{ fontSize:12, color:"#c0392b", marginBottom:14, background:"#fde8e8", border:"1px solid #f5c6cb", borderRadius:6, padding:"8px 12px" }}>
              Não há professores disponíveis.
            </div>
          ) : (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:8, textTransform:"uppercase" as const }}>2 · Professor</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {listaProfessores.map((p: any, index: number) => {
                const currentId = String(p.id ?? p.utilizadorId ?? p.utilizadores?.id);
                const currentNome = p.nome ?? p.utilizador?.nome ?? p.utilizadores?.nome ?? "Professor";
                return (
                  <button key={currentId ?? index} type="button" onClick={() => setForm(f => ({ ...f, professorId: currentId }))}
                    style={{ background: form.professorId === currentId ? 'var(--panel-dark)' : '#fff', color: form.professorId === currentId ? 'var(--accent-gold)' : 'var(--panel-dark)', border: '1px solid var(--border-warm)', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer' }}>
                    {currentNome}
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </>
      )}

      {form.professorId && (
        <>
          {loadingDisps ? (
            <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:14 }}>A carregar disponibilidades…</div>
          ) : disponibilidades.length === 0 ? (
            <div style={{ fontSize:12, color:"#c0392b", marginBottom:14, background:"#fde8e8", border:"1px solid #f5c6cb", borderRadius:6, padding:"8px 12px" }}>
              Sem disponibilidades registadas.
            </div>
          ) : (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:8, textTransform:"uppercase" as const }}>3 · Horário disponível</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {disponibilidades.map(d => {
                  const diaLabel = DIAS_OPTIONS.find(x=>x.value===d.diaSemana)?.label ?? String(d.diaSemana);
                  const selected = horarioSelecionadoId === d.id; 
                  return (
                    <button key={d.id} type="button" 
                      onClick={() => {
                        setHorarioSelecionadoId(d.id);
                        setDataErro("");
                        const proximaDataValida = obterProximaDataPorDiaSemana(d.diaSemana);
                        setForm(f=>({ ...f, horaInicio: d.horaInicio, horaFim: d.horaFim, dataAula: proximaDataValida }));
                      }}
                      style={{ display:"flex", alignItems:"center", gap:12, background: selected ? "var(--panel-dark)" : "#fff", border:"1px solid var(--border-warm)", borderRadius:8, padding:"10px 16px", cursor:"pointer", textAlign:"left" }}
                    >
                      <i className="ti ti-clock" style={{ fontSize:14, color: selected ? "var(--accent-gold)" : "var(--accent-muted)" }} />
                      <div>
                        <div style={{ fontSize:13, color: selected ? "var(--accent-gold)" : "var(--panel-dark)", fontWeight:500 }}>{diaLabel} · {trimHora(d.horaInicio)} – {trimHora(d.horaFim)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {form.horaInicio && (
        <>
          <div style={{ height:1, background:"var(--border-warm)", margin:"4px 0 16px" }} />
          <InputField label="4 · Data da sessão" type="date" value={form.dataAula} min={new Date().toISOString().split('T')[0]} onChange={handleDataChange} />
          <InputField label="Máx. alunos" type="number" min={1} value={form.maxAlunos} onChange={v=>setForm(f=>({...f,maxAlunos:Number(v)}))} />
          <TextareaField label="Notas / Observações" value={form.descricao} onChange={v=>setForm(f=>({...f,descricao:v}))} />
          <div style={{ marginTop: 18 }}>
            <BtnPrimario label={submitting ? "A enviar…" : submitLabel} onClick={handleSubmit} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Componente Comum de Grelha de Coachings (Alunos e Encarregados) ───────────

function CoachingGrid({ items, onAction, actionLabel, actionPerigo }: { items: CoachingDto[]; onAction: (id: string) => void; actionLabel: string; actionPerigo?: boolean }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:20 }}>
      {items.map(c => (
        <div key={c.aulaDto.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"20px", boxShadow:"0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, gap: 10 }}>
              <div style={{ fontFamily:"var(--font-playfair)", fontWeight:600, fontSize:16, color:"var(--panel-dark)" }}>{c.modalidadeDto?.nome || "Sessão de Coaching"}</div>
              <EstadoBadge estado={c.estadoAulaDto?.estado??"PENDENTE"} />
            </div>
            
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16, borderTop:"1px solid #FAF8F5", paddingTop:12 }}>
              <div style={{ fontSize:13, color:"var(--panel-dark)", display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ color:"var(--accent-muted)" }}>📅 Data:</span> <strong>{c.aulaDto.dataAula}</strong>
              </div>
              <div style={{ fontSize:13, color:"var(--panel-dark)", display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ color:"var(--accent-muted)" }}>⏰ Horário:</span> <strong>{trimHora(c.aulaDto.horaInicio)} – {trimHora(c.aulaDto.horaFim)}</strong>
              </div>
              <div style={{ fontSize:13, color:"var(--panel-dark)", display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ color:"var(--accent-muted)" }}>👤 Professor:</span> <span>{c.professorDto?.utilizadores?.nome || c.professorDto?.nome || "Não atribuído"}</span>
              </div>
              {c.aulaDto.estudio && (
                <div style={{ fontSize:13, color:"var(--panel-dark)", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:"var(--accent-muted)" }}>📍 Estúdio:</span> <span>{c.aulaDto.estudio.nome}</span>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ borderTop: "1px solid #FAF8F5", paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
            {actionPerigo
              ? <BtnPerigo   label={actionLabel} onClick={()=>onAction(c.aulaDto.id)} small />
              : <BtnPrimario label={actionLabel} onClick={()=>onAction(c.aulaDto.id)} small />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Vista Base / Aluno ───────────────────────────────────────────────────────

function AlunoView({ userName, educandoId }: { userName: string; educandoId?: string }) {
  const [semana, setSemana]         = useState<AulaDto[]>([]);
  const [coaching, setCoaching]     = useState<CoachingDto[]>([]);
  const [disponiveis, setDisp]      = useState<CoachingDto[]>([]);
  const [offset, setOffset]         = useState(0);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"horario"|"coaching"|"disponiveis">("horario");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [verPassados, setVerPassados] = useState(false);
  const [err, setErr]               = useState("");
  const [ok, setOk]                 = useState("");

  const carregarDados = useCallback(() => {
    setLoading(true);
    const urlSemana = educandoId ? `${API}/semana/educando/${educandoId}?offset=${offset}` : `${API}/semana?offset=${offset}`;
    const urlCoaching = educandoId ? `${API}/coaching/educando/${educandoId}` : `${API}/coaching`;
    const urlDisp = educandoId ? `${API}/coachingsdisponiveis/educando/${educandoId}?offset=${offset}` : `${API}/coachingsdisponiveis?offset=${offset}`;

    Promise.all([
      apiFetch<AulaDto[]>(urlSemana),
      apiFetch<{ content: CoachingDto[] }>(urlCoaching),
      apiFetch<{ content: CoachingDto[] }>(urlDisp),
    ]).then(([s,c,d]) => {
      setSemana((s??[]).map(normalizeAula)); 
      setCoaching(c?.content??[]); 
      setDisp(d?.content??[]);
    }).catch(console.error).finally(() => setLoading(false));
  }, [offset, educandoId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const cancelar = async (id: string) => {
    const url = educandoId ? `${API}/cancelarCoaching/${id}/educando/${educandoId}` : `${API}/cancelarCoaching/${id}`;
    await apiFetch(url, { method:"DELETE" });
    carregarDados();
  };

  const inscrever = async (id: string) => {
    const url = educandoId ? `${API}/inscreverEmCoaching/${id}/educando/${educandoId}` : `${API}/inscreverEmCoaching/${id}`;
    await apiFetch(url, { method:"POST" });
    carregarDados();
  };

  const marcar = async (form: { professorId: string; modalidadeId: string; dataAula: string; horaInicio: string; horaFim: string; maxAlunos: number; descricao: string }) => {
    setErr(""); setOk("");
    try {
      const url = educandoId ? `${API}/marcarcoaching/educando/${educandoId}` : `${API}/marcarcoaching`;
      const res = await apiFetch<any>(url, { method:"POST", body:JSON.stringify(form) });
      const estudio = res?.aulaDto?.estudio?.nome || "um dos nossos estúdios";
      setOk(`Coaching marcado com sucesso no estúdio [ ${estudio} ]!`);
      carregarDados();
      setTimeout(() => setIsModalOpen(false), 2200);
    } catch (e: any) { setErr(e.message || "Erro ao marcar coaching."); }
  };

  // Filtros de histórico
  const coachingsFiltrados = coaching.filter(c => verPassados ? !eFuturo(c.aulaDto.dataAula, c.aulaDto.horaFim) : eFuturo(c.aulaDto.dataAula, c.aulaDto.horaFim));
  const disponiveisFiltrados = disponiveis.filter(c => eFuturo(c.aulaDto.dataAula, c.aulaDto.horaFim));

  const TABS = [{ key:"horario", label:"Aulas" },{ key:"coaching", label:"Coaching" },{ key:"disponiveis", label:"Disponíveis" }] as const;

  return (
    <div>
      <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
      {loading ? <Loader /> : <>
        {tab === "horario" && <GrelhaHorario aulas={semana} titulo={`Aulas de ${userName.split(" ")[0]}`} semanaOffset={offset} onPrev={() => setOffset(o=>o-1)} onNext={() => setOffset(o=>o+1)} />}

        {tab === "coaching" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", margin: 0 }}>Os meus coachings</h2>
              <div style={{ display:"flex", gap:12 }}>
                <BtnSecundario label={verPassados ? "Ver Agendados" : "Ver Coachings Passados"} onClick={() => setVerPassados(!verPassados)} />
                <BtnPrimario label="+ Marcar Sessão" onClick={() => { setErr(""); setOk(""); setIsModalOpen(true); }} />
              </div>
            </div>
            {coachingsFiltrados.length === 0 && <Empty>{verPassados ? "Nenhum histórico de sessões passadas." : "Sem coachings futuros agendados."}</Empty>}
            <CoachingGrid items={coachingsFiltrados} onAction={(id) => cancelar(id)} actionLabel="Cancelar Agendamento" actionPerigo={!verPassados} />
          </div>
        )}

        {tab === "disponiveis" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", margin: 0 }}>Coachings disponíveis</h2>
            </div>
            {disponiveisFiltrados.length === 0 && <Empty>Sem sessões livres para inscrição no momento.</Empty>}
            <CoachingGrid items={disponiveisFiltrados} onAction={(id) => inscrever(id)} actionLabel="Inscrever na Sessão" />
          </div>
        )}
      </>}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Marcar Sessão de Coaching">
        <MarcarCoachingForm onSubmit={marcar} err={err} ok={ok} />
      </Modal>
    </div>
  );
}

// ─── Vista Encarregado ────────────────────────────────────────────────────────

function EncarregadoView() {
  const [educandos, setEducandos]   = useState<ResumoDto[]>([]);
  const [sel, setSel]               = useState<ResumoDto | null>(null);

  useEffect(() => {
    apiFetch<ResumoDto[]>(`${BASE}/api/utilizadores/meus-educandos`).catch(()=>[]).then(e => {
      const lista = e??[];
      setEducandos(lista);
      if(lista.length > 0) setSel(lista[0]);
    });
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 24, background:"#fff", padding:"16px", borderRadius:8, border:"1px solid var(--border-warm)" }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", marginBottom: 10, fontWeight: 500 }}>Selecionar Educando</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {educandos.map(e => (
            <button key={e.id} onClick={() => setSel(e)}
              style={{ background: sel?.id===e.id ? "var(--panel-dark)" : "#fff", border: "1px solid", borderColor: sel?.id===e.id ? "var(--panel-dark)" : "var(--border-warm)", borderRadius: 20, color: sel?.id===e.id ? "var(--accent-gold)" : "var(--panel-dark)", fontSize: 13, padding: "8px 20px", cursor: "pointer", fontWeight: 500 }}>
              {e.nome}
            </button>
          ))}
          {educandos.length === 0 && <span style={{ color: "var(--accent-muted)", fontSize: 13 }}>Sem educandos associados à conta.</span>}
        </div>
      </div>

      {sel && <AlunoView userName={sel.nome} educandoId={sel.id} />}
    </div>
  );
}

// ─── Vista Professor ──────────────────────────────────────────────────────────

function ProfessorView({ userName }: { userName: string }) {
  const [horario, setHorario]   = useState<AulaDto[]>([]);
  const [pendentes, setPend]    = useState<CoachingDto[]>([]);
  const [disps, setDisps]       = useState<DisponibilidadeDto[]>([]);
  const [offset, setOffset]     = useState(0);
  const [tab, setTab]           = useState<"horario"|"coaching"|"disponibilidade">("horario");
  const [loading, setLoading]   = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  
  const [dispForm, setDispForm] = useState({ diaSemana:1, horaInicio:"", horaFim:"", validoDe:"", validoAte:"" });
  const [dispErr, setDispErr]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h,p,d] = await Promise.all([
        apiFetch<AulaDto[]>(`${API}/professor/horario?offset=${offset}`),
        apiFetch<{ content: CoachingDto[] }>(`${API}/professor/coaching/pendentes`),
        apiFetch<DisponibilidadeDto[]>(`/disponibilidade/minhasdisponibilidades`),
      ]);
      setHorario((h??[]).map(normalizeAula)); setPend(p?.content??[]); setDisps(d??[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  const confirmar = async (id: string) => { await apiFetch(`${API}/professor/coaching/${id}/confirmar`,{method:"PUT"}); load(); };
  const rejeitar  = async (id: string) => { await apiFetch(`${API}/professor/coaching/rejeitar/${id}`,{method:"PUT"}); load(); };
  
  const openCriar = () => {
    setDispForm({ diaSemana:1, horaInicio:"", horaFim:"", validoDe:"", validoAte:"" });
    setEditId(null);
    setDispErr("");
    setIsModalOpen(true);
  };

  const openEditarDisp = (d: DisponibilidadeDto) => {
    setDispForm({ diaSemana: d.diaSemana, horaInicio: d.horaInicio, horaFim: d.horaFim, validoDe: d.validoDe??"", validoAte: d.validoAte??"" });
    setEditId(d.id);
    setDispErr("");
    setIsModalOpen(true);
  };

  const salvarDisp = async () => {
    try {
      setDispErr("");
      if (editId) {
        // Simulação / Chamada de Atualização se suportada pelo endpoint, caso contrário recria
        await apiFetch(`/disponibilidade/professor/${editId}`, { method: "DELETE" });
      }
      await apiFetch(`/disponibilidade/professor`, { method: "POST", body: JSON.stringify(dispForm) });
      setIsModalOpen(false);
      load();
    } catch(e: any) { setDispErr(e.message || String(e)); }
  };

  const removeDisp = async (id: string) => { 
    if(confirm("Remover esta disponibilidade?")) {
      await apiFetch(`/disponibilidade/professor/${id}`,{method:"DELETE"}); 
      load(); 
    }
  };

  // Filtra apenas as disponibilidades válidas (que não expiraram)
  const disponibilidadesValidas = disps.filter(d => d.validoAte ? eFuturo(d.validoAte) : true);

  const TABS = [{ key:"horario", label:"Horário Semanal" },{ key:"coaching", label:"Coachings Pendentes" },{ key:"disponibilidade", label:"Disponibilidade" }] as const;

  return (
    <div>
      <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
      {loading ? <Loader /> : <>
        {tab==="horario" && <GrelhaHorario aulas={horario} titulo={`Horário de ${userName.split(" ")[0]}`} semanaOffset={offset} onPrev={()=>setOffset(o=>o-1)} onNext={()=>setOffset(o=>o+1)} />}

        {tab==="coaching" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", margin: 0 }}>Pedidos de coaching pendentes</h2>
            </div>
            {pendentes.length===0 && <Empty>Sem solicitações pendentes de aprovação.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
              {pendentes.map(c => (
                <div key={c.aulaDto.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"20px", display:"flex", flexDirection:"column", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.01)" }}>
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <span style={{ fontWeight:600, fontSize:15, color:"var(--panel-dark)" }}>{c.modalidadeDto?.nome}</span>
                      <EstadoBadge estado={c.estadoAulaDto.estado} />
                    </div>
                    <div style={{ fontSize:13, color:"var(--accent-muted)", marginBottom:14 }}>
                      📆 {c.aulaDto.dataAula} <br />⏰ {trimHora(c.aulaDto.horaInicio)} – {trimHora(c.aulaDto.horaFim)}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12 }}>
                    <BtnSecundario label="✕ Rejeitar" onClick={()=>rejeitar(c.aulaDto.id)} small />
                    <BtnPrimario   label="✓ Confirmar" onClick={()=>confirmar(c.aulaDto.id)} small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="disponibilidade" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", margin: 0 }}>As minhas disponibilidades</h2>
              <BtnPrimario label="+ Nova Disponibilidade" onClick={openCriar} />
            </div>
            
            {disponibilidadesValidas.length===0 && <Empty>Nenhuma disponibilidade ativa configurada.</Empty>}
            
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16 }}>
              {disponibilidadesValidas.map(d => (
                <div key={d.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"18px", boxShadow:"0 2px 4px rgba(0,0,0,0.01)", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:15, color:"var(--panel-dark)", fontWeight:600, marginBottom:6 }}>
                      🗓️ {DIAS_OPTIONS.find(x=>x.value===d.diaSemana)?.label??d.diaSemana}
                    </div>
                    <div style={{ fontSize:13, color:"var(--panel-dark)", marginBottom:12 }}>
                      ⏰ {trimHora(d.horaInicio)} – {trimHora(d.horaFim)}
                      {d.validoDe && <div style={{ fontSize:11, color:"var(--accent-muted)", marginTop:4 }}>Vigência: {d.validoDe} até {d.validoAte}</div>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12 }}>
                    <BtnSecundario label="Editar" onClick={()=>openEditarDisp(d)} small />
                    <BtnPerigo label="Remover" onClick={()=>removeDisp(d.id)} small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}

      {/* Modal Nova / Editar Disponibilidade */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editId ? "Editar Disponibilidade" : "Nova Disponibilidade"}>
        {dispErr && <ErrMsg msg={dispErr} />}
        <SelectField label="Dia da semana" value={dispForm.diaSemana.toString()} onChange={v=>setDispForm(f=>({...f,diaSemana:parseInt(v)}))} options={DIAS_OPTIONS.map(d=>({value:d.value.toString(),label:d.label}))} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <InputField label="Hora início" type="time" value={dispForm.horaInicio} onChange={v=>setDispForm(f=>({...f,horaInicio:v}))} />
          <InputField label="Hora fim"    type="time" value={dispForm.horaFim}    onChange={v=>setDispForm(f=>({...f,horaFim:v}))} />
          <InputField label="Válido de"   type="date" value={dispForm.validoDe}   onChange={v=>setDispForm(f=>({...f,validoDe:v}))} />
          <InputField label="Válido até"  type="date" value={dispForm.validoAte}  onChange={v=>setDispForm(f=>({...f,validoAte:v}))} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
          <BtnSecundario label="Cancelar" onClick={()=>setIsModalOpen(false)} />
          <BtnPrimario label={editId ? "Salvar Alterações" : "Adicionar"} onClick={salvarDisp} />
        </div>
      </Modal>
    </div>
  );
}

// ─── Vista Coordenação ────────────────────────────────────────────────────────

function CoordenacaoView() {
  const [horarios, setHorarios]   = useState<HorarioFixoDto[]>([]);
  const [turmas, setTurmas]       = useState<TurmaDto[]>([]);
  const [estudios, setEst]        = useState<EstudioDto[]>([]);
  const [professores, setProfs]   = useState<ResumoDto[]>([]);
  const [coachings, setCoachings] = useState<CoachingDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"horarios"|"coaching">("horarios");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId]       = useState<string|null>(null);
  const [err, setErr]             = useState("");
  const [userId]                  = useState(() => typeof window!=="undefined" ? localStorage.getItem("userId")??"" : "");
  
  const emptyForm                 = { idturma:"", estudioId:"", idProfessor:"", dataInicio:"", dataValidade:"", diaSemana:"", horaInicio:"", horaFim:"", duracaoMinutos:0 };
  const [form, setForm]           = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h,t,e,p,c] = await Promise.all([
        apiFetch<{ content: HorarioFixoDto[] }>(`${API}?page=0&size=50`),
        apiFetch<TurmaDto[]>(`/api/turmas`),
        apiFetch<EstudioDto[]>(`/api/estudios`),
        apiFetch<ResumoDto[]>(`/api/professores/selecionar`).catch(()=>[]),
        apiFetch<{ content: CoachingDto[] }>(`${API}/coaching/todos`),
      ]);
      setHorarios(h?.content??[]); setTurmas(t??[]); setEst(e??[]); setProfs(p??[]); setCoachings(c?.content??[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCriar = () => {
    setForm(emptyForm);
    setEditId(null);
    setErr("");
    setIsModalOpen(true);
  };

  const openEdit = (h: HorarioFixoDto) => { 
    setForm({idturma:h.idturmaId?.id??"",estudioId:h.estudioId?.id??"",idProfessor:"",dataInicio:h.dataInicio??"",dataValidade:h.dataValidade??"",diaSemana:h.diaSemana??"",horaInicio:h.horaInicio??"",horaFim:h.horaFim??"",duracaoMinutos:h.duracaoMinutos}); 
    setEditId(h.id); 
    setErr(""); 
    setIsModalOpen(true); 
  };

  const submit = async () => {
    setErr("");
    try {
      const body = { id:editId??null, idcriadoPor:userId, idturma:form.idturma, estudioId:form.estudioId, dataInicio:form.dataInicio, dataValidade:form.dataValidade, diaSemana:form.diaSemana?parseInt(form.diaSemana):null, horaInicio:form.horaInicio, horaFim:form.horaFim, duracaoMinutos:form.duracaoMinutos };
      if (editId) await apiFetch(`${API}/${editId}?idProfessor=${form.idProfessor}`,{method:"PUT",body:JSON.stringify(body)});
      else        await apiFetch(`${API}/criar?idProfessor=${form.idProfessor}`,{method:"POST",body:JSON.stringify(body)});
      setIsModalOpen(false); 
      load();
    } catch(e:unknown) { setErr(String(e)); }
  };

  const del = async (id: string) => { if (!confirm("Eliminar este horário fixo?")) return; await apiFetch(`${API}/${id}`,{method:"DELETE"}); load(); };
  const validarC   = async (id: string) => { await apiFetch(`${API}/coaching/${id}/validar`,{method:"PUT"}); load(); };
  const eliminarC  = async (id: string) => { if (!confirm("Remover este registo de coaching?")) return; await apiFetch(`${API}/coaching/${id}`,{method:"DELETE"}); load(); };
  const f = (k: keyof typeof form, v: string) => setForm(prev=>({...prev,[k]:v}));

  const TABS = [{ key:"horarios", label:"Horários Fixos" },{ key:"coaching", label:"Todos os Coachings" }] as const;

  return (
    <div>
      <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
      {loading ? <Loader /> : <>
        
        {tab==="horarios" && (
          <div>
            <div style={{ marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, color: "var(--panel-dark)", margin: 0 }}>Gestão de Horários Fixos</h2>
              <BtnPrimario label="+ Criar Horário" onClick={openCriar} />
            </div>

            {horarios.length===0 && <Empty>Sem horários fixos registados.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
              {horarios.map(h => (
                <div key={h.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"20px", display:"flex", flexDirection:"column", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.01)" }}>
                  <div>
                    <div style={{ fontSize:15, color:"var(--panel-dark)", fontWeight:600, marginBottom:8 }}>
                      🗓️ {DIAS_OPTIONS.find(d=>d.label===h.diaSemana||d.value.toString()===h.diaSemana)?.label??h.diaSemana} · {trimHora(h.horaInicio)} – {trimHora(h.horaFim)}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                      {h.idturmaId && <span style={{ background:"rgba(44,31,20,0.06)", color:"var(--panel-dark)", borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:500 }}>{h.idturmaId.nome}</span>}
                      {h.estudioId && <span style={{ background:"rgba(160,133,96,0.1)", color:"var(--accent-muted)", borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:500 }}>📍 {h.estudioId.nome}</span>}
                    </div>
                    <div style={{ fontSize:12, color:"var(--accent-muted)", fontWeight:400 }}>
                      Vigência: {h.dataInicio} ➔ {h.dataValidade} <br /> Duração: {h.duracaoMinutos} min
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12, marginTop:12 }}>
                    <BtnSecundario label="Editar" onClick={()=>openEdit(h)} small />
                    <BtnPerigo     label="Eliminar" onClick={()=>del(h.id)} small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="coaching" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, color: "var(--panel-dark)", margin: 0 }}>Histórico Global de Coachings</h2>
            </div>
            {coachings.length===0 && <Empty>Nenhum registo de coaching encontrado.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
              {coachings.map(c => {
                const jaValidado = c.estadoAulaDto?.estado === "VALIDADO";
                return (
                  <div key={c.aulaDto.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"20px", display:"flex", flexDirection:"column", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.01)" }}>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <span style={{ fontSize:15, color:"var(--panel-dark)", fontWeight:600 }}>{c.aulaDto.dataAula}</span>
                        <EstadoBadge estado={c.estadoAulaDto?.estado??"—"} />
                      </div>
                      <div style={{ fontSize:13, color:"var(--panel-dark)", marginBottom:4 }}>
                        ⏰ Horário: {trimHora(c.aulaDto.horaInicio)} – {trimHora(c.aulaDto.horaFim)}
                      </div>
                      {c.professorDto && <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:10 }}>Professor: {c.professorDto.utilizadores?.nome||"Não atribuído"}</div>}
                    </div>
                    <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12 }}>
                      {!jaValidado && <BtnPrimario label="Validar" onClick={()=>validarC(c.aulaDto.id)} small />}
                      <BtnPerigo   label="Eliminar"  onClick={()=>eliminarC(c.aulaDto.id)} small />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>}

      {/* Modal Criar / Editar Horário Fixo */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editId ? "Editar Horário Fixo" : "Novo Horário Fixo"}>
        {err && <ErrMsg msg={err} />}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <SelectField label="Turma"        value={form.idturma}    onChange={v=>f("idturma",v)}    options={turmas.map(t=>({value:t.id,label:t.nome}))}    placeholder="Escolher turma..." />
          <SelectField label="Estúdio"      value={form.estudioId}  onChange={v=>f("estudioId",v)}  options={estudios.map(e=>({value:e.id,label:e.nome}))}   placeholder="Escolher estúdio..." />
          <SelectField label="Professor"    value={form.idProfessor}onChange={v=>f("idProfessor",v)}options={professores.map(p=>({value:p.id,label:p.nome}))} placeholder="Escolher professor..." />
          <SelectField label="Dia da semana"value={form.diaSemana?.toString()||""} onChange={v=>f("diaSemana",v)} options={DIAS_OPTIONS.map(d=>({value:d.value.toString(),label:d.label}))} placeholder="Escolher dia..." />
          <InputField label="Hora início"   type="time" value={form.horaInicio}  onChange={v=>f("horaInicio",v)} />
          <InputField label="Hora fim"      type="time" value={form.horaFim}     onChange={v=>f("horaFim",v)} />
          <InputField label="Data início"   type="date" value={form.dataInicio}  onChange={v=>f("dataInicio",v)} />
          <InputField label="Data validade" type="date" value={form.dataValidade}onChange={v=>f("dataValidade",v)} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
          <BtnSecundario label="Cancelar" onClick={()=>setIsModalOpen(false)} />
          <BtnPrimario label={editId?"Atualizar Horário":"Criar Horário"} onClick={submit} />
        </div>
      </Modal>
    </div>
  );
}

// ─── Micro-componentes de layout adicionais ───────────────────────────────────

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color:"var(--accent-muted)", fontSize:14, fontWeight:400, margin:"12px 0 24px", fontStyle:"italic" }}>{children}</p>;
}
function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:5, textTransform:"uppercase" as const }}>{label}</label>
      <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3}
        style={{ width:"100%", background:"#fff", border:"1px solid var(--border-warm)", borderRadius:6, color:"var(--panel-dark)", padding:"9px 12px", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box", fontFamily:"Lato, sans-serif" }} />
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function HorariosPage() {
  const [role, setRole] = useState<Role|null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const { nome, role } = getUserData();
    setUserName(nome);
    setRole(role);
  }, []);

  const roleLabel: Record<Role, string> = {
    ALUNO:       "Aluno",
    ENCARREGADO: "Encarregado",
    PROFESSOR:   "Professor",
    COORDENACAO: "Coordenação",
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom:28 }}>
        <p style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--accent-muted)", fontWeight:400, marginBottom:4 }}>
          {role ? roleLabel[role] : "—"}
        </p>
        <h1 style={{ fontFamily:"var(--font-playfair)", fontSize:26, color:"var(--panel-dark)", fontWeight:400, marginBottom:0 }}>
          Horários e Sessões
        </h1>
      </div>

      {!role ? (
        <div style={{ textAlign:"center", padding:80 }}>
          <p style={{ fontFamily:"var(--font-playfair)", fontSize:20, color:"var(--panel-dark)", marginBottom:8 }}>Sem sessão iniciada</p>
          <p style={{ fontSize:13, color:"var(--accent-muted)" }}>Por favor, faz login para aceder.</p>
        </div>
      ) : (
        <>
          {role==="ALUNO"       && <AlunoView       userName={userName} />}
          {role==="ENCARREGADO" && <EncarregadoView />}
          {role==="PROFESSOR"   && <ProfessorView   userName={userName} />}
          {role==="COORDENACAO" && <CoordenacaoView />}
        </>
      )}
    </>
  );
}