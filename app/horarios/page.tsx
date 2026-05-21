"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface ResumoDto { id: string; nome: string }
interface TurmaDto   { id: string; nome: string; modalidade?: ResumoDto }
interface EstudioDto { id: string; nome: string }
interface AulaDto    {
  id: string; titulo?: string; dataAula?: string; horaInicio?: string; horaFim?: string;
  turma?: TurmaDto; estudio?: EstudioDto; professor?: ResumoDto; diaSemana?: string;
}
interface CoachingDto {
  aulaDto: { id: string; dataAula: string; horaInicio: string; horaFim: string; duracaoMinutos: number; };
  modalidadeDto: { id: string; nome: string; };
  estadoAulaDto: { id: string; estado: string; };
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
  { value: 3, label: "QUARTA" },  { value: 4, label: "QUINTA" },
  { value: 5, label: "SEXTA" },   { value: 6, label: "SÁBADO" },
  { value: 7, label: "DOMINGO" }
];

// Horas do dia para mostrar na grelha (das 8h às 22h)
const HORAS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

// Cores para as aulas na grelha
const AULA_CORES = ["#d4edda", "#fff3cd", "#fce4ec", "#e3f2fd", "#f3e5f5", "#fff8e1", "#e8f5e9"];
const AULA_CORES_TEXTO = ["#2d6a4f", "#856404", "#880e4f", "#0d47a1", "#4a148c", "#e65100", "#1b5e20"];
const AULA_CORES_BORDA = ["#a8d5b5", "#ffc107", "#f48fb1", "#90caf9", "#ce93d8", "#ffcc02", "#a5d6a7"];

function getToken()  { return localStorage.getItem("token") ?? ""; }
function getRole(): Role | null {
  const userData = localStorage.getItem("user");
  if (!userData) return null;
  try {
    const user = JSON.parse(userData);
    return (user.tipoUtilizadorId as Role) ?? null;
  } catch { return null; }
}
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}
async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${BASE}${url}`;
  const res = await fetch(fullUrl, { ...opts, headers: { ...authHeaders(), ...(opts.headers ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Estilos globais ──────────────────────────────────────────────────────────

const globalStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@300;400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #f7f5f2; color: #333; font-family: 'Lato', sans-serif; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  select, input, textarea { font-family: 'Lato', sans-serif; }
  select option { background: #fff; color: #333; }
  input[type="time"]::-webkit-calendar-picker-indicator,
  input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
  .tab-btn { transition: all 0.15s; }
  .tab-btn:hover { opacity: 0.8; }
  .aula-cell:hover { filter: brightness(0.95); cursor: default; }
  .btn-action { transition: all 0.15s; }
  .btn-action:hover { opacity: 0.8; transform: translateY(-1px); }
`;

// ─── Componentes básicos ──────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: "3px solid #e0d9d0", borderTopColor: "#c9974a",
        animation: "spin 0.8s linear infinite"
      }} />
    </div>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return (
    <div style={{ color: "#c0392b", padding: "10px 14px", background: "#fde8e8", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #f5c6cb" }}>
      ⚠️ {msg}
    </div>
  );
}

function OkMsg({ msg }: { msg: string }) {
  return (
    <div style={{ color: "#27ae60", padding: "10px 14px", background: "#eafaf1", borderRadius: 6, marginBottom: 12, fontSize: 13, border: "1px solid #a9dfbf" }}>
      ✓ {msg}
    </div>
  );
}

function InfoBanner({ msg }: { msg: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#fef9f0", border: "1px solid #f5e6c8", borderRadius: 6, marginBottom: 20, fontSize: 13, color: "#856404" }}>
      <span>🔒</span> {msg}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const cores: Record<string, { bg: string; text: string; label: string }> = {
    CONFIRMADO:  { bg: "#d4edda", text: "#155724", label: "CONFIRMADO" },
    PENDENTE:    { bg: "#fff3cd", text: "#856404", label: "PENDENTE" },
    LISTA_ESPERA:{ bg: "#fce4ec", text: "#880e4f", label: "LISTA DE ESPERA" },
    CANCELADO:   { bg: "#f8d7da", text: "#721c24", label: "CANCELADO" },
  };
  const c = cores[estado] ?? { bg: "#e9ecef", text: "#495057", label: estado };
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
      {c.label}
    </span>
  );
}

function BtnPrimario({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button className="btn-action" onClick={onClick} style={{
      background: "#c9974a", border: "none", borderRadius: 6, color: "#fff",
      fontWeight: 700, fontSize: small ? 11 : 13, padding: small ? "5px 12px" : "9px 18px",
      cursor: "pointer", letterSpacing: 0.3, fontFamily: "Lato, sans-serif"
    }}>{label}</button>
  );
}

function BtnSecundario({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button className="btn-action" onClick={onClick} style={{
      background: "transparent", border: "1px solid #c9974a", borderRadius: 6, color: "#c9974a",
      fontWeight: 700, fontSize: small ? 11 : 13, padding: small ? "4px 11px" : "8px 17px",
      cursor: "pointer", letterSpacing: 0.3, fontFamily: "Lato, sans-serif"
    }}>{label}</button>
  );
}

function BtnPerigo({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button className="btn-action" onClick={onClick} style={{
      background: "transparent", border: "1px solid #e74c3c", borderRadius: 6, color: "#e74c3c",
      fontWeight: 700, fontSize: small ? 11 : 13, padding: small ? "4px 11px" : "8px 17px",
      cursor: "pointer", letterSpacing: 0.3, fontFamily: "Lato, sans-serif"
    }}>{label}</button>
  );
}

function InputField({ label, type = "text", value, onChange, min }: {
  label: string; type?: string; value: string | number; onChange: (v: string) => void; min?: string | number;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#888", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} min={min}
        style={{ width: "100%", background: "#fff", border: "1px solid #ddd", borderRadius: 6, color: "#333", padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#888", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", background: "#fff", border: "1px solid #ddd", borderRadius: 6, color: "#333", padding: "9px 12px", fontSize: 14, outline: "none", cursor: "pointer" }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Grelha semanal (calendário visual) ──────────────────────────────────────

// Converte "HH:MM" para minutos desde meia-noite
function horaParaMin(h: string): number {
  if (!h) return 0;
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

// Mapeia diaSemana (texto ou número) para índice 0-6
function diaParaIdx(dia: string | undefined): number {
  if (!dia) return -1;
  const upper = dia.toUpperCase();
  const mapa: Record<string, number> = {
    "SEGUNDA": 0, "SEGUNDA-FEIRA": 0,
    "TERÇA": 1, "TERCA": 1, "TERÇA-FEIRA": 1,
    "QUARTA": 2, "QUARTA-FEIRA": 2,
    "QUINTA": 3, "QUINTA-FEIRA": 3,
    "SEXTA": 4, "SEXTA-FEIRA": 4,
    "SÁBADO": 5, "SABADO": 5,
    "DOMINGO": 6,
  };
  return mapa[upper] ?? -1;
}

function GrelhaHorario({ aulas, titulo, semanaOffset, onPrev, onNext }: {
  aulas: AulaDto[];
  titulo: string;
  semanaOffset: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const HORA_INICIO = 8;   // 8h
  const HORA_FIM = 22;     // 22h
  const TOTAL_MIN = (HORA_FIM - HORA_INICIO) * 60;
  const ALTURA_GRELHA = 480; // px total para as horas

  // Agrupar aulas por dia da semana
  const aulasPorDia: AulaDto[][] = Array.from({ length: 7 }, () => []);
  aulas.forEach(a => {
    const idx = diaParaIdx(a.diaSemana);
    if (idx >= 0) aulasPorDia[idx].push(a);
  });

  function posicaoAula(hora: string): number {
    const min = horaParaMin(hora) - HORA_INICIO * 60;
    return (min / TOTAL_MIN) * ALTURA_GRELHA;
  }
  function alturaAula(inicio: string, fim: string): number {
    const diff = horaParaMin(fim) - horaParaMin(inicio);
    return Math.max((diff / TOTAL_MIN) * ALTURA_GRELHA, 22);
  }

  const semanaLabel = semanaOffset === 0 ? "Esta semana" : semanaOffset > 0 ? `+${semanaOffset} semanas` : `${semanaOffset} semanas`;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Navegação de semana */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#888", fontStyle: "italic" }}>{titulo}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onPrev} style={{ background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: "#555", fontSize: 13 }}>← Anterior</button>
          <span style={{ fontSize: 13, color: "#666", minWidth: 100, textAlign: "center" }}>{semanaLabel}</span>
          <button onClick={onNext} style={{ background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: "#555", fontSize: 13 }}>Próxima →</button>
        </div>
      </div>

      {/* Grelha */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 700, display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", border: "1px solid #e8e0d5", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
          {/* Cabeçalho dias */}
          <div style={{ background: "#faf8f5", borderBottom: "1px solid #e8e0d5" }} />
          {DIAS.map(dia => (
            <div key={dia} style={{ background: "#faf8f5", borderBottom: "1px solid #e8e0d5", borderLeft: "1px solid #e8e0d5", padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#666" }}>
              {dia}
            </div>
          ))}

          {/* Coluna das horas + colunas de dias */}
          <div style={{ position: "relative", height: ALTURA_GRELHA }}>
            {/* Linhas de hora na coluna de horas */}
            {HORAS.map((h, i) => {
              const top = ((horaParaMin(h) - HORA_INICIO * 60) / TOTAL_MIN) * ALTURA_GRELHA;
              return (
                <div key={h} style={{ position: "absolute", top, left: 0, right: 0, borderTop: i === 0 ? "none" : "1px solid #eee", display: "flex", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, color: "#aaa", padding: "0 4px", lineHeight: 1, marginTop: -6 }}>{h}</span>
                </div>
              );
            })}
          </div>

          {/* Colunas dos dias com aulas */}
          {DIAS.map((_, dIdx) => (
            <div key={dIdx} style={{ position: "relative", height: ALTURA_GRELHA, borderLeft: "1px solid #e8e0d5" }}>
              {/* Linhas de horas */}
              {HORAS.map((h, i) => {
                const top = ((horaParaMin(h) - HORA_INICIO * 60) / TOTAL_MIN) * ALTURA_GRELHA;
                return <div key={h} style={{ position: "absolute", top, left: 0, right: 0, borderTop: i === 0 ? "none" : "1px solid #f0ece6", height: 1 }} />;
              })}

              {/* Aulas */}
              {aulasPorDia[dIdx].map((a, aIdx) => {
                const top = posicaoAula(a.horaInicio ?? "08:00");
                const height = alturaAula(a.horaInicio ?? "08:00", a.horaFim ?? "09:00");
                const cor = aIdx % AULA_CORES.length;
                return (
                  <div key={a.id} className="aula-cell" style={{
                    position: "absolute", top: top + 1, left: 3, right: 3, height: height - 2,
                    background: AULA_CORES[cor], border: `1px solid ${AULA_CORES_BORDA[cor]}`,
                    borderRadius: 4, padding: "3px 5px", overflow: "hidden"
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: AULA_CORES_TEXTO[cor], lineHeight: 1.2 }}>
                      {a.turma?.nome ?? a.titulo ?? "Aula"}
                    </div>
                    <div style={{ fontSize: 9, color: AULA_CORES_TEXTO[cor], opacity: 0.8, marginTop: 1 }}>
                      {a.horaInicio} – {a.horaFim}
                    </div>
                    {height > 36 && a.professor && (
                      <div style={{ fontSize: 9, color: AULA_CORES_TEXTO[cor], opacity: 0.7 }}>
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
  );
}

// ─── ALUNO view ───────────────────────────────────────────────────────────────

function AlunoView() {
  const [semana, setSemana] = useState<AulaDto[]>([]);
  const [coaching, setCoaching] = useState<CoachingDto[]>([]);
  const [disponiveis, setDisponiveis] = useState<CoachingDto[]>([]);
  const [professores, setProfessores] = useState<ResumoDto[]>([]);
  const [modalidades, setModalidades] = useState<ResumoDto[]>([]);
  const [estudios, setEstudios] = useState<ResumoDto[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"horario" | "coaching" | "disponiveis" | "marcar">("horario");
  const [marcarForm, setMarcarForm] = useState({ professorId: "", modalidadeId: "", estudioId: "", dataAula: "", horaInicio: "", horaFim: "", maxAlunos: 1, descricao: "" });
  const [marcarErr, setMarcarErr] = useState("");
  const [marcarOk, setMarcarOk] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<AulaDto[]>(`${API}/semana?offset=${offset}`),
      api<{ content: CoachingDto[] }>(`${API}/coaching`),
      api<{ content: CoachingDto[] }>(`${API}/coachingsdisponiveis?offset=${offset}`),
      api<ResumoDto[]>(`${BASE}/api/professores/selecionar`).catch(() => []),
      api<ResumoDto[]>(`${BASE}/api/modalidades`).catch(() => []),
      api<ResumoDto[]>(`${BASE}/api/estudios`).catch(() => []),
    ]).then(([s, c, d, p, m, e]) => {
      setSemana(s ?? []);
      setCoaching(c?.content ?? []);
      setDisponiveis(d?.content ?? []);
      setProfessores(p ?? []);
      setModalidades(m ?? []);
      setEstudios(e ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [offset]);

  const cancelar = async (id: string) => {
    await api(`${API}/cancelarCoaching/${id}`, { method: "DELETE" });
    setCoaching(c => c.filter(x => x.aulaDto.id !== id));
  };
  const inscrever = async (id: string) => {
    await api(`${API}/inscreverEmCoaching/${id}`, { method: "POST" });
    const upd = await api<{ content: CoachingDto[] }>(`${API}/coaching`);
    setCoaching(upd?.content ?? []);
  };
  const marcarCoaching = async () => {
    setMarcarErr(""); setMarcarOk("");
    try {
      await api(`${API}/marcarcoaching`, { method: "POST", body: JSON.stringify(marcarForm) });
      setMarcarOk("Coaching marcado! Aguarda confirmação do professor.");
      setMarcarForm({ professorId: "", modalidadeId: "", estudioId: "", dataAula: "", horaInicio: "", horaFim: "", maxAlunos: 8, descricao: "" });
      const upd = await api<{ content: CoachingDto[] }>(`${API}/coaching`);
      setCoaching(upd?.content ?? []);
    } catch (e: unknown) { setMarcarErr(String(e)); }
  };

  const TABS = [
    { key: "horario", label: "AULAS" },
    { key: "coaching", label: "COACHING" },
    { key: "disponiveis", label: "DISPONÍVEIS" },
    { key: "marcar", label: "+ MARCAR COACHING" },
  ] as const;

  return (
    <div>
      <InfoBanner msg="Aulas do seu educando · Pode marcar novas aulas nas disponibilidades abertas" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e8e0d5" }}>
        {TABS.map(t => (
          <button key={t.key} className="tab-btn" onClick={() => setTab(t.key as any)} style={{
            background: "none", border: "none", borderBottom: tab === t.key ? "2px solid #c9974a" : "2px solid transparent",
            marginBottom: -2, padding: "10px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 1,
            color: tab === t.key ? "#c9974a" : "#999", cursor: "pointer"
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {tab === "horario" && (
            <GrelhaHorario
              aulas={semana} titulo="Aulas do João"
              semanaOffset={offset} onPrev={() => setOffset(o => o - 1)} onNext={() => setOffset(o => o + 1)}
            />
          )}

          {tab === "coaching" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>OS MEUS COACHINGS</div>
              {coaching.length === 0 && <p style={{ color: "#aaa", fontSize: 14 }}>Sem coachings marcados.</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {coaching.map(c => (
                  <div key={c.aulaDto.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#333" }}>{c.modalidadeDto?.nome}</div>
                      <EstadoBadge estado={c.estadoAulaDto?.estado ?? "PENDENTE"} />
                    </div>
                    <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                      {c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}
                    </div>
                    {c.professorDto && (
                      <div style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
                        Prof. {c.professorDto.utilizadores?.nome || "—"}
                      </div>
                    )}
                    <BtnPerigo label="Cancelar" onClick={() => cancelar(c.aulaDto.id)} small />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "disponiveis" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>COACHINGS DISPONÍVEIS</div>
              {disponiveis.length === 0 && <p style={{ color: "#aaa", fontSize: 14 }}>Sem coachings disponíveis nesta semana.</p>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {disponiveis.map(c => (
                  <div key={c.aulaDto.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "16px 20px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#333", marginBottom: 6 }}>{c.modalidadeDto?.nome}</div>
                    <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                      {c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}
                    </div>
                    {c.professorDto && (
                      <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
                        Prof. {c.professorDto.utilizadores?.nome || "—"}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12 }}>Vagas: {c.max_alunos}</div>
                    <BtnPrimario label="Inscrever" onClick={() => inscrever(c.aulaDto.id)} small />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "marcar" && (
            <div style={{ maxWidth: 480 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>MARCAR SESSÃO DE COACHING</div>
              {marcarErr && <ErrMsg msg={marcarErr} />}
              {marcarOk && <OkMsg msg={marcarOk} />}
              <div style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "20px 24px" }}>
                <SelectField label="Professor" value={marcarForm.professorId} onChange={v => setMarcarForm(f => ({ ...f, professorId: v }))}
                  options={professores.map(p => ({ value: String(p.id), label: p.nome }))} placeholder="Escolher professor..." />
                <SelectField label="Modalidade" value={marcarForm.modalidadeId} onChange={v => setMarcarForm(f => ({ ...f, modalidadeId: v }))}
                  options={modalidades.map(m => ({ value: m.id, label: m.nome }))} placeholder="Escolher modalidade..." />
                <SelectField label="Estúdio / Sala" value={marcarForm.estudioId} onChange={v => setMarcarForm(f => ({ ...f, estudioId: v }))}
                  options={estudios.map(e => ({ value: e.id, label: e.nome }))} placeholder="Escolher sala..." />
                <InputField label="Data" type="date" value={marcarForm.dataAula} onChange={v => setMarcarForm(f => ({ ...f, dataAula: v }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <InputField label="Hora Início" type="time" value={marcarForm.horaInicio} onChange={v => setMarcarForm(f => ({ ...f, horaInicio: v }))} />
                  <InputField label="Hora Fim" type="time" value={marcarForm.horaFim} onChange={v => setMarcarForm(f => ({ ...f, horaFim: v }))} />
                  <InputField label="Máx. Alunos" type="number" min={1} value={marcarForm.maxAlunos} onChange={v => setMarcarForm(f => ({ ...f, maxAlunos: Number(v) }))} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#888", marginBottom: 5, textTransform: "uppercase" }}>Notas</label>
                  <textarea value={marcarForm.descricao} onChange={e => setMarcarForm(f => ({ ...f, descricao: e.target.value }))}
                    rows={3} style={{ width: "100%", background: "#fff", border: "1px solid #ddd", borderRadius: 6, color: "#333", padding: "9px 12px", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "Lato, sans-serif" }} />
                </div>
                <BtnPrimario label="Enviar Pedido de Coaching" onClick={marcarCoaching} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── ENCARREGADO view ─────────────────────────────────────────────────────────

function EncarregadoView() {
  const [educandos, setEducandos] = useState<ResumoDto[]>([]);
  const [educandoSel, setEducandoSel] = useState<ResumoDto | null>(null);
  const [semana, setSemana] = useState<AulaDto[]>([]);
  const [coaching, setCoaching] = useState<CoachingDto[]>([]);
  const [disponiveis, setDisponiveis] = useState<CoachingDto[]>([]);
  const [professores, setProfessores] = useState<ResumoDto[]>([]);
  const [modalidades, setModalidades] = useState<ResumoDto[]>([]);
  const [estudios, setEstudios] = useState<ResumoDto[]>([]);
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<"horario" | "coaching" | "disponiveis" | "marcar">("horario");
  const [loading, setLoading] = useState(false);
  const [marcarForm, setMarcarForm] = useState({ professorId: "", modalidadeId: "", estudioId: "", dataAula: "", horaInicio: "", horaFim: "", maxAlunos: 8, descricao: "" });
  const [marcarErr, setMarcarErr] = useState("");
  const [marcarOk, setMarcarOk] = useState("");

  useEffect(() => {
    Promise.all([
      api<ResumoDto[]>(`${BASE}/api/utilizadores/meus-educandos`).catch(() => [] as ResumoDto[]),
      api<ResumoDto[]>(`${BASE}/api/professores/selecionar`).catch(() => [] as ResumoDto[]),
      api<ResumoDto[]>(`${BASE}/api/modalidades`).catch(() => [] as ResumoDto[]),
      api<ResumoDto[]>(`${BASE}/api/estudios`).catch(() => [] as ResumoDto[]),
    ]).then(([e, p, m, est]) => {
      setEducandos(e ?? []);
      setProfessores(p ?? []);
      setModalidades(m ?? []);
      setEstudios(est ?? []);
    });
  }, []);

  useEffect(() => {
    if (!educandoSel) return;
    setLoading(true);
    Promise.all([
      api<AulaDto[]>(`${API}/semana/educando/${educandoSel.id}?offset=${offset}`),
      api<{ content: CoachingDto[] }>(`${API}/coaching/educando/${educandoSel.id}`),
      api<{ content: CoachingDto[] }>(`${API}/coachingsdisponiveis/educando/${educandoSel.id}?offset=0`),
    ]).then(([s, c, d]) => {
      setSemana(s ?? []);
      setCoaching(c?.content ?? []);
      setDisponiveis(d?.content ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [educandoSel, offset]);

  const selecionar = (e: ResumoDto) => {
    setEducandoSel(e); setOffset(0); setTab("horario"); setMarcarErr(""); setMarcarOk("");
  };
  const inscrever = async (aulaId: string) => {
    if (!educandoSel) return;
    await api(`${API}/inscreverEmCoaching/${aulaId}/educando/${educandoSel.id}`, { method: "POST" });
    const upd = await api<{ content: CoachingDto[] }>(`${API}/coaching/educando/${educandoSel.id}`);
    setCoaching(upd?.content ?? []);
  };
  const cancelar = async (aulaId: string) => {
    if (!educandoSel) return;
    await api(`${API}/cancelarCoaching/${aulaId}/educando/${educandoSel.id}`, { method: "DELETE" });
    setCoaching(c => c.filter(x => x.aulaDto.id !== aulaId));
  };
  const marcarCoaching = async () => {
    if (!educandoSel) return;
    setMarcarErr(""); setMarcarOk("");
    try {
      await api(`${API}/marcarcoaching/educando/${educandoSel.id}`, { method: "POST", body: JSON.stringify(marcarForm) });
      setMarcarOk("Coaching marcado! Aguarda confirmação do professor.");
      setMarcarForm({ professorId: "", modalidadeId: "", estudioId: "", dataAula: "", horaInicio: "", horaFim: "", maxAlunos: 8, descricao: "" });
      const upd = await api<{ content: CoachingDto[] }>(`${API}/coaching/educando/${educandoSel.id}`);
      setCoaching(upd?.content ?? []);
    } catch (e: unknown) { setMarcarErr(String(e)); }
  };

  const TABS = [
    { key: "horario", label: "AULAS" },
    { key: "coaching", label: "COACHING" },
    { key: "disponiveis", label: "DISPONÍVEIS" },
    { key: "marcar", label: "+ MARCAR COACHING" },
  ] as const;

  return (
    <div>
      {/* Seletor de educando */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#aaa", marginBottom: 10, textTransform: "uppercase" }}>Selecionar Educando</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {educandos.map(e => (
            <button key={e.id} onClick={() => selecionar(e)} style={{
              background: educandoSel?.id === e.id ? "#c9974a" : "#fff",
              border: "1px solid", borderColor: educandoSel?.id === e.id ? "#c9974a" : "#ddd",
              borderRadius: 20, color: educandoSel?.id === e.id ? "#fff" : "#555",
              fontWeight: 600, fontSize: 13, padding: "8px 18px", cursor: "pointer", fontFamily: "Lato, sans-serif"
            }}>
              {e.nome}
            </button>
          ))}
          {educandos.length === 0 && <span style={{ color: "#aaa", fontSize: 13 }}>Sem educandos associados.</span>}
        </div>
      </div>

      {educandoSel && (
        <>
          <InfoBanner msg={`Aulas de ${educandoSel.nome} · Pode marcar novas sessões nas disponibilidades abertas`} />

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e8e0d5" }}>
            {TABS.map(t => (
              <button key={t.key} className="tab-btn" onClick={() => setTab(t.key as any)} style={{
                background: "none", border: "none", borderBottom: tab === t.key ? "2px solid #c9974a" : "2px solid transparent",
                marginBottom: -2, padding: "10px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 1,
                color: tab === t.key ? "#c9974a" : "#999", cursor: "pointer"
              }}>{t.label}</button>
            ))}
          </div>

          {loading ? <Loader /> : (
            <>
              {tab === "horario" && (
                <GrelhaHorario
                  aulas={semana} titulo={`Aulas de ${educandoSel.nome}`}
                  semanaOffset={offset} onPrev={() => setOffset(o => o - 1)} onNext={() => setOffset(o => o + 1)}
                />
              )}

              {tab === "coaching" && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>COACHINGS DE {educandoSel.nome.toUpperCase()}</div>
                  {coaching.length === 0 && <p style={{ color: "#aaa", fontSize: 14 }}>Sem coachings marcados.</p>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {coaching.map(c => (
                      <div key={c.aulaDto.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "16px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{c.modalidadeDto?.nome}</div>
                          <EstadoBadge estado={c.estadoAulaDto?.estado ?? "PENDENTE"} />
                        </div>
                        <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>{c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                        {c.professorDto && <div style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>Prof. {c.professorDto.utilizadores?.nome || "—"}</div>}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <BtnPerigo label="Cancelar" onClick={() => cancelar(c.aulaDto.id)} small />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "disponiveis" && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>COACHINGS DISPONÍVEIS</div>
                  {disponiveis.length === 0 && <p style={{ color: "#aaa", fontSize: 14 }}>Sem coachings disponíveis.</p>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {disponiveis.map(c => (
                      <div key={c.aulaDto.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "16px 20px" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{c.modalidadeDto?.nome}</div>
                        <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>{c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                        {c.professorDto && <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>Prof. {c.professorDto.utilizadores?.nome || "—"}</div>}
                        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12 }}>Vagas: {c.max_alunos}</div>
                        <BtnPrimario label="Inscrever" onClick={() => inscrever(c.aulaDto.id)} small />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "marcar" && (
                <div style={{ maxWidth: 480 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>MARCAR COACHING PARA {educandoSel.nome.toUpperCase()}</div>
                  {marcarErr && <ErrMsg msg={marcarErr} />}
                  {marcarOk && <OkMsg msg={marcarOk} />}
                  <div style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "20px 24px" }}>
                    <SelectField label="Professor" value={marcarForm.professorId} onChange={v => setMarcarForm(f => ({ ...f, professorId: v }))}
                      options={professores.map(p => ({ value: String(p.id), label: p.nome }))} placeholder="Escolher professor..." />
                    <SelectField label="Modalidade" value={marcarForm.modalidadeId} onChange={v => setMarcarForm(f => ({ ...f, modalidadeId: v }))}
                      options={modalidades.map(m => ({ value: m.id, label: m.nome }))} placeholder="Escolher modalidade..." />
                    <SelectField label="Estúdio / Sala" value={marcarForm.estudioId} onChange={v => setMarcarForm(f => ({ ...f, estudioId: v }))}
                      options={estudios.map(e => ({ value: e.id, label: e.nome }))} placeholder="Escolher sala..." />
                    <InputField label="Data" type="date" value={marcarForm.dataAula} onChange={v => setMarcarForm(f => ({ ...f, dataAula: v }))} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <InputField label="Hora Início" type="time" value={marcarForm.horaInicio} onChange={v => setMarcarForm(f => ({ ...f, horaInicio: v }))} />
                      <InputField label="Hora Fim" type="time" value={marcarForm.horaFim} onChange={v => setMarcarForm(f => ({ ...f, horaFim: v }))} />
                      <InputField label="Máx. Alunos" type="number" min={1} value={marcarForm.maxAlunos} onChange={v => setMarcarForm(f => ({ ...f, maxAlunos: Number(v) }))} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#888", marginBottom: 5, textTransform: "uppercase" }}>Notas</label>
                      <textarea value={marcarForm.descricao} onChange={e => setMarcarForm(f => ({ ...f, descricao: e.target.value }))}
                        rows={3} style={{ width: "100%", background: "#fff", border: "1px solid #ddd", borderRadius: 6, color: "#333", padding: "9px 12px", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "Lato, sans-serif" }} />
                    </div>
                    <BtnPrimario label="Enviar Pedido de Coaching" onClick={marcarCoaching} />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── PROFESSOR view ───────────────────────────────────────────────────────────

function ProfessorView() {
  const [horario, setHorario] = useState<AulaDto[]>([]);
  const [pendentes, setPendentes] = useState<CoachingDto[]>([]);
  const [disps, setDisps] = useState<DisponibilidadeDto[]>([]);
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<"horario" | "coaching" | "disponibilidade">("horario");
  const [loading, setLoading] = useState(true);
  const [dispForm, setDispForm] = useState({ diaSemana: 1, horaInicio: "", horaFim: "", validoDe: "", validoAte: "" });
  const [dispErr, setDispErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, p, d] = await Promise.all([
        api<AulaDto[]>(`${API}/professor/horario?offset=${offset}`),
        api<{ content: CoachingDto[] }>(`${API}/professor/coaching/pendentes`),
        api<DisponibilidadeDto[]>(`/disponibilidade/minhasdisponibilidades`)
      ]);
      setHorario(h ?? []); setPendentes(p?.content ?? []); setDisps(d ?? []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  const confirmar = async (id: string) => { await api(`${API}/professor/coaching/${id}/confirmar`, { method: "PUT" }); load(); };
  const rejeitar = async (id: string) => { await api(`${API}/professor/coaching/rejeitar/${id}`, { method: "PUT" }); load(); };
  const addDisp = async () => {
    try {
      setDispErr("");
      await api(`/disponibilidade/professor`, { method: "POST", body: JSON.stringify(dispForm) });
      setDispForm({ diaSemana: 1, horaInicio: "", horaFim: "", validoDe: "", validoAte: "" });
      load();
    } catch (e: unknown) { setDispErr(String(e)); }
  };
  const removeDisp = async (id: string) => { await api(`/disponibilidade/professor/${id}`, { method: "DELETE" }); load(); };

  const TABS = [
    { key: "horario", label: "HORÁRIO SEMANAL" },
    { key: "coaching", label: "COACHINGS PENDENTES" },
    { key: "disponibilidade", label: "DISPONIBILIDADE" },
  ] as const;

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e8e0d5" }}>
        {TABS.map(t => (
          <button key={t.key} className="tab-btn" onClick={() => setTab(t.key as any)} style={{
            background: "none", border: "none", borderBottom: tab === t.key ? "2px solid #c9974a" : "2px solid transparent",
            marginBottom: -2, padding: "10px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 1,
            color: tab === t.key ? "#c9974a" : "#999", cursor: "pointer"
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {tab === "horario" && (
            <GrelhaHorario
              aulas={horario} titulo="O meu horário semanal"
              semanaOffset={offset} onPrev={() => setOffset(o => o - 1)} onNext={() => setOffset(o => o + 1)}
            />
          )}

          {tab === "coaching" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>PEDIDOS DE COACHING PENDENTES</div>
              {pendentes.length === 0 && <p style={{ color: "#aaa", fontSize: 14 }}>Sem coachings pendentes.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendentes.map(c => (
                  <div key={c.aulaDto.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.modalidadeDto?.nome}</div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                      {c.estadoAulaDto && <EstadoBadge estado={c.estadoAulaDto.estado} />}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <BtnPrimario label="✓ Confirmar" onClick={() => confirmar(c.aulaDto.id)} small />
                      <BtnPerigo label="✕ Rejeitar" onClick={() => rejeitar(c.aulaDto.id)} small />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "disponibilidade" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>NOVA DISPONIBILIDADE</div>
              {dispErr && <ErrMsg msg={dispErr} />}
              <div style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "20px 24px", marginBottom: 24, maxWidth: 480 }}>
                <SelectField label="Dia da Semana" value={dispForm.diaSemana.toString()} onChange={v => setDispForm(f => ({ ...f, diaSemana: parseInt(v) }))}
                  options={DIAS_OPTIONS.map(d => ({ value: d.value.toString(), label: d.label }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <InputField label="Hora Início" type="time" value={dispForm.horaInicio} onChange={v => setDispForm(f => ({ ...f, horaInicio: v }))} />
                  <InputField label="Hora Fim" type="time" value={dispForm.horaFim} onChange={v => setDispForm(f => ({ ...f, horaFim: v }))} />
                  <InputField label="Válido De" type="date" value={dispForm.validoDe} onChange={v => setDispForm(f => ({ ...f, validoDe: v }))} />
                  <InputField label="Válido Até" type="date" value={dispForm.validoAte} onChange={v => setDispForm(f => ({ ...f, validoAte: v }))} />
                </div>
                <BtnPrimario label="Adicionar Disponibilidade" onClick={addDisp} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 12 }}>AS MINHAS DISPONIBILIDADES</div>
              {disps.length === 0 && <p style={{ color: "#aaa", fontSize: 14 }}>Sem disponibilidades registadas.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {disps.map(d => (
                  <div key={d.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>
                        {DIAS_OPTIONS.find(x => x.value === d.diaSemana)?.label ?? d.diaSemana} · {d.horaInicio} – {d.horaFim}
                      </span>
                      {d.validoDe && <span style={{ fontSize: 12, color: "#999", marginLeft: 10 }}>{d.validoDe} → {d.validoAte}</span>}
                    </div>
                    <BtnPerigo label="Remover" onClick={() => removeDisp(d.id)} small />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── COORDENAÇÃO view (admin) ─────────────────────────────────────────────────

function CoordenacaoView() {
  const [horarios, setHorarios] = useState<HorarioFixoDto[]>([]);
  const [turmas, setTurmas] = useState<TurmaDto[]>([]);
  const [estudios, setEstudios] = useState<EstudioDto[]>([]);
  const [professores, setProfessores] = useState<ResumoDto[]>([]);
  const [coachings, setCoachings] = useState<CoachingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"horarios" | "coaching">("horarios");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [userId] = useState(() => localStorage.getItem("userId") ?? "");

  const emptyForm = { idturma: "", estudioId: "", idProfessor: "", dataInicio: "", dataValidade: "", diaSemana: "", horaInicio: "", horaFim: "", duracaoMinutos: 0 };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, t, e, p, c] = await Promise.all([
        api<{ content: HorarioFixoDto[] }>(`${API}?page=0&size=50`),
        api<TurmaDto[]>(`/api/turmas`),
        api<EstudioDto[]>(`/api/estudios`),
        api<ResumoDto[]>(`/api/professores/selecionar`).catch(() => [] as ResumoDto[]),
        api<{ content: CoachingDto[] }>(`${API}/coaching/todos`)
      ]);
      setHorarios(h?.content ?? []); setTurmas(t ?? []); setEstudios(e ?? []);
      setProfessores(p ?? []); setCoachings(c?.content ?? []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (h: HorarioFixoDto) => {
    setForm({ idturma: h.idturmaId?.id ?? "", estudioId: h.estudioId?.id ?? "", idProfessor: "", dataInicio: h.dataInicio ?? "", dataValidade: h.dataValidade ?? "", diaSemana: h.diaSemana ?? "", horaInicio: h.horaInicio ?? "", horaFim: h.horaFim ?? "", duracaoMinutos: h.duracaoMinutos });
    setEditId(h.id); setErr(""); setShowForm(true);
  };
  const submit = async () => {
    setErr("");
    try {
      const body = { id: editId ?? null, idcriadoPor: userId, idturma: form.idturma, estudioId: form.estudioId, dataInicio: form.dataInicio, dataValidade: form.dataValidade, diaSemana: form.diaSemana ? parseInt(form.diaSemana.toString()) : null, horaInicio: form.horaInicio, horaFim: form.horaFim, duracaoMinutos: form.duracaoMinutos };
      if (editId) { await api(`${API}/${editId}?idProfessor=${form.idProfessor}`, { method: "PUT", body: JSON.stringify(body) }); }
      else { await api(`${API}/criar?idProfessor=${form.idProfessor}`, { method: "POST", body: JSON.stringify(body) }); }
      setShowForm(false); load();
    } catch (e: unknown) { setErr(String(e)); }
  };
  const del = async (id: string) => {
    if (!confirm("Eliminar este horário e todas as aulas geradas?")) return;
    await api(`${API}/${id}`, { method: "DELETE" }); load();
  };
  const validarCoaching = async (id: string) => { await api(`${API}/coaching/${id}/validar`, { method: "PUT" }); load(); };
  const eliminarCoaching = async (id: string) => { await api(`${API}/coaching/${id}`, { method: "DELETE" }); load(); };
  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const TABS = [
    { key: "horarios", label: "HORÁRIOS FIXOS" },
    { key: "coaching", label: "TODOS OS COACHINGS" },
  ] as const;

  return (
    <div>
      {/* Aviso admin */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#f0f4ff", border: "1px solid #cdd9f5", borderRadius: 6, marginBottom: 20, fontSize: 13, color: "#2a5298" }}>
        <span>🗂️</span> Vista de Coordenação · Gestão completa de horários e coachings
      </div>

      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e8e0d5" }}>
        {TABS.map(t => (
          <button key={t.key} className="tab-btn" onClick={() => setTab(t.key as any)} style={{
            background: "none", border: "none", borderBottom: tab === t.key ? "2px solid #c9974a" : "2px solid transparent",
            marginBottom: -2, padding: "10px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 1,
            color: tab === t.key ? "#c9974a" : "#999", cursor: "pointer"
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {tab === "horarios" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <BtnPrimario label="+ Criar Horário" onClick={() => { setForm(emptyForm); setEditId(null); setErr(""); setShowForm(true); }} />
              </div>

              {/* Formulário criar/editar */}
              {showForm && (
                <div style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "24px", marginBottom: 24, borderLeft: "4px solid #c9974a" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#c9974a", marginBottom: 16, letterSpacing: 0.5 }}>
                    {editId ? "EDITAR HORÁRIO" : "NOVO HORÁRIO"}
                  </div>
                  {err && <ErrMsg msg={err} />}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <SelectField label="Turma" value={form.idturma} onChange={v => f("idturma", v)}
                      options={turmas.map(t => ({ value: t.id, label: t.nome }))} placeholder="Escolher turma..." />
                    <SelectField label="Estúdio" value={form.estudioId} onChange={v => f("estudioId", v)}
                      options={estudios.map(e => ({ value: e.id, label: e.nome }))} placeholder="Escolher estúdio..." />
                    <SelectField label="Professor" value={form.idProfessor} onChange={v => f("idProfessor", v)}
                      options={professores.map(p => ({ value: p.id, label: p.nome }))} placeholder="Escolher professor..." />
                    <SelectField label="Dia da Semana" value={form.diaSemana?.toString() || ""} onChange={v => f("diaSemana", v)}
                      options={DIAS_OPTIONS.map(d => ({ value: d.value.toString(), label: d.label }))} placeholder="Escolher dia..." />
                    <InputField label="Hora Início" type="time" value={form.horaInicio} onChange={v => f("horaInicio", v)} />
                    <InputField label="Hora Fim" type="time" value={form.horaFim} onChange={v => f("horaFim", v)} />
                    <InputField label="Data Início" type="date" value={form.dataInicio} onChange={v => f("dataInicio", v)} />
                    <InputField label="Data Validade" type="date" value={form.dataValidade} onChange={v => f("dataValidade", v)} />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <BtnPrimario label={editId ? "Atualizar" : "Criar"} onClick={submit} />
                    <BtnSecundario label="Cancelar" onClick={() => setShowForm(false)} />
                  </div>
                </div>
              )}

              {/* Lista de horários */}
              {horarios.length === 0 && !showForm && <p style={{ color: "#aaa", fontSize: 14 }}>Sem horários criados.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {horarios.map(h => (
                  <div key={h.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#333" }}>
                        {DIAS_OPTIONS.find(d => d.label === h.diaSemana || d.value.toString() === h.diaSemana)?.label ?? h.diaSemana} · {h.horaInicio} – {h.horaFim}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {h.idturmaId && <span style={{ background: "#e3f2fd", color: "#0d47a1", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{h.idturmaId.nome}</span>}
                        {h.estudioId && <span style={{ background: "#e8f5e9", color: "#2e7d32", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>📍 {h.estudioId.nome}</span>}
                      </div>
                      <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                        {h.dataInicio} → {h.dataValidade} · {h.duracaoMinutos} min
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <BtnSecundario label="Editar" onClick={() => openEdit(h)} small />
                      <BtnPerigo label="Eliminar" onClick={() => del(h.id)} small />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "coaching" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#888", letterSpacing: 1, marginBottom: 16 }}>TODOS OS COACHINGS</div>
              {coachings.length === 0 && <p style={{ color: "#aaa", fontSize: 14 }}>Sem coachings.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {coachings.map(c => (
                  <div key={c.aulaDto.id} style={{ background: "#fff", border: "1px solid #e8e0d5", borderRadius: 8, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.aulaDto.dataAula} · {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                      {c.professorDto && <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Prof. {c.professorDto.utilizadores?.nome || "Não atribuído"}</div>}
                      <EstadoBadge estado={c.estadoAulaDto?.estado ?? "—"} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <BtnPrimario label="Validar" onClick={() => validarCoaching(c.aulaDto.id)} small />
                      <BtnPerigo label="Eliminar" onClick={() => eliminarCoaching(c.aulaDto.id)} small />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HorarioPage() {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => { setRole(getRole()); }, []);

  // Títulos e subtítulos por role
  const roleInfo: Record<Role, { titulo: string; subtitulo: string }> = {
    ALUNO:       { titulo: "Horários", subtitulo: "Aulas do João · Semana de 17 a 23 fev 2025" },
    ENCARREGADO: { titulo: "Horários", subtitulo: "As suas aulas · Semana de 17 a 23 fev 2025" },
    PROFESSOR:   { titulo: "Horários", subtitulo: "O meu horário · Semana de 17 a 23 fev 2025" },
    COORDENACAO: { titulo: "Horários", subtitulo: "Gestão de horários · Coordenação" },
  };
  const info = role ? roleInfo[role] : null;

  return (
    <>
      <style>{globalStyle}</style>

      <div style={{ minHeight: "100vh", background: "#f7f5f2" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e8e0d5", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          {/* Botão voltar */}
          <button style={{ background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "Lato, sans-serif" }}>
            ← VOLTAR
          </button>

          {/* Logo centro */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Playfair Display, serif", fontWeight: 700, fontSize: 20, color: "#333", letterSpacing: 0.5 }}>
              Ent'Artes
            </div>
            <div style={{ fontSize: 10, color: "#bbb", letterSpacing: 2 }}>ESCOLA DE ARTES</div>
          </div>

          {/* Utilizador */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={{ background: "none", border: "1px solid #ddd", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#666" }}>
              🔔
            </button>
            <div style={{ background: "#333", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {role === "COORDENACAO" ? "A" : "J"}
            </div>
            <span style={{ fontSize: 13, color: "#666" }}>{role === "COORDENACAO" ? "Admin" : "João"}</span>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", animation: "fadeIn 0.3s ease" }}>

          {!role ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
              <div style={{ fontFamily: "Playfair Display, serif", fontSize: 22, fontWeight: 700, color: "#333", marginBottom: 8 }}>Sem sessão iniciada</div>
              <div style={{ color: "#aaa", fontSize: 14 }}>Por favor, faça login para aceder ao portal de horários.</div>
            </div>
          ) : (
            <>
              {/* Título da secção */}
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: 32, fontWeight: 700, color: "#c9974a", marginBottom: 4 }}>
                  {info?.titulo}
                </h1>
                <div style={{ fontSize: 11, color: "#bbb", letterSpacing: 2, textTransform: "uppercase" }}>
                  {info?.subtitulo}
                </div>
              </div>

              {/* Vista por role */}
              {role === "ALUNO"       && <AlunoView />}
              {role === "PROFESSOR"   && <ProfessorView />}
              {role === "COORDENACAO" && <CoordenacaoView />}
              {role === "ENCARREGADO" && <EncarregadoView />}
            </>
          )}
        </div>
      </div>
    </>
  );
}