"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface ResumoDto { id: string; nome: string }
interface TurmaDto   { id: string; nome: string; mensalidade?: number; ativo?: boolean; modalidade?: ResumoDto }
interface EstudioDto { id: string; nome: string; capacidade?: number; notas?: string }
interface AulaDto    {
  id: string; titulo?: string; dataAula?: string; horaInicio?: string; horaFim?: string;
  turma?: TurmaDto; estudio?: EstudioDto; professor?: ResumoDto; diaSemana?: string | number;
  maxAlunos?: number; solicitadoPor?: ResumoDto;
}
interface CoachingDto {
  aulaDto: { id: string; dataAula: string; horaInicio: string; horaFim: string; duracaoMinutos: number; estudio?: EstudioDto; notas?: string };
  modalidadeDto: { id: string; nome: string };
  estadoAulaDto: { id: string; estado: string };
  max_alunos: number;
  professorDto?: any;
  solicitadoPor?: { id: string; nome: string };
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
interface ModalidadeDto { id: string; nome: string; descricao?: string }

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
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", 
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
];// Substitua as linhas antigas por estas:
const AULA_CORES       = ["#FFFFFF"];
const AULA_CORES_BORDA = ["#E6E6E6"];
const AULA_CORES_TEXTO = ["#2C1F14"];

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
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined as T;
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
    id:            a.id,
    titulo:        a.titulo        ?? h.titulo,
    dataAula:      a.dataAula      ?? h.dataAula,
    horaInicio:    trimHora(a.horaInicio ?? h.horaInicio),
    horaFim:       trimHora(a.horaFim    ?? h.horaFim),
    diaSemana:     diaDerived,
    turma:         a.turma         ?? h.idturmaId,
    estudio:       a.estudio       ?? h.estudioId ?? a.estudioId,
    professor:     a.professor     ?? h.professor ?? (h.idcriadoPor && h.professor ? h.idcriadoPor : undefined),
    maxAlunos:     a.maxAlunos     ?? undefined,
    solicitadoPor: a.solicitadoPor ?? undefined,
  };
}

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

function eFuturo(dataStr: string, horaFimStr?: string): boolean {
  if (!dataStr) return true;
  const horaLimpa = horaFimStr ? horaFimStr.substring(0, 5) : "23:59";
  const dataAula = new Date(`${dataStr}T${horaLimpa}:00`);
  return dataAula >= new Date();
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
  return <div style={{ color: "#c0392b", padding: "10px 14px", background: "#fde8e8", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #f5c6cb" }}>Aviso: {msg}</div>;
}
function OkMsg({ msg }: { msg: string }) {
  return <div style={{ color: "#27ae60", padding: "10px 14px", background: "#eafaf1", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #a9dfbf" }}>Sucesso: {msg}</div>;
}


// ─── Toast Notifications ──────────────────────────────────────────────────────

type ToastType = "sucesso" | "erro";
interface Toast { id: number; msg: string; tipo: ToastType }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:10, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          pointerEvents:"auto", display:"flex", alignItems:"center", gap:10,
          background: t.tipo === "sucesso" ? "#1a3c2e" : "#3c1a1a",
          color:"#fff", borderRadius:10, padding:"12px 18px", fontSize:13, fontWeight:500,
          boxShadow:"0 8px 24px rgba(0,0,0,0.18)", minWidth:260, maxWidth:360,
          animation:"slideInToast 0.25s ease",
        }}>
          <span style={{ fontSize:18 }}>{t.tipo === "sucesso" ? "✓" : "✕"}</span>
          <span style={{ flex:1 }}>{t.msg}</span>
          <button onClick={() => onRemove(t.id)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:16, lineHeight:1, padding:0 }}>×</button>
        </div>
      ))}
    </div>
  );
}

let _toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = (msg: string, tipo: ToastType = "sucesso", duracao = 3500) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, msg, tipo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duracao);
  };
  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, show, remove };
}

function EstadoBadge({ estado }: { estado: string }) {
  const cores: Record<string, { bg: string; text: string; label: string }> = {
    CONFIRMADO:   { bg: "#d4edda", text: "#155724", label: "CONFIRMADO" },
    VALIDADO:     { bg: "#d1ecf1", text: "#0c5460", label: "VALIDADO" },
    PENDENTE:     { bg: "#fff3cd", text: "#856404", label: "PENDENTE" },
    AGENDADO:     { bg: "#fff3cd", text: "#856404", label: "AGENDADO" },
    LISTA_ESPERA: { bg: "#fce4ec", text: "#880e4f", label: "LISTA DE ESPERA" },
    CANCELADO:    { bg: "#f8d7da", text: "#721c24", label: "CANCELADO" },
  };
  const c = cores[estado?.toUpperCase()] ?? { bg: "#e9ecef", text: "#495057", label: estado };
  return <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 700, letterSpacing: .5 }}>{c.label}</span>;
}

const btnBase: React.CSSProperties = { borderRadius: 6, fontWeight: 700, cursor: "pointer", letterSpacing: .3, fontFamily: "Lato, sans-serif", transition: "opacity .15s" };
function BtnPrimario({ label, onClick, small }: { label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "var(--panel-dark)", border: "none", color: "var(--accent-gold)", fontSize: small ? 11 : 13, padding: small ? "6px 14px" : "10px 22px" }}>{label}</button>;
}
function BtnSecundario({ label, onClick, small }: { label: string; onClick: () => void | Promise<void>; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "transparent", border: "1px solid var(--panel-dark)", color: "var(--panel-dark)", fontSize: small ? 11 : 13, padding: small ? "5px 13px" : "9px 21px" }}>{label}</button>;
}
function BtnPerigo({ label, onClick, small }: { label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; small?: boolean }) {
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
function TextareaField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 400, letterSpacing: 2, color: "var(--accent-muted)", marginBottom: 5, textTransform: "uppercase" as const }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        style={{ width: "100%", background: "#fff", border: "1px solid var(--border-warm)", borderRadius: 6, color: "var(--panel-dark)", padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const, fontFamily: "inherit" }} />
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
  const HORA_INICIO = 8;
  const HORA_FIM    = 23;
  const TOTAL_MIN   = (HORA_FIM - HORA_INICIO) * 60;
  const PX_POR_HORA = 56;
  const ALTURA      = (TOTAL_MIN / 60) * PX_POR_HORA;

  const [aulaSelecionada, setAulaSelecionada] = useState<AulaDto | null>(null);

  const aulasPorDia: AulaDto[][] = Array.from({ length: 7 }, () => []);
  aulas.forEach(a => {
    const i = diaParaIdx(a.diaSemana);
    const minInicio = horaParaMin(a.horaInicio ?? "00:00");
    const minLimiteInicio = HORA_INICIO * 60;
    const minLimiteFim = HORA_FIM * 60;
    
    if (i >= 0 && minInicio >= minLimiteInicio && minInicio < minLimiteFim) {
      aulasPorDia[i].push(a);
    }
  });

  const pos  = (h: string) => ((horaParaMin(h) - (HORA_INICIO * 60)) / TOTAL_MIN) * ALTURA;
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
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", background: "#EEEEEE", borderBottom: "1px solid var(--border-warm)", position: "sticky", top: 0, zIndex: 2 }}>            <div />
            {DIAS.map(dia => (
              <div key={dia} style={{ borderLeft: "1px solid var(--border-warm)", padding: "8px 4px", textAlign: "center", fontSize: 10, fontWeight: 400, letterSpacing: 2, color: "#BFAE9E" }}>
                {dia}
              </div>
            ))}
          </div>

          <div style={{ overflowY: "auto", maxHeight: 560 }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)" }}>
              <div style={{ position: "relative", height: ALTURA }}>
                {HORAS.map((h, i) => {
                  const top = pos(h);
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
                    const top = pos(h);
                    return <div key={h} style={{ position: "absolute", top, left: 0, right: 0, borderTop: i === 0 ? "none" : "1px solid #F5F0EA", height: 1 }} />;
                  })}
                  {aulasPorDia[dIdx].map((a, aIdx) => {
  const top    = pos(a.horaInicio ?? "08:00");
  const height = alto(a.horaInicio ?? "08:00", a.horaFim ?? "09:00");
  
  return (
    <div 
      key={a.id} 
      onClick={() => setAulaSelecionada(a)}
      style={{ 
        position: "absolute", 
        top: top + 1, 
        left: 3, 
        right: 3, 
        height: height - 2, 
        background: "#FFFFFF",                        // <--- Força Branco
        border: "1px solid #E6E6E6",                 // <--- Borda cinza clara neutra
        borderLeft: "3px solid var(--accent-muted)", // <--- Detalhe lateral discreto
        borderRadius: 4, 
        padding: "3px 5px", 
        overflow: "hidden", 
        cursor: "pointer",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"       // <--- Dá relevo para se notar que é um cartão
      }}
    >
      {/* Texto com cor escura fixa para leitura perfeita no fundo branco */}
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--panel-dark)", lineHeight: 1.2 }}>
        {a.turma?.nome ?? a.titulo ?? "Aula"}
      </div>
      <div style={{ fontSize: 9, color: "var(--panel-dark)", opacity: .8, marginTop: 1 }}>
        {trimHora(a.horaInicio)} – {trimHora(a.horaFim)}
      </div>
      {height > 36 && a.professor && (
        <div style={{ fontSize: 9, color: "var(--panel-dark)", opacity: .65 }}>
          {a.professor.nome}
        </div>
      )}
    </div>
  );
})}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!aulaSelecionada} onClose={() => setAulaSelecionada(null)} title="Detalhes da Aula">
        {aulaSelecionada && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
              <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Título / Turma:</span>{" "}
              <strong>{aulaSelecionada.titulo ?? aulaSelecionada.turma?.nome ?? "Aula Regular"}</strong>
            </div>
            {aulaSelecionada.dataAula && (
              <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
                <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Data:</span>{" "}
                <strong>{aulaSelecionada.dataAula}</strong>
              </div>
            )}
            <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
              <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Horário:</span>{" "}
              <strong>{trimHora(aulaSelecionada.horaInicio)} às {trimHora(aulaSelecionada.horaFim)}</strong>
            </div>

            <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
              <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Professor:</span>{" "}
              <NomeProfessorLazy idAula={aulaSelecionada.id} professorFallback={aulaSelecionada.professor?.nome ?? "Não atribuído"} />
            </div>

            {aulaSelecionada.estudio && (
              <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
                <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Estúdio / Local:</span>{" "}
                <span>{aulaSelecionada.estudio.nome}</span>
              </div>
            )}
            {aulaSelecionada.turma?.modalidade && (
              <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
                <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Modalidade:</span>{" "}
                <span>{aulaSelecionada.turma.modalidade.nome}</span>
              </div>
            )}
            {aulaSelecionada.solicitadoPor && (
              <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
                <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Pedido por:</span>{" "}
                <strong>{aulaSelecionada.solicitadoPor.nome}</strong>
              </div>
            )}
            {aulaSelecionada.maxAlunos != null && (
              <div style={{ fontSize: 14, color: "var(--panel-dark)" }}>
                <span style={{ color: "var(--accent-muted)", fontWeight: 500 }}>Máx. alunos:</span>{" "}
                <strong>{aulaSelecionada.maxAlunos}</strong>
              </div>
            )}
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <BtnSecundario label="Fechar" onClick={() => setAulaSelecionada(null)} />
            </div>
          </div>
        )}
      </Modal>
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
      {dataErro && <div style={{ color: "#721c24", padding: "10px 14px", background: "#f8d7da", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #f5c6cb" }}>Aviso: {dataErro}</div>}

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

// ─── Componente Auxiliar para Carregar o Professor via API (Corrigido) ───

function NomeProfessorLazy({ idAula, professorFallback }: { idAula: string; professorFallback: string }) {
  const [nomes, setNomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idAula || idAula === "undefined") {
      console.warn("NomeProfessorLazy: idAula não foi fornecido ou é inválido.");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log(`[NomeProfessorLazy] A iniciar pedido para a aula: ${idAula}`);

    apiFetch<string[]>(`/api/professores/nomebyAula/${idAula}`)
      .then((data) => {
        console.log(`[NomeProfessorLazy] Resposta para a aula ${idAula}:`, data);
        setNomes(data || []);
      })
      .catch((err) => {
        console.error(`[NomeProfessorLazy] Erro ao contactar a API para a aula ${idAula}:`, err);
        setNomes([]);
      })
      .finally(() => setLoading(false));
  }, [idAula]);

  if (loading) return <span style={{ color: "var(--accent-muted)", fontSize: 12, fontStyle: "italic" }}>A carregar...</span>;
  
  if (nomes && nomes.length > 0) {
    return <strong>{nomes.join(", ")}</strong>;
  }
  
  return <strong>{professorFallback}</strong>;
}

// ─── Componente Comum de Grelha de Coachings ───────────────────────────────────

function CoachingGrid({ items, onAction, actionLabel, actionPerigo }: { items: CoachingDto[]; onAction: (id: string) => void; actionLabel: string; actionPerigo?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
      {items.map(c => {
        const estadoAtual = c.estadoAulaDto?.estado?.toUpperCase() ?? "PENDENTE";
        const isBotaoCancelar = actionLabel.toLowerCase().includes("cancelar");
        const deveMostrarBotao = !isBotaoCancelar || (estadoAtual === "AGENDADO" || estadoAtual === "PENDENTE");

        const horario = (c.aulaDto as any)?.idHorario;
        const nomeProfessorOriginal = 
          c.professorDto?.nome || 
          c.professorDto?.utilizadores?.nome || 
          c.professorDto?.utilizador?.nome ||
          horario?.professor?.nome || 
          horario?.idcriadoPor?.nome || 
          "Não atribuído";

        return (
          <div key={c.aulaDto.id} style={{ background: "#fff", border: "1px solid var(--border-warm)", borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                <div style={{ fontFamily: "var(--font-playfair)", fontWeight: 600, fontSize: 16, color: "var(--panel-dark)" }}>{c.modalidadeDto?.nome || "Sessão de Coaching"}</div>
                <EstadoBadge estado={c.estadoAulaDto?.estado ?? "PENDENTE"} />
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, borderTop: "1px solid #FAF8F5", paddingTop: 12 }}>
                <div style={{ fontSize: 13, color: "var(--panel-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--accent-muted)" }}>Data:</span> <strong>{c.aulaDto.dataAula}</strong>
                </div>
                <div style={{ fontSize: 13, color: "var(--panel-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--accent-muted)" }}>Horário:</span> <strong>{trimHora(c.aulaDto.horaInicio)} – {trimHora(c.aulaDto.horaFim)}</strong>
                </div>
                
                <div style={{ fontSize: 13, color: "var(--panel-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--accent-muted)" }}>Professor:</span> 
                  {/* O idAula aqui passado garante a chamada única por cartão */}
                  <NomeProfessorLazy idAula={c.aulaDto.id} professorFallback={nomeProfessorOriginal} />
                </div>

                {c.aulaDto.estudio && (
                  <div style={{ fontSize: 13, color: "var(--panel-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--accent-muted)" }}>Estúdio:</span> <span>{c.aulaDto.estudio.nome}</span>
                  </div>
                )}
              </div>
            </div>
            
            {deveMostrarBotao && (
              <div style={{ borderTop: "1px solid #FAF8F5", paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
                {actionPerigo
                  ? <BtnPerigo   label={actionLabel} onClick={() => onAction(c.aulaDto.id)} small />
                  : <BtnPrimario label={actionLabel} onClick={() => onAction(c.aulaDto.id)} small />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Horários Gerais (partilhado por Aluno, Professor, Encarregado) ───────────

function GrelhaGeral() {
  const [horarios, setHorarios]   = useState<HorarioFixoDto[]>([]);
  const [turmas, setTurmas]       = useState<TurmaDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [offset, setOffset]       = useState(0);
  const [turmaFiltro, setTurmaFiltro] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ content: HorarioFixoDto[] }>(`${API}?page=0&size=200`),
      apiFetch<TurmaDto[]>(`/api/turmas`),
    ]).then(([h, t]) => {
      setHorarios(h?.content ?? []);
      setTurmas(t ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  const hoje = new Date();
  const diaAtual = hoje.getDay() === 0 ? 7 : hoje.getDay();
  const segundaSemana = new Date(hoje);
  segundaSemana.setDate(hoje.getDate() - (diaAtual - 1) + offset * 7);
  segundaSemana.setHours(0, 0, 0, 0);
  const domingoSemana = new Date(segundaSemana);
  domingoSemana.setDate(segundaSemana.getDate() + 6);
  domingoSemana.setHours(23, 59, 59, 999);

  const turmasAtivas = turmas.filter(t => t.ativo !== false);

  const todasAulas: AulaDto[] = horarios
    .filter(h => {
      if (!turmasAtivas.some(t => t.id === h.idturmaId?.id)) return false;
      const inicio   = h.dataInicio   ? new Date(h.dataInicio   + "T00:00:00") : null;
      const validade = h.dataValidade ? new Date(h.dataValidade + "T23:59:59") : null;
      if (inicio   && inicio   > domingoSemana) return false;
      if (validade && validade < segundaSemana)  return false;
      return true;
    })
    .map(h => ({ ...normalizeAula(h), turma: h.idturmaId }));

  const aulasGrelha = turmaFiltro
    ? todasAulas.filter(a => a.turma?.id === turmaFiltro)
    : todasAulas;

  const turmasFiltro = turmasAtivas.filter(t =>
    horarios.some(h => h.idturmaId?.id === t.id)
  );

  const titulo = turmaFiltro
    ? (turmasAtivas.find(t => t.id === turmaFiltro)?.nome ?? "Turma selecionada")
    : `${aulasGrelha.length} aula${aulasGrelha.length !== 1 ? "s" : ""} nesta semana`;

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, color: "var(--panel-dark)", margin: 0 }}>
          Horários Gerais
        </h2>
        {turmasFiltro.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" as const, color: "var(--accent-muted)", fontWeight: 400 }}>Filtrar por turma</label>
            <select
              value={turmaFiltro}
              onChange={e => setTurmaFiltro(e.target.value)}
              style={{ background: "#fff", border: "1px solid var(--border-warm)", borderRadius: 6, color: "var(--panel-dark)", padding: "8px 12px", fontSize: 13, outline: "none", cursor: "pointer", minWidth: 200 }}
            >
              <option value="">Todas as turmas</option>
              {turmasFiltro.map(t => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {aulasGrelha.length === 0
        ? <p style={{ color: "var(--accent-muted)", fontSize: 14, fontStyle: "italic" }}>Sem horários válidos para esta semana{turmaFiltro ? " e turma selecionada" : ""}.</p>
        : <GrelhaHorario
            aulas={aulasGrelha}
            titulo={titulo}
            semanaOffset={offset}
            onPrev={() => setOffset(o => o - 1)}
            onNext={() => setOffset(o => o + 1)}
          />
      }
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
  const [tab, setTab]               = useState<"horario"|"coaching"|"disponiveis"|"grelha">("horario");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [verPassados, setVerPassados] = useState(false);
  const [err, setErr]               = useState("");
  const [ok, setOk]                 = useState("");

  const carregarDados = useCallback(() => {
    setLoading(true);
    const urlSemana = educandoId ? `${API}/semana/educando/${educandoId}?offset=${offset}` : `${API}/semana?offset=${offset}`;
    const urlCoaching = educandoId ? `${API}/coaching/educando/${educandoId}` : `${API}/coaching`;
    const urlDisp = educandoId 
      ? `${API}/coachingsdisponiveis/educando/${educandoId}` 
      : `${API}/coachingsdisponiveis`;
      
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

  const inscriver = async (id: string) => {
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
      setOk(`Pedido de coaching enviado com sucesso no estúdio [ ${estudio} ]!`);
      carregarDados();
      setTimeout(() => setIsModalOpen(false), 2200);
    } catch (e: any) { setErr(e.message || "Erro ao marcar coaching."); }
  };

  const coachingsFiltrados = coaching.filter(c => {
    const estado = c.estadoAulaDto?.estado?.toUpperCase() || "PENDENTE";
    const estadosAtivos = ["AGENDADO", "PENDENTE", "CONFIRMADO"];
    
    if (verPassados) {
      return estado === "CANCELADO" || !estadosAtivos.includes(estado);
    } else {
      return estadosAtivos.includes(estado) && estado !== "CANCELADO";
    }
  });

  const disponiveisFiltrados = disponiveis.filter(c => eFuturo(c.aulaDto.dataAula, c.aulaDto.horaFim));

  const TABS = [{ key:"horario", label:"Aulas" },{ key:"coaching", label:"Coaching" },{ key:"disponiveis", label:"Disponíveis"},    { key:"grelha",      label:"Horários Gerais" }] as const;

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
            <CoachingGrid items={disponiveisFiltrados} onAction={(id) => inscriver(id)} actionLabel="Inscrever na Sessão" />
          </div>
        )}

        {tab === "grelha" && <GrelhaGeral />}
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
  const [tab, setTab]           = useState<"horario"|"coaching"|"disponibilidade"|"grelha">("horario");
  const [loading, setLoading]   = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  
  const [dispForm, setDispForm] = useState({ diaSemana:1, horaInicio:"", horaFim:"", validoDe:"", validoAte:"" });
  const [dispErr, setDispErr]   = useState("");
  const { toasts, show: showToast, remove: removeToast } = useToast();

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

  const confirmar = async (id: string) => {
    try {
      await apiFetch(`${API}/professor/coaching/${id}/confirmar`, { method: "PUT" });
      setPend(prev => prev.filter(c => c.aulaDto.id !== id));
      showToast("Coaching confirmado com sucesso!", "sucesso");
    } catch (e) {
      console.error("Erro ao confirmar coaching:", e);
      showToast("Erro ao confirmar o coaching.", "erro");
      load();
    }
  };
  const rejeitar = async (id: string) => {
    try {
      await apiFetch(`${API}/professor/coaching/rejeitar/${id}`, { method: "PUT" });
      setPend(prev => prev.filter(c => c.aulaDto.id !== id));
      showToast("Pedido de coaching rejeitado.", "erro");
    } catch (e) {
      console.error("Erro ao rejeitar coaching:", e);
      showToast("Erro ao rejeitar o coaching.", "erro");
      load();
    }
  };
  
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

  const disponibilidadesValidas = disps.filter(d => d.validoAte ? eFuturo(d.validoAte) : true);

  const TABS = [{ key:"horario", label:"Horário Semanal" },{ key:"coaching", label:"Coachings Pendentes" },{ key:"disponibilidade", label:"Disponibilidade"},    { key:"grelha",      label:"Horários Gerais" }] as const;

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
              {pendentes.map(c => {
                const diaSemana = c.aulaDto.dataAula
                  ? (() => { const d = new Date(c.aulaDto.dataAula + "T00:00:00"); return DIAS[d.getDay() === 0 ? 6 : d.getDay() - 1]; })()
                  : "—";
                return (
                <div key={c.aulaDto.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"20px", display:"flex", flexDirection:"column", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.01)" }}>
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontWeight:600, fontSize:15, color:"var(--panel-dark)", fontFamily:"var(--font-playfair)" }}>{c.modalidadeDto?.nome}</span>
                      <EstadoBadge estado={c.estadoAulaDto.estado} />
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:13, color:"var(--panel-dark)", borderTop:"1px solid #FAF8F5", paddingTop:10 }}>
                      {c.solicitadoPor && (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <i className="ti ti-user" style={{ color:"var(--accent-muted)", fontSize:13 }} />
                          <span style={{ color:"var(--accent-muted)" }}>Pedido por:</span>
                          <strong>{c.solicitadoPor.nome}</strong>
                        </div>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <i className="ti ti-calendar" style={{ color:"var(--accent-muted)", fontSize:13 }} />
                        <span style={{ color:"var(--accent-muted)" }}>Data:</span>
                        <strong>{c.aulaDto.dataAula}</strong>
                        <span style={{ background:"#f0ede8", color:"var(--panel-dark)", borderRadius:4, padding:"1px 8px", fontSize:11, fontWeight:600, marginLeft:4 }}>{diaSemana}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <i className="ti ti-clock" style={{ color:"var(--accent-muted)", fontSize:13 }} />
                        <span style={{ color:"var(--accent-muted)" }}>Horário:</span>
                        <strong>{trimHora(c.aulaDto.horaInicio)} – {trimHora(c.aulaDto.horaFim)}</strong>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <i className="ti ti-users" style={{ color:"var(--accent-muted)", fontSize:13 }} />
                        <span style={{ color:"var(--accent-muted)" }}>Máx. alunos:</span>
                        <strong>{c.max_alunos}</strong>
                      </div>
                      {c.aulaDto.estudio && (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <i className="ti ti-building" style={{ color:"var(--accent-muted)", fontSize:13 }} />
                          <span style={{ color:"var(--accent-muted)" }}>Estúdio:</span>
                          <strong>{c.aulaDto.estudio.nome}</strong>
                        </div>
                      )}
                      {c.aulaDto.notas && (
                        <div style={{ marginTop:6, padding:"10px 12px", background:"#f8f6f2", borderRadius:8, borderLeft:"3px solid var(--accent-gold)" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                            <i className="ti ti-notes" style={{ color:"var(--accent-muted)", fontSize:13 }} />
                            <span style={{ color:"var(--accent-muted)", fontSize:12, letterSpacing:1, textTransform:"uppercase", fontWeight:500 }}>Notas</span>
                          </div>
                          <span style={{ fontSize:13, color:"var(--panel-dark)", lineHeight:1.5 }}>{c.aulaDto.notas}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12, marginTop:14 }}>
                    <BtnSecundario label="Rejeitar" onClick={()=>rejeitar(c.aulaDto.id)} small />
                    <BtnPrimario   label="Confirmar" onClick={()=>confirmar(c.aulaDto.id)} small />
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {tab==="disponibilidade" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", margin: 0 }}>As minhas disponibilidades</h2>
              <BtnPrimario label="+ Nova Disponibilidade" onClick={openCriar} />
            </div>
            
            {disponibilidadesValidas.length===0 && <Empty>Nenhuma disponibilidade activa configurada.</Empty>}
            
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16 }}>
              {disponibilidadesValidas.map(d => (
                <div key={d.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"18px", boxShadow:"0 2px 4px rgba(0,0,0,0.01)", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:15, color:"var(--panel-dark)", fontWeight:600, marginBottom:6 }}>
                      Dia: {DIAS_OPTIONS.find(x=>x.value===d.diaSemana)?.label??d.diaSemana}
                    </div>
                    <div style={{ fontSize:13, color:"var(--panel-dark)", marginBottom:12 }}>
                      Horário: {trimHora(d.horaInicio)} – {trimHora(d.horaFim)}
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

        {tab==="grelha" && <GrelhaGeral />}
      </>}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
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

// Helper: get pretty day label from diaSemana (string label or number)
function diaLabel(diaSemana: string | number | undefined): string {
  if (diaSemana === undefined || diaSemana === null) return "—";
  const opt = DIAS_OPTIONS.find(d => d.label === diaSemana || d.value.toString() === String(diaSemana) || d.value === diaSemana);
  return opt?.label ?? String(diaSemana);
}

// ─── Horário Card (pretty, consistent with aluno/professor style) ─────────────
function HorarioCard({ h, onEdit, onDel }: { h: HorarioFixoDto; onEdit: () => void; onDel: () => void }) {
  const diaIdx  = diaParaIdx(h.diaSemana);
  const corIdx  = diaIdx >= 0 ? diaIdx % AULA_CORES.length : 0;
  const bg      = AULA_CORES[corIdx];
  const border  = AULA_CORES_BORDA[corIdx];
  const texto   = AULA_CORES_TEXTO[corIdx];

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 6px rgba(0,0,0,0.04)", transition: "transform .15s", cursor: "default" }}>
      <div>
        {/* Day pill + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ background: border, color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const }}>
            {diaLabel(h.diaSemana)}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: texto, letterSpacing: 0.3 }}>
            {trimHora(h.horaInicio)} – {trimHora(h.horaFim)}
          </span>
        </div>

        {/* Turma + Estúdio chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {h.idturmaId && (
            <span style={{ background: "rgba(255,255,255,0.7)", color: texto, border: `1px solid ${border}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
              <i className="ti ti-users" style={{ marginRight: 4, fontSize: 10 }} />{h.idturmaId.nome}
            </span>
          )}
          {h.estudioId && (
            <span style={{ background: "rgba(255,255,255,0.55)", color: texto, border: `1px solid ${border}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
              <i className="ti ti-building" style={{ marginRight: 4, fontSize: 10 }} />{h.estudioId.nome}
            </span>
          )}
        </div>

        {/* Dates + duration */}
        <div style={{ fontSize: 11, color: texto, opacity: 0.75, lineHeight: 1.6 }}>
          <i className="ti ti-calendar" style={{ marginRight: 4 }} />
          {h.dataInicio} → {h.dataValidade}
          <span style={{ marginLeft: 10, background: "rgba(255,255,255,0.5)", borderRadius: 4, padding: "1px 7px" }}>
            {h.duracaoMinutos} min
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: `1px solid ${border}`, paddingTop: 12, marginTop: 12 }}>
        <BtnSecundario label="Editar"    onClick={onEdit} small />
        <BtnPerigo     label="Eliminar"  onClick={onDel}  small />
      </div>
    </div>
  );
}

function CoordenacaoView() {
  const [horarios, setHorarios]       = useState<HorarioFixoDto[]>([]);
  const [turmas, setTurmas]           = useState<TurmaDto[]>([]);
  const [estudios, setEst]            = useState<EstudioDto[]>([]);
  const [modalidades, setModal]       = useState<ModalidadeDto[]>([]);
  const [professores, setProfs]       = useState<ResumoDto[]>([]);
  const [coachings, setCoachings]     = useState<CoachingDto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"horarios"|"turmas"|"modalidades"|"estudios"|"coaching"|"grelha">("horarios");
  const [grelhaOffset, setGrelhaOffset]       = useState(0);
  const [grelhaTurmaFiltro, setGrelhaTurmaFiltro] = useState<string>("");

  // ── Horário modal ──────────────────────────────────────────────────────────
  const [horModalOpen, setHorModalOpen]   = useState(false);
  const [editHorId, setEditHorId]         = useState<string|null>(null);
  const [horErr, setHorErr]               = useState("");
  const emptyHorForm = { idturma:"", estudioId:"", idProfessor:"", dataInicio:"", dataValidade:"", diaSemana:"", horaInicio:"", horaFim:"", duracaoMinutos:0 };
  const [horForm, setHorForm]             = useState(emptyHorForm);

  // ── Turma modal ───────────────────────────────────────────────────────────
  const [turmaModalOpen, setTurmaModalOpen] = useState(false);
  const [editTurmaId, setEditTurmaId]       = useState<string|null>(null);
  const [turmaErr, setTurmaErr]             = useState("");
  const [turmaForm, setTurmaForm]           = useState({ nome:"", mensalidade:"", modalidadeId:"", ativo: true });

  // ── Modalidade modal ──────────────────────────────────────────────────────
  const [modModalOpen, setModModalOpen] = useState(false);
  const [modErr, setModErr]             = useState("");
  const [modNome, setModNome]           = useState("");
  const [modDescricao, setModDescricao] = useState("");

  // ── Estúdio modal (criar/editar) ──────────────────────────────────────────
  const [estModalOpen, setEstModalOpen]       = useState(false);
  const [editEstId, setEditEstId]             = useState<string|null>(null);
  const [estErr, setEstErr]                   = useState("");
  const [estNome, setEstNome]                 = useState("");
  const [estCapacidade, setEstCapacidade]     = useState<number|"">("");
  const [estNotas, setEstNotas]               = useState("");

  // ── Estúdio: modal de associações ─────────────────────────────────────────
  const [assocModalOpen, setAssocModalOpen]           = useState(false);
  const [assocEstudio, setAssocEstudio]               = useState<EstudioDto|null>(null);
  const [modalidadesAssociadas, setModalidadesAssoc]  = useState<ModalidadeDto[]>([]);
  const [modalidadesDisponiveis, setModalidadesDisp]  = useState<ModalidadeDto[]>([]);
  const [loadingAssoc, setLoadingAssoc]               = useState(false);
  const [assocErr, setAssocErr]                       = useState("");

  const [userId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("userId") ?? "" : "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h,t,e,m,p,c] = await Promise.all([
        apiFetch<{ content: HorarioFixoDto[] }>(`${API}?page=0&size=50`),
        apiFetch<TurmaDto[]>(`/api/turmas`),
        apiFetch<EstudioDto[]>(`/api/estudios`),
        apiFetch<ModalidadeDto[]>(`/api/modalidades`).catch(()=>[]),
        apiFetch<ResumoDto[]>(`/api/professores/selecionar`).catch(()=>[]),
        apiFetch<{ content: CoachingDto[] }>(`${API}/coaching/todos`),
      ]);
      setHorarios(h?.content??[]); setTurmas(t??[]); setEst(e??[]); setModal(m??[]); setProfs(p??[]); setCoachings(c?.content??[]);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Horário CRUD ──────────────────────────────────────────────────────────
  const openCriarHor = () => { setHorForm(emptyHorForm); setEditHorId(null); setHorErr(""); setHorModalOpen(true); };
  const openEditHor  = (h: HorarioFixoDto) => {
    setHorForm({ idturma:h.idturmaId?.id??"", estudioId:h.estudioId?.id??"", idProfessor:"", dataInicio:h.dataInicio??"", dataValidade:h.dataValidade??"", diaSemana:h.diaSemana??"", horaInicio:h.horaInicio??"", horaFim:h.horaFim??"", duracaoMinutos:h.duracaoMinutos });
    setEditHorId(h.id); setHorErr(""); setHorModalOpen(true);
  };
  const submitHor = async () => {
    setHorErr("");
    try {
      const body = { id:editHorId??null, idcriadoPor:userId, idturma:horForm.idturma, estudioId:horForm.estudioId, dataInicio:horForm.dataInicio, dataValidade:horForm.dataValidade, diaSemana:horForm.diaSemana?parseInt(horForm.diaSemana):null, horaInicio:horForm.horaInicio, horaFim:horForm.horaFim, duracaoMinutos:horForm.duracaoMinutos };
      if (editHorId) await apiFetch(`${API}/${editHorId}?idProfessor=${horForm.idProfessor}`,{method:"PUT",body:JSON.stringify(body)});
      else           await apiFetch(`${API}/criar?idProfessor=${horForm.idProfessor}`,{method:"POST",body:JSON.stringify(body)});
      setHorModalOpen(false); load();
    } catch(e:unknown) { setHorErr(String(e)); }
  };
  const delHor = async (id: string) => { if (!confirm("Eliminar este horário fixo?")) return; await apiFetch(`${API}/${id}`,{method:"DELETE"}); load(); };

  // ── Turma CRUD ────────────────────────────────────────────────────────────
  const openCriarTurma = () => { setTurmaForm({ nome:"", mensalidade:"", modalidadeId:"", ativo: true }); setEditTurmaId(null); setTurmaErr(""); setTurmaModalOpen(true); };
  const openEditTurma  = (t: TurmaDto) => { setTurmaForm({ nome:t.nome, mensalidade: t.mensalidade?.toString()??"", modalidadeId:t.modalidade?.id??"", ativo: t.ativo ?? true }); setEditTurmaId(t.id); setTurmaErr(""); setTurmaModalOpen(true); };
  const submitTurma = async () => {
    setTurmaErr("");
    if (!turmaForm.modalidadeId) { setTurmaErr("A modalidade é obrigatória."); return; }
    try {
      const modalidadeSel = modalidades.find(m => m.id === turmaForm.modalidadeId);
      const body = {
        nome: turmaForm.nome,
        ativo: turmaForm.ativo,
        mensalidade: turmaForm.mensalidade ? parseFloat(turmaForm.mensalidade) : null,
        modalidade: modalidadeSel ? { id: modalidadeSel.id, nome: modalidadeSel.nome } : null,
      };
      if (editTurmaId) await apiFetch(`/api/turmas/${editTurmaId}`,{method:"PUT",body:JSON.stringify(body)});
      else             await apiFetch(`/api/turmas`,{method:"POST",body:JSON.stringify(body)});
      setTurmaModalOpen(false); load();
    } catch(e:unknown) { setTurmaErr(String(e)); }
  };
  const delTurma = async (id: string) => { if (!confirm("Remover esta turma?")) return; await apiFetch(`/api/turmas/${id}`,{method:"DELETE"}); load(); };
  const toggleTurmaAtivo = async (t: TurmaDto) => {
    await apiFetch(`/api/turmas/toggleAtivo/${t.id}`, { method: "POST" });
    load();
  };

  // ── Modalidade CRUD ───────────────────────────────────────────────────────
  const openCriarMod = () => { setModNome(""); setModDescricao(""); setModErr(""); setModModalOpen(true); };
  const submitMod = async () => {
    setModErr("");
    try {
      await apiFetch(`/api/modalidades`,{method:"POST",body:JSON.stringify({ nome: modNome, descricao: modDescricao })});
      setModModalOpen(false); load();
    } catch(e:unknown) { setModErr(String(e)); }
  };
  const delMod = async (id: string) => { if (!confirm("Remover esta modalidade?")) return; await apiFetch(`/api/modalidades/${id}`,{method:"DELETE"}); load(); };

  // ── Estúdio CRUD ──────────────────────────────────────────────────────────
  const openCriarEst = () => {
    setEditEstId(null);
    setEstNome("");
    setEstCapacidade("");
    setEstNotas("");
    setEstErr("");
    setEstModalOpen(true);
  };
  const openEditEst = (e: EstudioDto) => {
    setEditEstId(e.id);
    setEstNome(e.nome);
    setEstCapacidade(e.capacidade ?? "");
    setEstNotas(e.notas ?? "");
    setEstErr("");
    setEstModalOpen(true);
  };
  const submitEst = async () => {
    setEstErr("");
    if (!estNome.trim()) { setEstErr("O nome é obrigatório."); return; }
    const capacidadeVal = estCapacidade === "" ? null : Number(estCapacidade);
    const payload = { nome: estNome, capacidade: capacidadeVal, notas: estNotas || null };
    try {
      if (editEstId) {
        await apiFetch(`/api/estudios/${editEstId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/api/estudios`, { method: "POST", body: JSON.stringify(payload) });
      }
      setEstModalOpen(false);
      load();
    } catch(e:unknown) { setEstErr(String(e)); }
  };
  const delEst = async (id: string) => {
    if (!confirm("Remover este estúdio?")) return;
    try {
      await apiFetch(`/api/estudios/${id}`, { method: "DELETE" });
      load();
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.toLowerCase().includes("constraint") || msg.toLowerCase().includes("foreign") || msg.toLowerCase().includes("integrity")) {
        alert("Não é possível remover este estúdio porque tem modalidades associadas.\nRemove primeiro as modalidades associadas e depois tenta novamente.");
      } else {
        alert("Erro ao remover estúdio: " + msg);
      }
    }
  };

  // ── Associar Estúdio ↔ Modalidade ─────────────────────────────────────────
  const carregarRelacoesEstudio = async (id: string) => {
    setLoadingAssoc(true);
    try {
      const associadas   = await apiFetch<ModalidadeDto[]>(`/api/estudios/modalidades/${id}`);
      const naoAssociadas = await apiFetch<ModalidadeDto[]>(`/api/estudios/modalidadesNaoAssociadas/${id}`);
      setModalidadesAssoc(associadas ?? []);
      setModalidadesDisp(naoAssociadas ?? []);
    } catch { setAssocErr("Erro ao carregar relações do estúdio."); }
    finally { setLoadingAssoc(false); }
  };

  const openAssoc = (estudio: EstudioDto) => {
    setAssocEstudio(estudio);
    setAssocErr("");
    setAssocModalOpen(true);
    carregarRelacoesEstudio(estudio.id);
  };

  const handleAdicionarModalidade = async (modalidadeId: string) => {
    if (!assocEstudio) return;
    try {
      await apiFetch(`/api/estudios/${assocEstudio.id}/modalidade/${modalidadeId}`, { method: "POST" });
      carregarRelacoesEstudio(assocEstudio.id);
    } catch { setAssocErr("Erro ao associar modalidade."); }
  };

  const handleRemoverModalidade = async (modalidadeId: string) => {
    if (!assocEstudio) return;
    try {
      await apiFetch(`/api/estudios/${assocEstudio.id}/modalidade/${modalidadeId}`, { method: "DELETE" });
      carregarRelacoesEstudio(assocEstudio.id);
    } catch { setAssocErr("Erro ao remover associação."); }
  };

  // ── Coaching ──────────────────────────────────────────────────────────────
  const validarC  = async (id: string) => { await apiFetch(`${API}/coaching/${id}/validar`,{method:"PUT"}); load(); };
  const eliminarC = async (id: string) => { if (!confirm("Remover este registo de coaching?")) return; await apiFetch(`${API}/coaching/${id}`,{method:"DELETE"}); load(); };

  // ── Coaching filtros ──────────────────────────────────────────────────────
  const ESTADOS_COACHING = [
    { id: "2", label: "Pedido",                  desc: "Pedido de aula submetido, aguarda validação" },
    { id: "3", label: "Agendado",                desc: "Aula validada pelo sistema e pelo professor" },
    { id: "4", label: "Aula cancelada",          desc: "Aula cancelada por professor, estudante ou outro motivo" },
    { id: "5", label: "Aula ocorrida",           desc: "Aula realizou-se, aguarda registo contabilístico" },
    { id: "6", label: "Pendente de validação",   desc: "Aguarda confirmação dos atores necessários" },
    { id: "7", label: "Validado Automáticamente",desc: "Prazo de validação de 48h ultrapassado sem confirmação" },
    { id: "8", label: "Validado",                desc: "Confirmado por todos os atores necessários" },
    { id: "9", label: "Contabilizado",           desc: "Incluído no relatório mensal" },
  ];

  const [coachingFiltroEstado, setCoachingFiltroEstado] = useState<string>("3");
  const [coachingFiltroDataDe, setCoachingFiltroDataDe] = useState<string>("");
  const [coachingFiltroDataAte, setCoachingFiltroDataAte] = useState<string>("");

  // ── Coaching detalhe modal ────────────────────────────────────────────────
  const [coachingDetalhe, setCoachingDetalhe] = useState<CoachingDto | null>(null);
  const [coachingDetalheProf, setCoachingDetalheProf] = useState<string[]>([]);
  const [coachingDetalheLoadingProf, setCoachingDetalheLoadingProf] = useState(false);

  const abrirDetalheCoaching = async (c: CoachingDto) => {
    setCoachingDetalhe(c);
    setCoachingDetalheProf([]);
    setCoachingDetalheLoadingProf(true);
    try {
      const nomes = await apiFetch<string[]>(`/api/professores/nomebyAula/${c.aulaDto.id}`);
      setCoachingDetalheProf(nomes ?? []);
    } catch { setCoachingDetalheProf([]); }
    finally { setCoachingDetalheLoadingProf(false); }
  };

  const coachingsFiltrados = coachings.filter(c => {
    const estadoId = c.estadoAulaDto?.id ?? "";
    const estadoLabel = (c.estadoAulaDto?.estado ?? "").toUpperCase();
    const estadoMatch = ESTADOS_COACHING.find(e => e.id === coachingFiltroEstado);
    if (coachingFiltroEstado && estadoId !== coachingFiltroEstado && estadoLabel !== estadoMatch?.label.toUpperCase()) return false;
    if (coachingFiltroDataDe && c.aulaDto.dataAula < coachingFiltroDataDe) return false;
    if (coachingFiltroDataAte && c.aulaDto.dataAula > coachingFiltroDataAte) return false;
    return true;
  });

  const TABS = [
    { key:"horarios",    label:"Horários Fixos" },
    { key:"turmas",      label:"Turmas" },
    { key:"modalidades", label:"Modalidades" },
    { key:"estudios",    label:"Estúdios" },
    { key:"coaching",    label:"Coachings" },
    { key:"grelha",      label:"Horários Gerais" },
  ] as const;

  const SectionHeader = ({ title, btnLabel, onBtnClick }: { title: string; btnLabel: string; onBtnClick: () => void }) => (
    <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, color: "var(--panel-dark)", margin: 0 }}>{title}</h2>
      <BtnPrimario label={btnLabel} onClick={onBtnClick} />
    </div>
  );

  return (
    <div>
      <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
      {loading ? <Loader /> : <>

        {/* ── HORÁRIOS FIXOS ─────────────────────────────────────────────── */}
        {tab==="horarios" && (
          <div>
            <SectionHeader title="Horários Fixos" btnLabel="+ Criar Horário" onBtnClick={openCriarHor} />
            {horarios.length===0 && <Empty>Sem horários fixos registados.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:16 }}>
              {horarios.map(h => (
                <HorarioCard key={h.id} h={h} onEdit={()=>openEditHor(h)} onDel={()=>delHor(h.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ── TURMAS ────────────────────────────────────────────────────── */}
        {tab==="turmas" && (
          <div>
            <SectionHeader title="Gestão de Turmas" btnLabel="+ Nova Turma" onBtnClick={openCriarTurma} />
            {turmas.length===0 && <Empty>Sem turmas criadas.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 }}>
              {turmas.map(t => (
                <div key={t.id} style={{ background:"#fff", border:`1px solid ${t.ativo === false ? "#f5c6cb" : "var(--border-warm)"}`, borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.02)", opacity: t.ativo === false ? 0.75 : 1 }}>
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                      <div style={{ fontSize:16, fontWeight:700, color:"var(--panel-dark)" }}>{t.nome}</div>
                      <span style={{ background: t.ativo === false ? "#f8d7da" : "#d4edda", color: t.ativo === false ? "#721c24" : "#155724", borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>
                        {t.ativo === false ? "Inativa" : "Ativa"}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                      {t.modalidade && (
                        <span style={{ background:"rgba(160,133,96,0.12)", color:"var(--accent-muted)", borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:600 }}>
                          <i className="ti ti-tag" style={{ marginRight:4, fontSize:10 }} />{t.modalidade.nome}
                        </span>
                      )}
                      {t.mensalidade != null && (
                        <span style={{ background:"rgba(39,174,96,0.1)", color:"#1e8449", borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:600 }}>
                          {Number(t.mensalidade).toFixed(2)} €/mês
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12, marginTop:12 }}>
                    <button onClick={()=>toggleTurmaAtivo(t)}
                      style={{ ...btnBase, background: t.ativo === false ? "rgba(39,174,96,0.1)" : "rgba(231,76,60,0.08)", border: `1px solid ${t.ativo === false ? "#27ae60" : "#e74c3c"}`, color: t.ativo === false ? "#1e8449" : "#e74c3c", fontSize:11, padding:"5px 13px" }}>
                      {t.ativo === false ? "Ativar" : "Desativar"}
                    </button>
                    <BtnSecundario label="Editar"   onClick={()=>openEditTurma(t)} small />
                    <BtnPerigo     label="Remover"  onClick={()=>delTurma(t.id)}  small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MODALIDADES ────────────────────────────────────────────────── */}
        {tab==="modalidades" && (
          <div>
            <SectionHeader title="Gestão de Modalidades" btnLabel="+ Nova Modalidade" onBtnClick={openCriarMod} />
            {modalidades.length===0 && <Empty>Sem modalidades criadas.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:14 }}>
              {modalidades.map(m => (
                <div key={m.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div style={{ fontSize:15, fontWeight:700, color:"var(--panel-dark)" }}>{m.nome}</div>
                  <BtnPerigo label="Remover" onClick={()=>delMod(m.id)} small />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ESTÚDIOS ───────────────────────────────────────────────────── */}
        {tab==="estudios" && (
          <div>
            <SectionHeader title="Gestão de Estúdios" btnLabel="+ Novo Estúdio" onBtnClick={openCriarEst} />
            {estudios.length===0 && <Empty>Sem estúdios criados.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
              {estudios.map(e => (
                <div key={e.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.02)" }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:"var(--panel-dark)", marginBottom:6 }}>
                      <i className="ti ti-building" style={{ marginRight:6, color:"var(--accent-muted)" }} />{e.nome}
                    </div>
                    {e.capacidade != null && (
                      <div style={{ fontSize:11, color:"var(--accent-muted)" }}>
                        • Lotação: <strong>{e.capacidade}</strong> pessoas
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12, marginTop:12 }}>
                    <BtnSecundario label="Associações"      onClick={()=>openAssoc(e)}     small />
                    <BtnSecundario label="Editar"           onClick={()=>openEditEst(e)}   small />
                    <BtnPerigo     label="Remover"          onClick={()=>delEst(e.id)}     small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── COACHINGS ──────────────────────────────────────────────────── */}
        {tab==="coaching" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, color: "var(--panel-dark)", margin: 0 }}>Histórico Global de Coachings</h2>
            </div>

            {/* ── Filtros ── */}
            <div style={{ background:"#FAF8F5", border:"1px solid var(--border-warm)", borderRadius:10, padding:"16px 20px", marginBottom:22, display:"flex", flexWrap:"wrap", gap:16, alignItems:"flex-end" }}>
              {/* Filtro por estado */}
              <div style={{ flex:"1 1 220px", minWidth:0 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:6, textTransform:"uppercase" as const }}>Estado</label>
                <select
                  value={coachingFiltroEstado}
                  onChange={e => setCoachingFiltroEstado(e.target.value)}
                  style={{ width:"100%", background:"#fff", border:"1px solid var(--border-warm)", borderRadius:6, color:"var(--panel-dark)", padding:"8px 12px", fontSize:13, outline:"none", cursor:"pointer" }}
                >
                  <option value="">Todos os estados</option>
                  {ESTADOS_COACHING.map(e => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
                {coachingFiltroEstado && (
                  <div style={{ fontSize:11, color:"var(--accent-muted)", marginTop:4, fontStyle:"italic" }}>
                    {ESTADOS_COACHING.find(e => e.id === coachingFiltroEstado)?.desc}
                  </div>
                )}
              </div>

              {/* Filtro data de */}
              <div style={{ flex:"1 1 160px", minWidth:0 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:6, textTransform:"uppercase" as const }}>Data de</label>
                <input
                  type="date"
                  value={coachingFiltroDataDe}
                  onChange={e => setCoachingFiltroDataDe(e.target.value)}
                  style={{ width:"100%", background:"#fff", border:"1px solid var(--border-warm)", borderRadius:6, color:"var(--panel-dark)", padding:"8px 12px", fontSize:13, outline:"none", boxSizing:"border-box" as const }}
                />
              </div>

              {/* Filtro data até */}
              <div style={{ flex:"1 1 160px", minWidth:0 }}>
                <label style={{ display:"block", fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:6, textTransform:"uppercase" as const }}>Data até</label>
                <input
                  type="date"
                  value={coachingFiltroDataAte}
                  onChange={e => setCoachingFiltroDataAte(e.target.value)}
                  style={{ width:"100%", background:"#fff", border:"1px solid var(--border-warm)", borderRadius:6, color:"var(--panel-dark)", padding:"8px 12px", fontSize:13, outline:"none", boxSizing:"border-box" as const }}
                />
              </div>

              {/* Limpar filtros */}
              {(coachingFiltroEstado || coachingFiltroDataDe || coachingFiltroDataAte) && (
                <div style={{ flex:"0 0 auto", display:"flex", alignItems:"flex-end" }}>
                  <button
                    onClick={() => { setCoachingFiltroEstado(""); setCoachingFiltroDataDe(""); setCoachingFiltroDataAte(""); }}
                    style={{ ...btnBase, background:"transparent", border:"1px solid #c0392b", color:"#c0392b", fontSize:11, padding:"8px 14px" }}
                  >
                    ✕ Limpar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Contador de resultados */}
            <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:14 }}>
              A mostrar <strong style={{ color:"var(--panel-dark)" }}>{coachingsFiltrados.length}</strong> de {coachings.length} registo{coachings.length !== 1 ? "s" : ""}
            </div>

            {coachingsFiltrados.length===0 && <Empty>Nenhum registo encontrado para os filtros selecionados.</Empty>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
              {coachingsFiltrados.map(c => {
                const podeValidar = c.estadoAulaDto?.id === "5" || c.estadoAulaDto?.id === "6" || c.estadoAulaDto?.estado?.toUpperCase() === "AULA OCORRIDA" || c.estadoAulaDto?.estado?.toUpperCase() === "PENDENTE DE VALIDAÇÃO";
                return (
                  <div key={c.aulaDto.id}
                    onClick={() => abrirDetalheCoaching(c)}
                    style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:12, padding:"20px", display:"flex", flexDirection:"column", justifyContent:"space-between", boxShadow:"0 2px 4px rgba(0,0,0,0.01)", cursor:"pointer", transition:"box-shadow .15s, transform .15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 4px rgba(0,0,0,0.01)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
                  >
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <span style={{ fontSize:15, color:"var(--panel-dark)", fontWeight:600 }}>{c.aulaDto.dataAula}</span>
                        <EstadoBadge estado={c.estadoAulaDto?.estado??"—"} />
                      </div>
                      <div style={{ fontSize:13, color:"var(--panel-dark)", marginBottom:4 }}>
                        <i className="ti ti-clock" style={{ marginRight:5, color:"var(--accent-muted)" }} />
                        {trimHora(c.aulaDto.horaInicio)} – {trimHora(c.aulaDto.horaFim)}
                        {c.aulaDto.duracaoMinutos ? <span style={{ marginLeft:8, fontSize:11, color:"var(--accent-muted)" }}>({c.aulaDto.duracaoMinutos} min)</span> : null}
                      </div>
                      {c.modalidadeDto?.nome && <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:4 }}><i className="ti ti-tag" style={{ marginRight:5 }} />{c.modalidadeDto.nome}</div>}
                    </div>
                    <div style={{ display:"flex", gap:8, justifyContent:"flex-end", borderTop:"1px solid #FAF8F5", paddingTop:12, marginTop:10 }}>
                      {podeValidar && (
                        <BtnPrimario label="Validar" onClick={e => { e.stopPropagation(); validarC(c.aulaDto.id); }} small />
                      )}
                      <BtnPerigo label="Eliminar" onClick={e => { e.stopPropagation(); eliminarC(c.aulaDto.id); }} small />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HORÁRIOS GERAIS ────────────────────────────────────────────── */}
        {tab==="grelha" && (() => {
          // Calcular segunda e domingo da semana visualizada
          const hoje = new Date();
          const diaAtual = hoje.getDay() === 0 ? 7 : hoje.getDay();
          const segundaSemana = new Date(hoje);
          segundaSemana.setDate(hoje.getDate() - (diaAtual - 1) + grelhaOffset * 7);
          segundaSemana.setHours(0, 0, 0, 0);
          const domingoSemana = new Date(segundaSemana);
          domingoSemana.setDate(segundaSemana.getDate() + 6);
          domingoSemana.setHours(23, 59, 59, 999);
          const semStr = (d: Date) => d.toISOString().split("T")[0];

          const turmasAtivas = turmas.filter(t => t.ativo !== false);
          // Filtra horários válidos para a semana visível: dataInicio <= domingoSemana E dataValidade >= segundaSemana
          const todasAulas: AulaDto[] = horarios
            .filter(h => {
              if (!turmasAtivas.some(t => t.id === h.idturmaId?.id)) return false;
              const inicio   = h.dataInicio   ? new Date(h.dataInicio   + "T00:00:00") : null;
              const validade = h.dataValidade ? new Date(h.dataValidade + "T23:59:59") : null;
              if (inicio   && inicio   > domingoSemana) return false;
              if (validade && validade < segundaSemana)  return false;
              return true;
            })
            .map(h => ({ ...normalizeAula(h), turma: h.idturmaId }));

          const aulasGrelha = grelhaTurmaFiltro
            ? todasAulas.filter(a => a.turma?.id === grelhaTurmaFiltro)
            : todasAulas;

          const turmasFiltro = turmasAtivas.filter(t =>
            horarios.some(h => h.idturmaId?.id === t.id)
          );
          const tituloGrelha = grelhaTurmaFiltro
            ? (turmasAtivas.find(t => t.id === grelhaTurmaFiltro)?.nome ?? "Turma selecionada")
            : `${aulasGrelha.length} aula${aulasGrelha.length !== 1 ? "s" : ""} nesta semana`;

          return (
            <div>
              <div style={{ marginBottom: 20, display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, color: "var(--panel-dark)", margin: 0 }}>
                  Horários Gerais 
                </h2>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase" as const, color:"var(--accent-muted)", fontWeight:400 }}>Filtrar por turma</label>
                  <select
                    value={grelhaTurmaFiltro}
                    onChange={e => setGrelhaTurmaFiltro(e.target.value)}
                    style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:6, color:"var(--panel-dark)", padding:"8px 12px", fontSize:13, outline:"none", cursor:"pointer", minWidth:200 }}
                  >
                    <option value="">Todas as turmas</option>
                    {turmasFiltro.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              {aulasGrelha.length === 0
                ? <Empty>Sem horários válidos para esta semana{grelhaTurmaFiltro ? " e turma selecionada" : ""}.</Empty>
                : <GrelhaHorario
                    aulas={aulasGrelha}
                    titulo={tituloGrelha}
                    semanaOffset={grelhaOffset}
                    onPrev={() => setGrelhaOffset(o => o - 1)}
                    onNext={() => setGrelhaOffset(o => o + 1)}
                  />
              }
            </div>
          );
        })()}
      </>}

      {/* ── MODALS ──────────────────────────────────────────────────────── */}

      {/* Coaching detalhe */}
      <Modal open={!!coachingDetalhe} onClose={() => setCoachingDetalhe(null)} title="Detalhe do Coaching">
        {coachingDetalhe && (() => {
          const c = coachingDetalhe;
          const podeValidar = c.estadoAulaDto?.id === "5" || c.estadoAulaDto?.id === "6" || c.estadoAulaDto?.estado?.toUpperCase() === "AULA OCORRIDA" || c.estadoAulaDto?.estado?.toUpperCase() === "PENDENTE DE VALIDAÇÃO";
          const nomeFallback = c.professorDto?.utilizadores?.nome || c.professorDto?.utilizador?.nome || c.professorDto?.nome || "";
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {/* Estado */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <span style={{ fontFamily:"var(--font-playfair)", fontSize:18, color:"var(--panel-dark)", fontWeight:600 }}>
                  {c.modalidadeDto?.nome ?? "Sessão de Coaching"}
                </span>
                <EstadoBadge estado={c.estadoAulaDto?.estado ?? "—"} />
              </div>

              {/* Info rows */}
              {[
                { icon:"ti-calendar",     label:"Data",       value: c.aulaDto.dataAula },
                { icon:"ti-clock",        label:"Horário",    value: `${trimHora(c.aulaDto.horaInicio)} – ${trimHora(c.aulaDto.horaFim)}` },
                { icon:"ti-hourglass",    label:"Duração",    value: c.aulaDto.duracaoMinutos ? `${c.aulaDto.duracaoMinutos} minutos` : "—" },
                { icon:"ti-building",     label:"Estúdio",    value: c.aulaDto.estudio?.nome ?? "—" },
                { icon:"ti-tag",          label:"Modalidade", value: c.modalidadeDto?.nome ?? "—" },
                { icon:"ti-users",        label:"Máx. alunos",value: String(c.max_alunos ?? "—") },
                { icon:"ti-hash",         label:"ID da aula", value: c.aulaDto.id },
              ].map(row => (
                <div key={row.label} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:"1px solid #FAF8F5" }}>
                  <i className={`ti ${row.icon}`} style={{ fontSize:15, color:"var(--accent-muted)", marginTop:1, width:18, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase" as const, color:"var(--accent-muted)", marginBottom:2 }}>{row.label}</div>
                    <div style={{ fontSize:14, color:"var(--panel-dark)", fontWeight:500 }}>{row.value}</div>
                  </div>
                </div>
              ))}

              {/* Professor — via API */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:"1px solid #FAF8F5" }}>
                <i className="ti ti-user" style={{ fontSize:15, color:"var(--accent-muted)", marginTop:1, width:18, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase" as const, color:"var(--accent-muted)", marginBottom:2 }}>Professor</div>
                  <div style={{ fontSize:14, color:"var(--panel-dark)", fontWeight:500 }}>
                    {coachingDetalheLoadingProf
                      ? <span style={{ fontStyle:"italic", color:"var(--accent-muted)" }}>A carregar…</span>
                      : coachingDetalheProf.length > 0
                        ? coachingDetalheProf.join(", ")
                        : (nomeFallback || <span style={{ fontStyle:"italic", color:"var(--accent-muted)" }}>Não atribuído</span>)
                    }
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div style={{ display:"flex", gap:10, marginTop:24, justifyContent:"flex-end" }}>
                <BtnSecundario label="Fechar" onClick={() => setCoachingDetalhe(null)} />
                {podeValidar && (
                  <BtnPrimario label="Validar" onClick={() => { validarC(c.aulaDto.id); setCoachingDetalhe(null); }} />
                )}
                <BtnPerigo label="Eliminar" onClick={() => { eliminarC(c.aulaDto.id); setCoachingDetalhe(null); }} />
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Horário fixo */}
      <Modal open={horModalOpen} onClose={() => setHorModalOpen(false)} title={editHorId ? "Editar Horário Fixo" : "Novo Horário Fixo"}>
        {horErr && <ErrMsg msg={horErr} />}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display:"block", fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:5, textTransform:"uppercase" as const }}>Turma</label>
            <select
              key={`turma-select-${editHorId ?? "novo"}`}
              value={horForm.idturma}
              onChange={e => setHorForm(p => ({ ...p, idturma: e.target.value }))}
              style={{ width:"100%", background:"#fff", border:"1px solid var(--border-warm)", borderRadius:6, color:"var(--panel-dark)", padding:"9px 12px", fontSize:13, outline:"none", cursor:"pointer" }}
            >
              <option value="">Escolher turma...</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}{t.ativo===false?" (inativa)":""}</option>)}
              {horForm.idturma && !turmas.some(t => t.id === horForm.idturma) && (() => {
                const horAtual = horarios.find(h => h.id === editHorId);
                return horAtual?.idturmaId
                  ? <option key={horAtual.idturmaId.id} value={horAtual.idturmaId.id}>{horAtual.idturmaId.nome} (atual)</option>
                  : null;
              })()}
            </select>
          </div>
          <SelectField label="Estúdio"       value={horForm.estudioId}   onChange={v=>setHorForm(p=>({...p,estudioId:v}))}    options={estudios.map(e=>({value:e.id,label:e.nome}))}   placeholder="Escolher estúdio..." />
          <SelectField label="Professor"     value={horForm.idProfessor} onChange={v=>setHorForm(p=>({...p,idProfessor:v}))}  options={professores.map(p=>({value:p.id,label:p.nome}))} placeholder="Escolher professor..." />
          <SelectField label="Dia da semana" value={horForm.diaSemana?.toString()||""} onChange={v=>setHorForm(p=>({...p,diaSemana:v}))} options={DIAS_OPTIONS.map(d=>({value:d.value.toString(),label:d.label}))} placeholder="Escolher dia..." />
          <InputField  label="Hora início"   type="time" value={horForm.horaInicio}   onChange={v=>setHorForm(p=>({...p,horaInicio:v}))} />
          <InputField  label="Hora fim"      type="time" value={horForm.horaFim}      onChange={v=>setHorForm(p=>({...p,horaFim:v}))} />
          <InputField  label="Data início"   type="date" value={horForm.dataInicio}   onChange={v=>setHorForm(p=>({...p,dataInicio:v}))} />
          <InputField  label="Data validade" type="date" value={horForm.dataValidade} onChange={v=>setHorForm(p=>({...p,dataValidade:v}))} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
          <BtnSecundario label="Cancelar" onClick={()=>setHorModalOpen(false)} />
          <BtnPrimario label={editHorId?"Atualizar Horário":"Criar Horário"} onClick={submitHor} />
        </div>
      </Modal>

      {/* Turma */}
      <Modal open={turmaModalOpen} onClose={() => setTurmaModalOpen(false)} title={editTurmaId ? "Editar Turma" : "Nova Turma"}>
        {turmaErr && <ErrMsg msg={turmaErr} />}
        <InputField label="Nome da turma" value={turmaForm.nome} onChange={v=>setTurmaForm(p=>({...p,nome:v}))} />
        <InputField label="Mensalidade (€)" type="number" min={0} value={turmaForm.mensalidade} onChange={v=>setTurmaForm(p=>({...p,mensalidade:v}))} />
        <SelectField label="Modalidade *" value={turmaForm.modalidadeId} onChange={v=>setTurmaForm(p=>({...p,modalidadeId:v}))} options={modalidades.map(m=>({value:m.id,label:m.nome}))} placeholder="Escolher modalidade..." />
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:8, textTransform:"uppercase" as const }}>Estado</label>
          <div style={{ display:"flex", gap:8 }}>
            <button type="button" onClick={()=>setTurmaForm(p=>({...p,ativo:true}))}
              style={{ ...btnBase, flex:1, padding:"9px 0", fontSize:12, background: turmaForm.ativo ? "#27ae60" : "#fff", border:`1px solid ${turmaForm.ativo ? "#27ae60" : "#ddd"}`, color: turmaForm.ativo ? "#fff" : "#999" }}>
              ✓ Ativa
            </button>
            <button type="button" onClick={()=>setTurmaForm(p=>({...p,ativo:false}))}
              style={{ ...btnBase, flex:1, padding:"9px 0", fontSize:12, background: !turmaForm.ativo ? "#e74c3c" : "#fff", border:`1px solid ${!turmaForm.ativo ? "#e74c3c" : "#ddd"}`, color: !turmaForm.ativo ? "#fff" : "#999" }}>
              ✕ Inativa
            </button>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
          <BtnSecundario label="Cancelar" onClick={()=>setTurmaModalOpen(false)} />
          <BtnPrimario label={editTurmaId?"Guardar Alterações":"Criar Turma"} onClick={submitTurma} />
        </div>
      </Modal>

      {/* Modalidade */}
      <Modal open={modModalOpen} onClose={() => setModModalOpen(false)} title="Nova Modalidade">
        {modErr && <ErrMsg msg={modErr} />}
        <InputField label="Nome da modalidade" value={modNome} onChange={setModNome} />
        <TextareaField label="Descrição" value={modDescricao} onChange={setModDescricao} />
        <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
          <BtnSecundario label="Cancelar" onClick={()=>setModModalOpen(false)} />
          <BtnPrimario label="Criar Modalidade" onClick={submitMod} />
        </div>
      </Modal>

      {/* Estúdio: criar / editar */}
      <Modal open={estModalOpen} onClose={() => setEstModalOpen(false)} title={editEstId ? "Editar Estúdio" : "Novo Estúdio"}>
        {estErr && <ErrMsg msg={estErr} />}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <InputField label="Nome do estúdio" value={estNome} onChange={setEstNome} />
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:600, textTransform:"uppercase", color:"var(--panel-dark)", marginBottom:4 }}>
              Capacidade Máxima (Alunos)
            </label>
            <input
              type="number"
              min="0"
              placeholder="Ex: 15"
              value={estCapacidade}
              onChange={e => setEstCapacidade(e.target.value === "" ? "" : Number(e.target.value))}
              style={{ width:"100%", padding:"8px 12px", borderRadius:6, border:"1px solid var(--border-warm)", fontSize:14, outline:"none", boxSizing:"border-box" }}
            />
          </div>
          <TextareaField label="Notas" value={estNotas} onChange={setEstNotas} />
        </div>
        <div style={{ display:"flex", gap:10, marginTop:24, justifyContent:"flex-end" }}>
          <BtnSecundario label="Cancelar" onClick={()=>setEstModalOpen(false)} />
          <BtnPrimario label={editEstId ? "Guardar" : "Criar Estúdio"} onClick={submitEst} />
        </div>
      </Modal>

      {/* Estúdio: associações de modalidades */}
      <Modal open={assocModalOpen} onClose={() => { setAssocModalOpen(false); setAssocEstudio(null); }} title={`Associações: ${assocEstudio?.nome ?? ""}`}>
        {assocErr && <ErrMsg msg={assocErr} />}
        {loadingAssoc ? <Loader /> : (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div>
              <h5 style={{ fontSize:11, letterSpacing:1, textTransform:"uppercase", color:"var(--panel-dark)", borderBottom:"1px solid var(--border-warm)", paddingBottom:6, marginBottom:10 }}>
                Modalidades Ativas no Estúdio
              </h5>
              {modalidadesAssociadas.length === 0 ? (
                <p style={{ fontSize:12, color:"var(--accent-muted)", fontStyle:"italic" }}>Sem modalidades associadas.</p>
              ) : (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {modalidadesAssociadas.map(m => (
                    <span key={m.id} style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#fde8e8", color:"#c0392b", border:"1px solid #f5c6cb", padding:"4px 10px", borderRadius:20, fontSize:12 }}>
                      {m.nome}
                      <i className="ti ti-x" style={{ cursor:"pointer", fontWeight:"bold" }} onClick={() => handleRemoverModalidade(m.id)} />
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h5 style={{ fontSize:11, letterSpacing:1, textTransform:"uppercase", color:"var(--panel-dark)", borderBottom:"1px solid var(--border-warm)", paddingBottom:6, marginBottom:10 }}>
                Disponíveis para Adicionar
              </h5>
              {modalidadesDisponiveis.length === 0 ? (
                <p style={{ fontSize:12, color:"var(--accent-muted)", fontStyle:"italic" }}>Todas associadas.</p>
              ) : (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {modalidadesDisponiveis.map(m => (
                    <button key={m.id} onClick={() => handleAdicionarModalidade(m.id)}
                      style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#fff", color:"var(--panel-dark)", border:"1px solid var(--border-warm)", padding:"5px 12px", borderRadius:20, fontSize:12, cursor:"pointer" }}>
                      <i className="ti ti-plus" style={{ color:"#27ae60" }} /> {m.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:10 }}>
              <BtnSecundario label="Fechar" onClick={() => { setAssocModalOpen(false); setAssocEstudio(null); }} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Micro-componentes de layout adicionais ───────────────────────────────────

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color:"var(--accent-muted)", fontSize:14, fontWeight:400, margin:"12px 0 24px", fontStyle:"italic" }}>{children}</p>;
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideInToast { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ marginBottom:28 }}>
        <p style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--accent-muted)", fontWeight:400, marginBottom:4 }}>
          {role ? roleLabel[role] : "—"}
        </p>
        <h1 style={{ fontFamily:"var(--font-playfair)", fontSize:26, color:"var(--panel-dark)", fontWeight:400, marginBottom:0 }}>
          Horários e Sessões
        </h1>
      </div>

      {!role ? (
        <div style={{ textAlign: "center", padding: 80 }}>
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