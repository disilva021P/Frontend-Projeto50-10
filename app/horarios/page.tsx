"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

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
  aulaDto: { id: string; dataAula: string; horaInicio: string; horaFim: string; duracaoMinutos: number };
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

// ─── Helpers grelha ───────────────────────────────────────────────────────────

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

// ─── Normalizar aulas do backend ────────────────────────────────────────────────────

// O backend pode devolver os campos dentro de idHorario em vez da raiz.
// Esta função normaliza a estrutura para o formato que a GrelhaHorario espera.
function trimHora(h: string | undefined): string | undefined {
  // Normaliza "21:00:00" -> "21:00"
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

// ─── Navbar + Drawer (reutilizável, igual à landing) ─────────────────────────

const NAV_SECTIONS = [
  { title: "Principal", items: [
    { icon: "ti-home",        label: "Início",      href: "/landingPage" },
    { icon: "ti-calendar",    label: "Horários",    href: "/horarios" },
    { icon: "ti-credit-card", label: "Pagamentos",  href: "/pagamentos" },
  ]},
  { title: "Comunidade", items: [
    { icon: "ti-mail",         label: "Mensagens",   href: "/mensagens" },
    { icon: "ti-star",         label: "Eventos",     href: "/eventos" },
    { icon: "ti-shopping-bag", label: "Marketplace", href: "/marketplace" },
  ]},
  { title: "Gestão", items: [
    { icon: "ti-chart-bar", label: "Gestão de Faltas", href: "/faltas" },
  ]},
];

function Navbar({ userName, initials, onDrawer }: { userName: string; initials: string; onDrawer: () => void }) {
  return (
    <nav style={{ height: "52px", borderBottom: "1px solid var(--border-warm)", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button onClick={onDrawer} aria-label="Abrir menu" style={{ width: 32, height: 32, border: "1px solid var(--border-warm)", borderRadius: 4, background: "#FFFCF8", color: "var(--panel-dark)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-menu-2" style={{ fontSize: 16 }} />
        </button>
        <div>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: 16, letterSpacing: 4, color: "var(--panel-dark)", fontWeight: 400 }}>entartes</span>
          <span style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase" as const, color: "var(--accent-muted)", fontWeight: 300, marginLeft: 4 }}>· escola de dança</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300 }}>
          {userName ? `Bem-vindo, ${userName.split(" ")[0]}` : ""}
        </span>
        <button aria-label="Notificações" style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--border-warm)", background: "transparent", color: "var(--accent-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-bell" style={{ fontSize: 15 }} />
        </button>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", fontSize: 11, letterSpacing: 1, fontFamily: "var(--font-playfair)", fontWeight: 400, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {initials}
        </div>
      </div>
    </nav>
  );
}

function Drawer({ open, onClose, currentHref, onLogout }: { open: boolean; onClose: () => void; currentHref: string; onLogout: () => void }) {
  const router = useRouter();
  return (
    <>
      {open && <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(44,31,20,0.30)" }} onClick={onClose} />}
      <aside style={{ position: "absolute", top: 0, bottom: 0, left: 0, zIndex: 20, width: 220, background: "var(--panel-dark)", transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform .28s cubic-bezier(.4,0,.2,1)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid rgba(212,178,136,0.12)" }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: 13, letterSpacing: 3, color: "var(--accent-gold)", fontWeight: 400, display: "block" }}>entartes</span>
          <span style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase" as const, color: "rgba(212,178,136,0.35)", fontWeight: 300, marginTop: 2, display: "block" }}>escola de dança</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {NAV_SECTIONS.map(s => (
            <div key={s.title}>
              <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase" as const, color: "rgba(212,178,136,0.22)", fontWeight: 300, padding: "14px 20px 4px" }}>{s.title}</div>
              {s.items.map(item => {
                const active = currentHref === item.href;
                return (
                  <button key={item.href}
                    onClick={() => { router.push(item.href); onClose(); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 20px", color: active ? "var(--accent-gold)" : "rgba(212,178,136,0.55)", background: active ? "rgba(212,178,136,0.12)" : "transparent", border: "none", fontSize: 12, letterSpacing: .5, fontWeight: active ? 400 : 300, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget).style.background = "rgba(212,178,136,0.08)"; (e.currentTarget).style.color = "var(--accent-gold)"; } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget).style.background = "transparent"; (e.currentTarget).style.color = "rgba(212,178,136,0.55)"; } }}>
                    <i className={`ti ${item.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(212,178,136,0.10)" }}>
          <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(212,178,136,0.35)", fontSize: 12, fontWeight: 300, background: "transparent", border: "none", cursor: "pointer" }}
            onMouseEnter={e => ((e.currentTarget).style.color = "#E8A09A")}
            onMouseLeave={e => ((e.currentTarget).style.color = "rgba(212,178,136,0.35)")}>
            <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function Footer() {
  return (
    <footer style={{ padding: "12px 24px", borderTop: "1px solid var(--border-warm)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <span style={{ fontFamily: "var(--font-playfair)", fontSize: 12, letterSpacing: 3, color: "var(--accent-muted)", fontWeight: 400 }}>entartes</span>
      <span style={{ fontSize: 10, color: "var(--accent-muted)", fontWeight: 300 }}>© 2025 Entartes — Escola de Dança</span>
    </footer>
  );
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
    PENDENTE:     { bg: "#fff3cd", text: "#856404", label: "PENDENTE" },
    LISTA_ESPERA: { bg: "#fce4ec", text: "#880e4f", label: "LISTA DE ESPERA" },
    CANCELADO:    { bg: "#f8d7da", text: "#721c24", label: "CANCELADO" },
  };
  const c = cores[estado] ?? { bg: "#e9ecef", text: "#495057", label: estado };
  return <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, letterSpacing: .5 }}>{c.label}</span>;
}

const btnBase: React.CSSProperties = { borderRadius: 6, fontWeight: 700, cursor: "pointer", letterSpacing: .3, fontFamily: "Lato, sans-serif", transition: "opacity .15s" };
function BtnPrimario({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "var(--panel-dark)", border: "none", color: "var(--accent-gold)", fontSize: small ? 11 : 13, padding: small ? "5px 12px" : "9px 18px" }}>{label}</button>;
}
function BtnSecundario({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "transparent", border: "1px solid var(--panel-dark)", color: "var(--panel-dark)", fontSize: small ? 11 : 13, padding: small ? "4px 11px" : "8px 17px" }}>{label}</button>;
}
function BtnPerigo({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return <button onClick={onClick} style={{ ...btnBase, background: "transparent", border: "1px solid #c0392b", color: "#c0392b", fontSize: small ? 11 : 13, padding: small ? "4px 11px" : "8px 17px" }}>{label}</button>;
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

// ─── Grelha semanal ───────────────────────────────────────────────────────────

function GrelhaHorario({ aulas, titulo, semanaOffset, onPrev, onNext }: { aulas: AulaDto[]; titulo: string; semanaOffset: number; onPrev: () => void; onNext: () => void }) {
  const HORA_INICIO = 0;   // 00:00
  const HORA_FIM    = 24;  // 24:00 (exclusive — representa o fim do dia)
  const TOTAL_MIN   = (HORA_FIM - HORA_INICIO) * 60; // 1440 min
  const PX_POR_HORA = 56;  // altura em px por cada hora
  const ALTURA      = TOTAL_MIN / 60 * PX_POR_HORA;  // 24 * 56 = 1344px
  const SCROLL_INICIAL = 8 * PX_POR_HORA;             // scroll para as 08:00 no mount

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll automático para as 08:00 na primeira renderização
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = SCROLL_INICIAL;
    }
  }, []);

  const aulasPorDia: AulaDto[][] = Array.from({ length: 7 }, () => []);
  console.log("🎯 GrelhaHorario recebeu:", aulas.length, "aulas");
  aulas.forEach(a => {
    const i = diaParaIdx(a.diaSemana);
    console.log("  → aula", a.id, "diaSemana=", a.diaSemana, "→ idx=", i);
    if (i >= 0) aulasPorDia[i].push(a);
  });

  const pos  = (h: string) => (horaParaMin(h) / TOTAL_MIN) * ALTURA;
  const alto = (i: string, f: string) => Math.max(((horaParaMin(f) - horaParaMin(i)) / TOTAL_MIN) * ALTURA, 22);

  const semanaLabel = semanaOffset === 0 ? "Esta semana" : semanaOffset > 0 ? `+${semanaOffset} semanas` : `${semanaOffset} semanas`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "var(--accent-muted)", fontStyle: "italic", fontWeight: 300 }}>{titulo}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onPrev} style={{ background: "none", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "var(--panel-dark)", fontSize: 12, fontFamily: "Lato, sans-serif" }}>← Anterior</button>
          <span style={{ fontSize: 12, color: "var(--accent-muted)", minWidth: 100, textAlign: "center", fontWeight: 300 }}>{semanaLabel}</span>
          <button onClick={onNext} style={{ background: "none", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "5px 14px", cursor: "pointer", color: "var(--panel-dark)", fontSize: 12, fontFamily: "Lato, sans-serif" }}>Próxima →</button>
        </div>
      </div>

      {/* Scroll horizontal (para semanas) + scroll vertical (para horas) */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 700, border: "1px solid var(--border-warm)", borderRadius: 8, overflow: "hidden", background: "#fff" }}>

          {/* Cabeçalho fixo (dias da semana) */}
          <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", background: "#FAF8F5", borderBottom: "1px solid var(--border-warm)", position: "sticky", top: 0, zIndex: 2 }}>
            <div />
            {DIAS.map(dia => (
              <div key={dia} style={{ borderLeft: "1px solid var(--border-warm)", padding: "8px 4px", textAlign: "center", fontSize: 10, fontWeight: 400, letterSpacing: 2, color: "var(--accent-muted)", textTransform: "uppercase" as const }}>
                {dia}
              </div>
            ))}
          </div>

          {/* Área com scroll vertical — mostra ≈10h de cada vez */}
          <div ref={scrollRef} style={{ overflowY: "auto", maxHeight: 560 }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)" }}>

              {/* Coluna de horas */}
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

              {/* Colunas dos dias */}
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
                        <div style={{ fontSize: 9, color: AULA_CORES_TEXTO[c], opacity: .8, marginTop: 1 }}>{a.horaInicio} – {a.horaFim}</div>
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

// ─── Views por role ───────────────────────────────────────────────────────────

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
  
  // Estado local para gerir erros específicos de validação de data
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
  
  // Encontra o objeto da disponibilidade ativa para saber qual é o diaSemana alvo (1-7)
  const dispSelecionada = disponibilidades.find(d => d.id === horarioSelecionadoId);

  // Função auxiliar para calcular a próxima data válida (ex: próximo sábado) a partir de hoje
  const obterProximaDataPorDiaSemana = (diaSemanaAlvo: number): string => {
    const hoje = new Date();
    const resultado = new Date(hoje);
    
    // Converter JS (0-Domingo, 1-Segunda...) para o padrão do teu DTO (1-Segunda, ..., 7-Domingo)
    const diaAtualJS = hoje.getDay() === 0 ? 7 : hoje.getDay();
    
    let diasAteAlvo = diaSemanaAlvo - diaAtualJS;
    if (diasAteAlvo <= 0) {
      diasAteAlvo += 7; // Se for hoje ou já passou esta semana, pula para a próxima semana
    }
    
    resultado.setDate(hoje.getDate() + diasAteAlvo);
    return resultado.toISOString().split('T')[0]; // Retorna YYYY-MM-DD
  };

  // Trata a alteração da data e valida se corresponde ao dia da semana correto
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
      alert("Por favor, corrige a data antes de enviar. Ela deve coincidir com o dia da semana do horário.");
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
    }
    finally { setSubmitting(false); }
  };

  // Define a data mínima como o dia de hoje (formato YYYY-MM-DD)
  const hojeString = new Date().toISOString().split('T')[0];

  return (
    <FormCard>
      {err && <ErrMsg msg={err} />}
      {ok && <OkMsg msg={ok} />}
      {dataErro && <div style={{ color: "#721c24", padding: "10px 14px", background: "#f8d7da", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #f5c6cb" }}>⚠️ {dataErro}</div>}

      {/* Passo 1 — Modalidade */}
      <SelectField
        label="1 · Modalidade"
        value={form.modalidadeId}
        onChange={v => setForm(f=>({...f,modalidadeId:v}))}
        options={modalidades.map(m=>({value:m.id,label:m.nome}))}
        placeholder="Escolher modalidade..."
      />

      {/* Passo 2 — Professor */}
      {form.modalidadeId && (
        <>
          {loadingProfs ? (
            <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:14, fontWeight:300 }}>A carregar professores…</div>
          ) : listaProfessores.length === 0 ? (
            <div style={{ fontSize:12, color:"#c0392b", marginBottom:14, background:"#fde8e8", border:"1px solid #f5c6cb", borderRadius:6, padding:"8px 12px" }}>
              Não há professores disponíveis para esta modalidade.
            </div>
          ) : (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:8, textTransform:"uppercase" as const }}>2 · Professor</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {listaProfessores.map((p: any, index: number) => {
                const currentId = String(p.id ?? p.utilizadorId ?? p.utilizadores?.id);
                const currentNome = p.nome ?? p.utilizador?.nome ?? p.utilizadores?.nome ?? "Professor sem nome";

                return (
                  <button 
                    key={currentId ?? index}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, professorId: currentId }))}
                    style={{ 
                      background: form.professorId === currentId ? 'var(--panel-dark)' : '#fff',
                      color: form.professorId === currentId ? 'var(--accent-gold)' : 'var(--panel-dark)',
                      border: '1px solid',
                      borderColor: form.professorId === currentId ? 'var(--panel-dark)' : 'var(--border-warm)',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontFamily: 'Lato, sans-serif'
                    }}
                  >
                    {currentNome}
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Passo 3 — Horário disponível */}
      {form.professorId && (
        <>
          {loadingDisps ? (
            <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:14, fontWeight:300 }}>A carregar disponibilidades…</div>
          ) : disponibilidades.length === 0 ? (
            <div style={{ fontSize:12, color:"#c0392b", marginBottom:14, background:"#fde8e8", border:"1px solid #f5c6cb", borderRadius:6, padding:"8px 12px" }}>
              {profSel ? (profSel.nome ?? profSel.utilizador?.nome ?? profSel.utilizadores?.nome) : "O professor"} não tem disponibilidades registadas.
            </div>
          ) : (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:8, textTransform:"uppercase" as const }}>3 · Horário disponível</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {disponibilidades.map(d => {
                  const diaLabel = DIAS_OPTIONS.find(x=>x.value===d.diaSemana)?.label ?? String(d.diaSemana);
                  const selected = horarioSelecionadoId === d.id; 

                  return (
                    <button 
                      key={d.id} 
                      type="button" 
                      onClick={() => {
                        setHorarioSelecionadoId(d.id);
                        setDataErro(""); // Limpa erros antigos
                        
                        // Sugere e autocompila imediatamente a próxima data válida para aquele dia da semana!
                        const proximaDataValida = obterProximaDataPorDiaSemana(d.diaSemana);
                        
                        setForm(f=>({
                          ...f, 
                          horaInicio: d.horaInicio, 
                          horaFim: d.horaFim,
                          dataAula: proximaDataValida // Facilita a vida do aluno preenchendo o sábado correto automaticamente
                        }));
                      }}
                      style={{ 
                        display:"flex", 
                        alignItems:"center", 
                        gap:12, 
                        background: selected ? "var(--panel-dark)" : "#fff", 
                        border:"1px solid", 
                        borderColor: selected ? "var(--panel-dark)" : "var(--border-warm)", 
                        borderRadius:8, 
                        padding:"10px 16px", 
                        cursor:"pointer", 
                        textAlign:"left" as const, 
                        fontFamily:"Lato, sans-serif" 
                      }}
                    >
                      <i className="ti ti-clock" style={{ fontSize:14, color: selected ? "var(--accent-gold)" : "var(--accent-muted)" }} />
                      <div>
                        <div style={{ fontSize:13, color: selected ? "var(--accent-gold)" : "var(--panel-dark)", fontWeight:400 }}>{diaLabel} · {d.horaInicio} – {d.horaFim}</div>
                        {(d.validoDe||d.validoAte) && <div style={{ fontSize:11, color: selected ? "rgba(212,178,136,0.7)" : "var(--accent-muted)", fontWeight:300, marginTop:2 }}>{d.validoDe} → {d.validoAte}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Passo 4 — Data e detalhes finais */}
      {form.horaInicio && (
        <>
          <div style={{ height:1, background:"var(--border-warm)", margin:"4px 0 16px" }} />
          
          <InputField 
            label="4 · Data da sessão" 
            type="date" 
            value={form.dataAula} 
            min={hojeString} // Impede retroativamente escolher dias passados
            onChange={handleDataChange} // Executa a validação do dia de semana inteligente
          />
          
          <InputField label="Máx. alunos" type="number" min={1} value={form.maxAlunos} onChange={v=>setForm(f=>({...f,maxAlunos:Number(v)}))} />
          <TextareaField label="Notas" value={form.descricao} onChange={v=>setForm(f=>({...f,descricao:v}))} />
          
          <BtnPrimario 
            label={submitting ? "A enviar…" : submitLabel} 
            onClick={handleSubmit} 
          />
        </>
      )}
    </FormCard>
  );
}

function AlunoView({ userName }: { userName: string }) {
  const [semana, setSemana]         = useState<AulaDto[]>([]);
  const [coaching, setCoaching]     = useState<CoachingDto[]>([]);
  const [disponiveis, setDisp]      = useState<CoachingDto[]>([]);
  const [offset, setOffset]         = useState(0);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"horario"|"coaching"|"disponiveis"|"marcar">("horario");
  const [err, setErr]               = useState("");
  const [ok, setOk]                 = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<AulaDto[]>(`${API}/semana?offset=${offset}`),
      apiFetch<{ content: CoachingDto[] }>(`${API}/coaching`),
      apiFetch<{ content: CoachingDto[] }>(`${API}/coachingsdisponiveis?offset=${offset}`),
    ]).then(([s,c,d]) => {
      const normalized = (s??[]).map(normalizeAula);
      console.log("✅ setSemana:", normalized.length, "aulas", normalized.map(a => ({ id: a.id, diaSemana: a.diaSemana, horaInicio: a.horaInicio })));
      setSemana(normalized); setCoaching(c?.content??[]); setDisp(d?.content??[]);
    }).catch(console.error).finally(() => setLoading(false));
  }, [offset]);

  const cancelar = async (id: string) => {
    await apiFetch(`${API}/cancelarCoaching/${id}`, { method:"DELETE" });
    setCoaching(c => c.filter(x => x.aulaDto.id !== id));
  };
  const inscrever = async (id: string) => {
    await apiFetch(`${API}/inscreverEmCoaching/${id}`, { method:"POST" });
    const upd = await apiFetch<{ content: CoachingDto[] }>(`${API}/coaching`);
    setCoaching(upd?.content ?? []);
  };
  const marcar = async (form: { professorId: string; modalidadeId: string; dataAula: string; horaInicio: string; horaFim: string; maxAlunos: number; descricao: string }) => {
    setErr(""); setOk("");
    await apiFetch(`${API}/marcarcoaching`, { method:"POST", body:JSON.stringify(form) });
    setOk("Coaching marcado! Aguarda confirmação.");
    const upd = await apiFetch<{ content: CoachingDto[] }>(`${API}/coaching`);
    setCoaching(upd?.content ?? []);
  };

  const TABS = [{ key:"horario", label:"Aulas" },{ key:"coaching", label:"Coaching" },{ key:"disponiveis", label:"Disponíveis" },{ key:"marcar", label:"+ Marcar coaching" }] as const;

  return (
    <div>
      <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
      {loading ? <Loader /> : <>
        {tab === "horario" && <GrelhaHorario aulas={semana} titulo={`Aulas de ${userName.split(" ")[0]}`} semanaOffset={offset} onPrev={() => setOffset(o=>o-1)} onNext={() => setOffset(o=>o+1)} />}

        {tab === "coaching" && (
          <div>
            <SectionTitle>Os meus coachings</SectionTitle>
            {coaching.length === 0 && <Empty>Sem coachings marcados.</Empty>}
            <CoachingGrid items={coaching} onAction={(id) => cancelar(id)} actionLabel="Cancelar" actionPerigo />
          </div>
        )}

        {tab === "disponiveis" && (
          <div>
            <SectionTitle>Coachings disponíveis</SectionTitle>
            {disponiveis.length === 0 && <Empty>Sem coachings disponíveis nesta semana.</Empty>}
            <CoachingGrid items={disponiveis} onAction={(id) => inscrever(id)} actionLabel="Inscrever" />
          </div>
        )}

        {tab === "marcar" && (
          <div style={{ maxWidth: 520 }}>
            <SectionTitle>Marcar sessão de coaching</SectionTitle>
            <MarcarCoachingForm onSubmit={marcar} err={err} ok={ok} />
          </div>
        )}
      </>}
    </div>
  );
}

function EncarregadoView({ userName }: { userName: string }) {
  const [educandos, setEducandos]   = useState<ResumoDto[]>([]);
  const [sel, setSel]               = useState<ResumoDto | null>(null);
  const [semana, setSemana]         = useState<AulaDto[]>([]);
  const [coaching, setCoaching]     = useState<CoachingDto[]>([]);
  const [disponiveis, setDisp]      = useState<CoachingDto[]>([]);
  const [offset, setOffset]         = useState(0);
  const [tab, setTab]               = useState<"horario"|"coaching"|"disponiveis"|"marcar">("horario");
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState("");
  const [ok, setOk]                 = useState("");

  useEffect(() => {
    apiFetch<ResumoDto[]>(`${BASE}/api/utilizadores/meus-educandos`).catch(()=>[])
      .then(e => setEducandos(e??[]));
  }, []);

  useEffect(() => {
    if (!sel) return;
    setLoading(true);
    Promise.all([
      apiFetch<AulaDto[]>(`${API}/semana/educando/${sel.id}?offset=${offset}`),
      apiFetch<{ content: CoachingDto[] }>(`${API}/coaching/educando/${sel.id}`),
      apiFetch<{ content: CoachingDto[] }>(`${API}/coachingsdisponiveis/educando/${sel.id}?offset=0`),
    ]).then(([s,c,d]) => { setSemana((s??[]).map(normalizeAula)); setCoaching(c?.content??[]); setDisp(d?.content??[]); })
    .catch(console.error).finally(() => setLoading(false));
  }, [sel, offset]);

  const selecionar = (e: ResumoDto) => { setSel(e); setOffset(0); setTab("horario"); setErr(""); setOk(""); };
  const inscrever  = async (id: string) => { if (!sel) return; await apiFetch(`${API}/inscreverEmCoaching/${id}/educando/${sel.id}`,{method:"POST"}); const u=await apiFetch<{content:CoachingDto[]}>(`${API}/coaching/educando/${sel.id}`); setCoaching(u?.content??[]); };
  const cancelar   = async (id: string) => { if (!sel) return; await apiFetch(`${API}/cancelarCoaching/${id}/educando/${sel.id}`,{method:"DELETE"}); setCoaching(c=>c.filter(x=>x.aulaDto.id!==id)); };
  const marcar     = async (form: { professorId: string; modalidadeId: string; dataAula: string; horaInicio: string; horaFim: string; maxAlunos: number; descricao: string }) => {
    if (!sel) return; setErr(""); setOk("");
    await apiFetch(`${API}/marcarcoaching/educando/${sel.id}`,{method:"POST",body:JSON.stringify(form)});
    setOk("Coaching marcado! Aguarda confirmação.");
    const u=await apiFetch<{content:CoachingDto[]}>(`${API}/coaching/educando/${sel.id}`); setCoaching(u?.content??[]);
  };

  const TABS = [{ key:"horario", label:"Aulas" },{ key:"coaching", label:"Coaching" },{ key:"disponiveis", label:"Disponíveis" },{ key:"marcar", label:"+ Marcar coaching" }] as const;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase" as const, color: "var(--accent-muted)", marginBottom: 10, fontWeight: 300 }}>Selecionar educando</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {educandos.map(e => (
            <button key={e.id} onClick={() => selecionar(e)}
              style={{ background: sel?.id===e.id ? "var(--panel-dark)" : "#fff", border: "1px solid", borderColor: sel?.id===e.id ? "var(--panel-dark)" : "var(--border-warm)", borderRadius: 20, color: sel?.id===e.id ? "var(--accent-gold)" : "var(--panel-dark)", fontSize: 13, padding: "7px 18px", cursor: "pointer", fontFamily: "Lato, sans-serif", fontWeight: 300 }}>
              {e.nome}
            </button>
          ))}
          {educandos.length === 0 && <span style={{ color: "var(--accent-muted)", fontSize: 13, fontWeight: 300 }}>Sem educandos associados.</span>}
        </div>
      </div>

      {sel && <>
        <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
        {loading ? <Loader /> : <>
          {tab==="horario"      && <GrelhaHorario aulas={semana} titulo={`Aulas de ${sel.nome}`} semanaOffset={offset} onPrev={()=>setOffset(o=>o-1)} onNext={()=>setOffset(o=>o+1)} />}
          {tab==="coaching"     && <div><SectionTitle>Coachings de {sel.nome}</SectionTitle>{coaching.length===0&&<Empty>Sem coachings marcados.</Empty>}<CoachingGrid items={coaching} onAction={cancelar} actionLabel="Cancelar" actionPerigo /></div>}
          {tab==="disponiveis"  && <div><SectionTitle>Coachings disponíveis</SectionTitle>{disponiveis.length===0&&<Empty>Sem coachings disponíveis.</Empty>}<CoachingGrid items={disponiveis} onAction={inscrever} actionLabel="Inscrever" /></div>}
          {tab==="marcar"       && (
            <div style={{ maxWidth: 520 }}>
              <SectionTitle>Marcar coaching para {sel.nome}</SectionTitle>
              <MarcarCoachingForm onSubmit={marcar} err={err} ok={ok} />
            </div>
          )}
        </>}
      </>}
    </div>
  );
}

function ProfessorView({ userName }: { userName: string }) {
  const [horario, setHorario]   = useState<AulaDto[]>([]);
  const [pendentes, setPend]    = useState<CoachingDto[]>([]);
  const [disps, setDisps]       = useState<DisponibilidadeDto[]>([]);
  const [offset, setOffset]     = useState(0);
  const [tab, setTab]           = useState<"horario"|"coaching"|"disponibilidade">("horario");
  const [loading, setLoading]   = useState(true);
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
  const addDisp   = async () => { try { setDispErr(""); await apiFetch(`/disponibilidade/professor`,{method:"POST",body:JSON.stringify(dispForm)}); setDispForm({diaSemana:1,horaInicio:"",horaFim:"",validoDe:"",validoAte:""}); load(); } catch(e:unknown){setDispErr(String(e));} };
  const removeDisp= async (id: string) => { await apiFetch(`/disponibilidade/professor/${id}`,{method:"DELETE"}); load(); };

  const TABS = [{ key:"horario", label:"Horário semanal" },{ key:"coaching", label:"Coachings pendentes" },{ key:"disponibilidade", label:"Disponibilidade" }] as const;

  return (
    <div>
      <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
      {loading ? <Loader /> : <>
        {tab==="horario" && <GrelhaHorario aulas={horario} titulo={`Horário de ${userName.split(" ")[0]}`} semanaOffset={offset} onPrev={()=>setOffset(o=>o-1)} onNext={()=>setOffset(o=>o+1)} />}

        {tab==="coaching" && (
          <div>
            <SectionTitle>Pedidos de coaching pendentes</SectionTitle>
            {pendentes.length===0 && <Empty>Sem coachings pendentes.</Empty>}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {pendentes.map(c => (
                <div key={c.aulaDto.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:8, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontWeight:400, fontSize:14, color:"var(--panel-dark)", marginBottom:4 }}>{c.modalidadeDto?.nome}</div>
                    <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:6, fontWeight:300 }}>{c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                    {c.estadoAulaDto && <EstadoBadge estado={c.estadoAulaDto.estado} />}
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <BtnPrimario label="✓ Confirmar" onClick={()=>confirmar(c.aulaDto.id)} small />
                    <BtnPerigo   label="✕ Rejeitar"  onClick={()=>rejeitar(c.aulaDto.id)}  small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="disponibilidade" && (
          <div>
            <SectionTitle>Nova disponibilidade</SectionTitle>
            {dispErr && <ErrMsg msg={dispErr} />}
            <FormCard style={{ maxWidth: 480, marginBottom: 24 }}>
              <SelectField label="Dia da semana" value={dispForm.diaSemana.toString()} onChange={v=>setDispForm(f=>({...f,diaSemana:parseInt(v)}))} options={DIAS_OPTIONS.map(d=>({value:d.value.toString(),label:d.label}))} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <InputField label="Hora início" type="time" value={dispForm.horaInicio} onChange={v=>setDispForm(f=>({...f,horaInicio:v}))} />
                <InputField label="Hora fim"    type="time" value={dispForm.horaFim}    onChange={v=>setDispForm(f=>({...f,horaFim:v}))} />
                <InputField label="Válido de"   type="date" value={dispForm.validoDe}   onChange={v=>setDispForm(f=>({...f,validoDe:v}))} />
                <InputField label="Válido até"  type="date" value={dispForm.validoAte}  onChange={v=>setDispForm(f=>({...f,validoAte:v}))} />
              </div>
              <BtnPrimario label="Adicionar disponibilidade" onClick={addDisp} />
            </FormCard>
            <SectionTitle>As minhas disponibilidades</SectionTitle>
            {disps.length===0 && <Empty>Sem disponibilidades registadas.</Empty>}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {disps.map(d => (
                <div key={d.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:8, padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <span style={{ fontSize:13, color:"var(--panel-dark)", fontWeight:400 }}>{DIAS_OPTIONS.find(x=>x.value===d.diaSemana)?.label??d.diaSemana} · {d.horaInicio} – {d.horaFim}</span>
                    {d.validoDe && <span style={{ fontSize:11, color:"var(--accent-muted)", marginLeft:10, fontWeight:300 }}>{d.validoDe} → {d.validoAte}</span>}
                  </div>
                  <BtnPerigo label="Remover" onClick={()=>removeDisp(d.id)} small />
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

function CoordenacaoView() {
  const [horarios, setHorarios]   = useState<HorarioFixoDto[]>([]);
  const [turmas, setTurmas]       = useState<TurmaDto[]>([]);
  const [estudios, setEst]        = useState<EstudioDto[]>([]);
  const [professores, setProfs]   = useState<ResumoDto[]>([]);
  const [coachings, setCoachings] = useState<CoachingDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"horarios"|"coaching">("horarios");
  const [showForm, setShowForm]   = useState(false);
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

  const openEdit = (h: HorarioFixoDto) => { setForm({idturma:h.idturmaId?.id??"",estudioId:h.estudioId?.id??"",idProfessor:"",dataInicio:h.dataInicio??"",dataValidade:h.dataValidade??"",diaSemana:h.diaSemana??"",horaInicio:h.horaInicio??"",horaFim:h.horaFim??"",duracaoMinutos:h.duracaoMinutos}); setEditId(h.id); setErr(""); setShowForm(true); };
  const submit = async () => {
    setErr("");
    try {
      const body = { id:editId??null, idcriadoPor:userId, idturma:form.idturma, estudioId:form.estudioId, dataInicio:form.dataInicio, dataValidade:form.dataValidade, diaSemana:form.diaSemana?parseInt(form.diaSemana):null, horaInicio:form.horaInicio, horaFim:form.horaFim, duracaoMinutos:form.duracaoMinutos };
      if (editId) await apiFetch(`${API}/${editId}?idProfessor=${form.idProfessor}`,{method:"PUT",body:JSON.stringify(body)});
      else        await apiFetch(`${API}/criar?idProfessor=${form.idProfessor}`,{method:"POST",body:JSON.stringify(body)});
      setShowForm(false); load();
    } catch(e:unknown) { setErr(String(e)); }
  };
  const del = async (id: string) => { if (!confirm("Eliminar este horário e todas as aulas geradas?")) return; await apiFetch(`${API}/${id}`,{method:"DELETE"}); load(); };
  const validarC   = async (id: string) => { await apiFetch(`${API}/coaching/${id}/validar`,{method:"PUT"}); load(); };
  const eliminarC  = async (id: string) => { await apiFetch(`${API}/coaching/${id}`,{method:"DELETE"}); load(); };
  const f = (k: keyof typeof form, v: string) => setForm(prev=>({...prev,[k]:v}));

  const TABS = [{ key:"horarios", label:"Horários fixos" },{ key:"coaching", label:"Todos os coachings" }] as const;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", background:"rgba(44,31,20,0.05)", border:"1px solid var(--border-warm)", borderLeft:"3px solid var(--panel-dark)", borderRadius:6, marginBottom:20, fontSize:13, color:"var(--panel-dark)", fontWeight:300 }}>
        Vista de Coordenação · Gestão completa de horários e coachings
      </div>
      <Tabs tabs={TABS as any} active={tab} onChange={setTab as any} />
      {loading ? <Loader /> : <>
        {tab==="horarios" && (
          <div>
            <div style={{ marginBottom:20 }}>
              <BtnPrimario label="+ Criar horário" onClick={()=>{setForm(emptyForm);setEditId(null);setErr("");setShowForm(true);}} />
            </div>
            {showForm && (
              <FormCard style={{ marginBottom:24, borderLeft:"3px solid var(--accent-gold)" }}>
                <div style={{ fontSize:11, fontWeight:400, letterSpacing:2, textTransform:"uppercase" as const, color:"var(--accent-gold)", marginBottom:16 }}>{editId?"Editar horário":"Novo horário"}</div>
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
                <div style={{ display:"flex", gap:10, marginTop:8 }}>
                  <BtnPrimario label={editId?"Atualizar":"Criar"} onClick={submit} />
                  <BtnSecundario label="Cancelar" onClick={()=>setShowForm(false)} />
                </div>
              </FormCard>
            )}
            {horarios.length===0 && !showForm && <Empty>Sem horários criados.</Empty>}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {horarios.map(h => (
                <div key={h.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:8, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:14, color:"var(--panel-dark)", fontWeight:400, marginBottom:6 }}>
                      {DIAS_OPTIONS.find(d=>d.label===h.diaSemana||d.value.toString()===h.diaSemana)?.label??h.diaSemana} · {h.horaInicio} – {h.horaFim}
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                      {h.idturmaId && <span style={{ background:"rgba(44,31,20,0.08)", color:"var(--panel-dark)", borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:400 }}>{h.idturmaId.nome}</span>}
                      {h.estudioId && <span style={{ background:"rgba(160,133,96,0.12)", color:"var(--accent-muted)", borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:400 }}>📍 {h.estudioId.nome}</span>}
                    </div>
                    <div style={{ fontSize:11, color:"var(--accent-muted)", fontWeight:300 }}>{h.dataInicio} → {h.dataValidade} · {h.duracaoMinutos} min</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <BtnSecundario label="Editar"   onClick={()=>openEdit(h)} small />
                    <BtnPerigo     label="Eliminar" onClick={()=>del(h.id)}   small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="coaching" && (
          <div>
            <SectionTitle>Todos os coachings</SectionTitle>
            {coachings.length===0 && <Empty>Sem coachings.</Empty>}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {coachings.map(c => (
                <div key={c.aulaDto.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:8, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:14, color:"var(--panel-dark)", fontWeight:400, marginBottom:4 }}>{c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                    {c.professorDto && <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:6, fontWeight:300 }}>Prof. {c.professorDto.utilizadores?.nome||"Não atribuído"}</div>}
                    <EstadoBadge estado={c.estadoAulaDto?.estado??"—"} />
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <BtnPrimario label="Validar"   onClick={()=>validarC(c.aulaDto.id)}  small />
                    <BtnPerigo   label="Eliminar"  onClick={()=>eliminarC(c.aulaDto.id)} small />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

// ─── Micro-componentes de layout ──────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10, fontWeight:400, letterSpacing:2, textTransform:"uppercase" as const, color:"var(--accent-muted)", marginBottom:14 }}>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color:"var(--accent-muted)", fontSize:13, fontWeight:300, marginBottom:16 }}>{children}</p>;
}
function FormCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:8, padding:"20px 24px", ...style }}>{children}</div>;
}
function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:10, fontWeight:400, letterSpacing:2, color:"var(--accent-muted)", marginBottom:5, textTransform:"uppercase" as const }}>{label}</label>
      <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3}
        style={{ width:"100%", background:"#fff", border:"1px solid var(--border-warm)", borderRadius:6, color:"var(--panel-dark)", padding:"9px 12px", fontSize:13, outline:"none", resize:"vertical", boxSizing:"border-box" as const, fontFamily:"Lato, sans-serif" }} />
    </div>
  );
}
function CoachingGrid({ items, onAction, actionLabel, actionPerigo }: { items: CoachingDto[]; onAction: (id: string) => void; actionLabel: string; actionPerigo?: boolean }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {items.map(c => (
        <div key={c.aulaDto.id} style={{ background:"#fff", border:"1px solid var(--border-warm)", borderRadius:8, padding:"16px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ fontWeight:400, fontSize:14, color:"var(--panel-dark)" }}>{c.modalidadeDto?.nome}</div>
            <EstadoBadge estado={c.estadoAulaDto?.estado??"PENDENTE"} />
          </div>
          <div style={{ fontSize:12, color:"var(--accent-muted)", marginBottom:4, fontWeight:300 }}>{c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
          {c.professorDto && <div style={{ fontSize:11, color:"var(--accent-muted)", marginBottom:12, fontWeight:300 }}>Prof. {c.professorDto.utilizadores?.nome||"—"}</div>}
          {actionPerigo
            ? <BtnPerigo   label={actionLabel} onClick={()=>onAction(c.aulaDto.id)} small />
            : <BtnPrimario label={actionLabel} onClick={()=>onAction(c.aulaDto.id)} small />}
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HorariosPage() {
  const router                          = useRouter();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [userName, setUserName]         = useState("");
  const [role, setRole]                 = useState<Role|null>(null);

  useEffect(() => {
    const { nome, role } = getUserData();
    setUserName(nome);
    setRole(role);
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key==="Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const handleLogout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/"); };

  const initials = userName ? userName.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase() : "U";

  const roleLabel: Record<Role, string> = {
    ALUNO:       "Aluno",
    ENCARREGADO: "Encarregado",
    PROFESSOR:   "Professor",
    COORDENACAO: "Coordenação",
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:"var(--background)", fontFamily:"var(--font-lato)" }}>

        <Navbar userName={userName} initials={initials} onDrawer={() => setDrawerOpen(true)} />

        <div style={{ display:"flex", flex:1, position:"relative", overflow:"hidden" }}>
          <Drawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} currentHref="/horarios" onLogout={handleLogout} />

          <main style={{ flex:1, overflowY:"auto", padding:"28px 28px 40px" }}>

            {/* Cabeçalho da secção */}
            <div style={{ marginBottom:28 }}>
              <p style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--accent-muted)", fontWeight:300, marginBottom:4 }}>
                {role ? roleLabel[role] : "—"}
              </p>
              <h1 style={{ fontFamily:"var(--font-playfair)", fontSize:26, color:"var(--panel-dark)", fontWeight:400, marginBottom:0 }}>
                Horários
              </h1>
            </div>

            {!role ? (
              <div style={{ textAlign:"center", padding:80 }}>
                <p style={{ fontFamily:"var(--font-playfair)", fontSize:20, color:"var(--panel-dark)", marginBottom:8 }}>Sem sessão iniciada</p>
                <p style={{ fontSize:13, color:"var(--accent-muted)", fontWeight:300 }}>Faz login para aceder aos horários.</p>
              </div>
            ) : (
              <>
                {role==="ALUNO"       && <AlunoView       userName={userName} />}
                {role==="ENCARREGADO" && <EncarregadoView userName={userName} />}
                {role==="PROFESSOR"   && <ProfessorView   userName={userName} />}
                {role==="COORDENACAO" && <CoordenacaoView />}
              </>
            )}

          </main>
        </div>

        <Footer />
      </div>
    </>
  );
}