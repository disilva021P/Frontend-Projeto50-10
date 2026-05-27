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
  aulaDto: {
    id: string;
    dataAula: string;
    horaInicio: string;
    horaFim: string;
    duracaoMinutos: number;
  };
  modalidadeDto: {
    id: string;
    nome: string;
  };
  estadoAulaDto: {
    id: string;
    estado: string;
  };
  max_alunos: number;
  professorDto?: any; // Ajusta conforme o que vier no console
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

const DIAS = ["SEGUNDA","TERÇA","QUARTA","QUINTA","SEXTA","SÁBADO","DOMINGO"];
const DIAS_OPTIONS = [
  { value: 1, label: "SEGUNDA" },
  { value: 2, label: "TERCA" },
  { value: 3, label: "QUARTA" },
  { value: 4, label: "QUINTA" },
  { value: 5, label: "SEXTA" },
  { value: 6, label: "SABADO" },
  { value: 7, label: "DOMINGO" }
];
// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getToken()  { return localStorage.getItem("token") ?? ""; }
function getRole(): Role | null {
  const userData = localStorage.getItem("user"); // Supondo que a chave se chama "user"
  
  if (!userData) return null;

  try {
    const user = JSON.parse(userData);
    // Aqui "sacas" o ID de dentro do objeto user
    return (user.tipoUtilizadorId as Role) ?? null;
  } catch (error) {
    console.error("Erro ao ler o objeto user do localStorage", error);
    return null;
  }
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

// ─── Shared tiny components ───────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color, color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
      {label}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 12, padding: "20px 24px", marginBottom: 16, ...style
    }}>
      {children}
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#e8c97e",
        animation: "spin 0.8s linear infinite"
      }} />
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <div style={{ color: "#ff6b6b", padding: 12, background: "rgba(255,107,107,0.08)", borderRadius: 8, marginBottom: 12 }}>{msg}</div>;
}

function Select({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#a0a0b0", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, color: "#f0f0f0", padding: "9px 12px", fontSize: 14, outline: "none", cursor: "pointer"
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Input({ label, type = "text", value, onChange }: {
  label: string; type?: string; value: string | number; onChange: (v: string) => void; min?: string | number;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#a0a0b0", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, color: "#f0f0f0", padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box"
        }}
      />
    </div>
  );
}

function Btn({ label, onClick, variant = "primary", small }: {
  label: string; onClick: () => void; variant?: "primary" | "danger" | "ghost"; small?: boolean;
}) {
  const colors: Record<string, string> = {
    primary: "linear-gradient(135deg,#e8c97e,#c9974a)",
    danger: "linear-gradient(135deg,#ff6b6b,#c0392b)",
    ghost: "rgba(255,255,255,0.07)"
  };
  return (
    <button onClick={onClick} style={{
      background: colors[variant], border: "none", borderRadius: 8, color: variant === "ghost" ? "#ccc" : "#1a1208",
      fontWeight: 700, fontSize: small ? 12 : 13, padding: small ? "6px 14px" : "10px 20px",
      cursor: "pointer", letterSpacing: 0.5, transition: "opacity .15s"
    }}
      onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
      onMouseOut={e => (e.currentTarget.style.opacity = "1")}
    >{label}</button>
  );
}

// ─── ALUNO view ───────────────────────────────────────────────────────────────

function AlunoView() {
  const [semana, setSemana] = useState<AulaDto[]>([]);
  const [coaching, setCoaching] = useState<CoachingDto[]>([]);
  const [estudios, setEstudios] = useState<ResumoDto[]>([]); // Estado para armazenar os estúdios
  const [disponiveis, setDisponiveis] = useState<CoachingDto[]>([]);
  const [professores, setProfessores] = useState<ResumoDto[]>([]);
  const [modalidades, setModalidades] = useState<ResumoDto[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"horario"|"coaching"|"disponiveis"|"marcar">("horario");
  const [marcarForm, setMarcarForm] = useState({
    professorId: "",
    modalidadeId: "",
    estudioId: "",
    dataAula: "",
    horaInicio: "",
    horaFim: "",
    maxAlunos: 1,
    descricao: ""
  });  const [marcarErr, setMarcarErr] = useState("");
  const [marcarOk, setMarcarOk] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<AulaDto[]>(`${API}/semana?offset=${offset}`),
      api<{ content: CoachingDto[] }>(`${API}/coaching`),
      api<{ content: CoachingDto[] }>(`${API}/coachingsdisponiveis?offset=${offset}`),
      api<ResumoDto[]>(`${BASE}/api/professores/selecionar`).catch(() => []),
      api<ResumoDto[]>(`${BASE}/api/modalidades`).catch(() => []),
      api<ResumoDto[]>(`${BASE}/api/estudios`).catch(() => []), // <--- Chamada para os estúdios
    ]).then(([s, c, d, p, m, e]) => {
      setSemana(s ?? []);
      setCoaching(c?.content ?? []);
      setDisponiveis(d?.content ?? []);
      setProfessores(p ?? []);
      setModalidades(m ?? []);
      setEstudios(e ?? []); // <--- Guarda os estúdios
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
      setMarcarForm({ professorId: "", modalidadeId: "", dataAula: "", horaInicio: "", horaFim: "",estudioId:"",maxAlunos:8, descricao: "" });
      const upd = await api<{ content: CoachingDto[] }>(`${API}/coaching`);
      setCoaching(upd?.content ?? []);
    } catch(e: unknown) { setMarcarErr(String(e)); }
  };

  const tabs = ["horario","coaching","disponiveis","marcar"] as const;
  const tabLabels = { horario: "Horário Semanal", coaching: "Os Meus Coachings", disponiveis: "Disponíveis", marcar: "📅 Marcar Coaching" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? "linear-gradient(135deg,#e8c97e,#c9974a)" : "rgba(255,255,255,0.06)",
            border: "none", borderRadius: 8, color: tab === t ? "#1a1208" : "#ccc",
            fontWeight: 700, fontSize: 12, padding: "8px 16px", cursor: "pointer", letterSpacing: 0.5
          }}>{tabLabels[t]}</button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {tab === "horario" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                <Btn label="◀ Semana anterior" onClick={() => setOffset(o => o - 1)} variant="ghost" small />
                <span style={{ color: "#a0a0b0", fontSize: 13 }}>Offset: {offset}</span>
                <Btn label="Próxima semana ▶" onClick={() => setOffset(o => o + 1)} variant="ghost" small />
              </div>
              {semana.length === 0 && <p style={{ color: "#666" }}>Sem aulas nesta semana.</p>}
              {semana.map(a => (
                <Card key={a.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{a.diaSemana ?? a.dataAula}</div>
                      <div style={{ color: "#a0a0b0", fontSize: 13 }}>{a.horaInicio} – {a.horaFim}</div>
                      {a.turma && <div style={{ color: "#e8c97e", fontSize: 13, marginTop: 4 }}>{a.turma.nome}</div>}
                      {a.estudio && <div style={{ color: "#888", fontSize: 12 }}>📍 {a.estudio.nome}</div>}
                    </div>
                    {a.professor && <Badge label={a.professor.nome} color="#3d6b4f" />}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === "coaching" && (
            <div>
              {coaching.length === 0 && <p style={{ color: "#666" }}>Sem coachings marcados.</p>}
              {coaching.map(c => (
  // Nota: Se 'id' não estiver na raiz, usa c.aulaDto.id
  <Card key={c.aulaDto.id}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        {/* Os dados de horário estão dentro de aulaDto */}
        <div style={{ fontWeight: 700 }}>
          {c.aulaDto?.dataAula} {c.aulaDto?.horaInicio} – {c.aulaDto?.horaFim}
        </div>
        
        {/* O professor costuma estar dentro da aula ou num dto à parte, 
            verifica se existe p.ex: c.professorDto */}
        {c.professorDto && (
          <div style={{ color: "#a0a0b0", fontSize: 13 }}>
            Prof. {c.professorDto.utilizadores?.nome}
          </div>
        )}

        {/* Modalidade está em modalidadeDto */}
        {c.modalidadeDto && (
          <Badge label={c.modalidadeDto.nome} color="#2a5298" />
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
        {/* O estado está dentro de estadoAulaDto */}
        <Badge 
          label={c.estadoAulaDto?.estado ?? "–"} 
          color={c.estadoAulaDto?.estado === "CONFIRMADO" ? "#27ae60" : "#e67e22"} 
        />
        
        {/* O ID para cancelar também deve vir de aulaDto */}
        <Btn label="Cancelar" onClick={() => cancelar(c.aulaDto?.id)} variant="danger" small />
      </div>
    </div>
  </Card>
))}

            </div>
          )}

          {tab === "disponiveis" && (
            <div>
            {disponiveis.length === 0 && (
              <p style={{ color: "#666" }}>Sem coachings disponíveis.</p>
            )}
            
            {disponiveis.map((c: CoachingDto) => (
              <Card key={c.aulaDto.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {/* Dados vindos do aulaDto */}
                    <div style={{ fontWeight: 700 }}>
                      {c.aulaDto.dataAula} {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}
                    </div>
                    
                    {/* Dados do Professor (ajustado para a estrutura comum de utilizador) */}
                    {c.professorDto && (
                      <div style={{ color: "#a0a0b0", fontSize: 13 }}>
                        Prof. {c.professorDto.utilizadores?.nome || "Não atribuído"}
                      </div>
                    )}
                    
                    {/* Dados da Modalidade */}
                    {c.modalidadeDto && (
                      <Badge label={c.modalidadeDto.nome} color="#2a5298" />
                    )}
                    
                    {/* Info extra de ocupação, se quiseres usar o max_alunos */}
                    <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                      Vagas: {c.max_alunos}
                    </div>
                  </div>
          
                  {/* O ID para inscrição também vem de aulaDto */}
                  <Btn label="Inscrever" onClick={() => inscrever(c.aulaDto.id)} />
                </div>
              </Card>
            ))}
          </div>

            )}{tab === "marcar" && (
              <Card style={{ borderColor: "rgba(232,201,126,0.25)", maxWidth: 520 }}>
              <div style={{ fontWeight: 700, color: "#e8c97e", marginBottom: 18, fontSize: 16 }}>
                Marcar Sessão de Coaching
              </div>
            
              {/* Mensagens de Feedback */}
              {marcarErr && <Err msg={marcarErr} />}
              {marcarOk && (
                <div style={{ color: "#27ae60", background: "rgba(39,174,96,0.1)", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>
                  {marcarOk}
                </div>
              )}
            
              {/* Seleção de Professor */}
              <Select 
  label="Professor" 
  value={marcarForm.professorId}
  onChange={v => setMarcarForm(f => ({ ...f, professorId: v }))}
  options={Array.isArray(professores) 
    ? professores.map(p => ({ 
        value: String(p.id), // Garante que o ID é tratado como string
        label: p.nome 
      })) 
    : []} 
  placeholder="Escolher professor..." 
/>
            
              {/* Seleção de Modalidade */}
              <Select 
                label="Modalidade" 
                value={marcarForm.modalidadeId}
                onChange={v => setMarcarForm(f => ({ ...f, modalidadeId: v }))}
                options={Array.isArray(modalidades) ? modalidades.map(m => ({ value: m.id, label: m.nome })) : []} 
                placeholder="Escolher modalidade..." 
              />
            
              {/* Seleção de Estúdio (Novo Campo) */}
              <Select 
                label="Estúdio / Sala" 
                value={marcarForm.estudioId}
                onChange={v => setMarcarForm(f => ({ ...f, estudioId: v }))}
                options={estudios.map(e => ({ 
                  value: e.id,    // O ID que o Select vai guardar
                  label: e.nome   // O texto que o utilizador vai ver
                }))}
                placeholder="Escolher sala..." 
              />
            
              {/* Data da Aula */}
              <Input 
                label="Data" 
                type="date" 
                value={marcarForm.dataAula}
                onChange={v => setMarcarForm(f => ({ ...f, dataAula: v }))} 
              />
            
              {/* Grid de Horários e Participantes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input 
                  label="Hora Início" 
                  type="time" 
                  value={marcarForm.horaInicio}
                  onChange={v => setMarcarForm(f => ({ ...f, horaInicio: v }))} 
                />
                <Input 
                  label="Hora Fim" 
                  type="time" 
                  value={marcarForm.horaFim}
                  onChange={v => setMarcarForm(f => ({ ...f, horaFim: v }))} 
                />
                <Input 
                  label="Máx. Participantes" 
                  type="number" 
                  min={8} // Usa chavetas e remove a vírgula
                  value={marcarForm.maxAlunos}
                  onChange={v => setMarcarForm(f => ({ ...f, maxAlunos: v === "" ? 0 : Number(v) }))} 
                />
              </div>
            
              {/* Descrição / Notas */}
              <div style={{ marginBottom: 14, marginTop: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#a0a0b0", marginBottom: 5, textTransform: "uppercase" }}>
                  Descrição / Notas
                </label>
                <textarea 
                  value={marcarForm.descricao}
                  onChange={e => setMarcarForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3} 
                  style={{
                    width: "100%", 
                    background: "rgba(255,255,255,0.06)", 
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 8, 
                    color: "#f0f0f0", 
                    padding: "9px 12px", 
                    fontSize: 14, 
                    outline: "none",
                    resize: "vertical", 
                    boxSizing: "border-box", 
                    fontFamily: "inherit"
                  }} 
                />
              </div>
            
              <Btn label="Enviar Pedido de Coaching" onClick={marcarCoaching} />
            </Card>
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
  const [tab, setTab] = useState<"horario"|"coaching"|"disponibilidade">("horario");
  const [loading, setLoading] = useState(true);

  // form disponibilidade
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
      setHorario(h ?? []);
      setPendentes(p?.content ?? []);
      setDisps(d ?? []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  const confirmar = async (id: string) => {
    await api(`${API}/professor/coaching/${id}/confirmar`, { method: "PUT" });
    load();
  };
  const rejeitar = async (id: string) => {
    await api(`${API}/professor/coaching/rejeitar/${id}`, { method: "PUT" });
    load();
  };
  const addDisp = async () => {
    try {
      setDispErr("");
      await api(`/disponibilidade/professor`, { method: "POST", body: JSON.stringify(dispForm) });
      setDispForm({ diaSemana: 1, horaInicio: "", horaFim: "", validoDe: "", validoAte: "" });
      load();
    } catch(e: unknown) { setDispErr(String(e)); }
  };
  const removeDisp = async (id: string) => {
    await api(`/disponibilidade/professor/${id}`, { method: "DELETE" });
    load();
  };

  const tabs = ["horario","coaching","disponibilidade"] as const;
  const tabLabels = { horario: "Horário Semanal", coaching: "Coachings Pendentes", disponibilidade: "Disponibilidade" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? "linear-gradient(135deg,#e8c97e,#c9974a)" : "rgba(255,255,255,0.06)",
            border: "none", borderRadius: 8, color: tab === t ? "#1a1208" : "#ccc",
            fontWeight: 700, fontSize: 12, padding: "8px 16px", cursor: "pointer", letterSpacing: 0.5
          }}>{tabLabels[t]}</button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {tab === "horario" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                <Btn label="◀" onClick={() => setOffset(o => o - 1)} variant="ghost" small />
                <span style={{ color: "#a0a0b0", fontSize: 13 }}>Semana {offset >= 0 ? `+${offset}` : offset}</span>
                <Btn label="▶" onClick={() => setOffset(o => o + 1)} variant="ghost" small />
              </div>
              {horario.length === 0 && <p style={{ color: "#666" }}>Sem aulas nesta semana.</p>}
              {horario.map(a => (
                <Card key={a.id}>
                  <div style={{ fontWeight: 700 }}>{a.diaSemana ?? a.dataAula} · {a.horaInicio} – {a.horaFim}</div>
                  {a.turma && <div style={{ color: "#e8c97e", fontSize: 13 }}>{a.turma.nome}</div>}
                  {a.estudio && <div style={{ color: "#888", fontSize: 12 }}>📍 {a.estudio.nome}</div>}
                </Card>
              ))}
            </div>
          )}

          {tab === "coaching" && (
            <div>
            {pendentes.length === 0 && (
              <p style={{ color: "#666" }}>Sem coachings pendentes.</p>
            )}
            
            {pendentes.map((c: CoachingDto) => (
              <Card key={c.aulaDto.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {/* Horário vindo do aulaDto */}
                    <div style={{ fontWeight: 700 }}>
                      {c.aulaDto.dataAula} {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}
                    </div>
                    
                    {/* Modalidade vinda do modalidadeDto */}
                    {c.modalidadeDto && (
                      <Badge label={c.modalidadeDto.nome} color="#2a5298" />
                    )}
          
                    {/* Estado atual (ex: "Pedido") */}
                    {c.estadoAulaDto && (
                      <div style={{ color: "#e67e22", fontSize: 12, marginTop: 4 }}>
                        Status: {c.estadoAulaDto.estado}
                      </div>
                    )}
                  </div>
          
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Passamos o ID correto (aulaDto.id) para as funções de ação */}
                    <Btn 
                      label="✓ Confirmar" 
                      onClick={() => confirmar(c.aulaDto.id)} 
                      small 
                    />
                    <Btn 
                      label="✕ Rejeitar" 
                      onClick={() => rejeitar(c.aulaDto.id)} 
                      variant="danger" 
                      small 
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          )}

          {tab === "disponibilidade" && (
            <div>
              <Card style={{ borderColor: "rgba(232,201,126,0.2)" }}>
                <div style={{ fontWeight: 700, marginBottom: 16, color: "#e8c97e" }}>Nova Disponibilidade</div>
                {dispErr && <Err msg={dispErr} />}
                <Select 
                        label="Dia da Semana" 
                        // Convertemos para string apenas para visualização no Select
                        value={dispForm.diaSemana?.toString()} 
                        
                        // No onChange, convertemos a string "4" de volta para o número 4
                        onChange={v => setDispForm(f => ({ ...f, diaSemana: parseInt(v) }))}
                        
                        // Usamos o DIAS_OPTIONS que já tem os números (1 a 7)
                        options={DIAS_OPTIONS.map(d => ({ 
                          value: d.value.toString(), // O Select exige que o value da option seja string
                          label: d.label 
                        }))} 
                        
                        placeholder="Escolher dia..." 
                      />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="Hora Início" type="time" value={dispForm.horaInicio} onChange={v => setDispForm(f => ({ ...f, horaInicio: v }))} />
                  <Input label="Hora Fim" type="time" value={dispForm.horaFim} onChange={v => setDispForm(f => ({ ...f, horaFim: v }))} />
                  <Input label="Válido De" type="date" value={dispForm.validoDe} onChange={v => setDispForm(f => ({ ...f, validoDe: v }))} />
                  <Input label="Válido Até" type="date" value={dispForm.validoAte} onChange={v => setDispForm(f => ({ ...f, validoAte: v }))} />
                </div>
                <Btn label="Adicionar Disponibilidade" onClick={addDisp} />
              </Card>
              <div style={{ marginTop: 8 }}>
                {disps.length === 0 && <p style={{ color: "#666" }}>Sem disponibilidades registadas.</p>}
                {disps.map(d => (
                  <Card key={d.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{d.diaSemana} · {d.horaInicio} – {d.horaFim}</div>
                        {d.validoDe && <div style={{ color: "#888", fontSize: 12 }}>{d.validoDe} → {d.validoAte}</div>}
                      </div>
                      <Btn label="Remover" onClick={() => removeDisp(d.id)} variant="danger" small />
                    </div>
                  </Card>
                ))}
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
  // --- ESTADOS DA PRIMEIRA PARTE ---
  const [educandos, setEducandos] = useState<ResumoDto[]>([]);
  const [educandoSel, setEducandoSel] = useState<ResumoDto | null>(null);
  const [semana, setSemana] = useState<AulaDto[]>([]);
  const [coaching, setCoaching] = useState<CoachingDto[]>([]);
  const [disponiveis, setDisponiveis] = useState<CoachingDto[]>([]);
  const [professores, setProfessores] = useState<ResumoDto[]>([]);
  const [modalidades, setModalidades] = useState<ResumoDto[]>([]);
  const [estudios, setEstudios] = useState<ResumoDto[]>([]); // Novo estado para estúdios
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<"horario"|"coaching"|"disponiveis"|"marcar">("horario");
  const [loading, setLoading] = useState(false);
  
  // MarcarForm atualizado com os novos campos
  const [marcarForm, setMarcarForm] = useState({ 
    professorId: "", 
    modalidadeId: "", 
    estudioId: "",
    dataAula: "", 
    horaInicio: "", 
    horaFim: "", 
    maxAlunos: 8,
    descricao: "" 
  });
  const [marcarErr, setMarcarErr] = useState("");
  const [marcarOk, setMarcarOk] = useState("");

  // --- ESTADOS DA SEGUNDA PARTE ---
  const [educandoIdManual, setEducandoIdManual] = useState("");
  const [semanaManual, setSemanaManual] = useState<AulaDto[]>([]);
  const [coachingManual, setCoachingManual] = useState<CoachingDto[]>([]);
  const [offsetManual, setOffsetManual] = useState(0);
  const [loadedManual, setLoadedManual] = useState(false);
  const [errManual, setErrManual] = useState("");

  // Carregar dados iniciais
  useEffect(() => {
    Promise.all([
      api<ResumoDto[]>(`${BASE}/api/utilizadores/meus-educandos`).catch(() => [] as ResumoDto[]),
      api<ResumoDto[]>(`${BASE}/api/professores/selecionar`).catch(() => [] as ResumoDto[]),
      api<ResumoDto[]>(`${BASE}/api/modalidades`).catch(() => [] as ResumoDto[]),
      api<ResumoDto[]>(`${BASE}/api/estudios`).catch(() => [] as ResumoDto[]), // Carrega estúdios
    ]).then(([e, p, m, est]) => {
      setEducandos(e ?? []);
      setProfessores(p ?? []);
      setModalidades(m ?? []);
      setEstudios(est ?? []);
    });
  }, []);

  // Recarregar dados do educando selecionado
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
    setEducandoSel(e);
    setOffset(0);
    setTab("horario");
    setMarcarErr(""); setMarcarOk("");
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
    } catch(e: unknown) { setMarcarErr(String(e)); }
  };

  const loadManual = async () => {
    if (!educandoIdManual.trim()) return;
    setErrManual("");
    try {
      const [s, c] = await Promise.all([
        api<AulaDto[]>(`${API}/semana/educando/${educandoIdManual}?offset=${offsetManual}`),
        api<{ content: CoachingDto[] }>(`${API}/coaching/educando/${educandoIdManual}`)
      ]);
      setSemanaManual(s ?? []);
      setCoachingManual(c?.content ?? []);
      setLoadedManual(true);
    } catch(e: unknown) { setErrManual(String(e)); }
  };

  const tabs = ["horario","coaching","disponiveis","marcar"] as const;
  const tabLabels = { horario: "Horário Semanal", coaching: "Coachings", disponiveis: "Disponíveis", marcar: "📅 Marcar Coaching" };

  return (
    <div>
      {/* SELETOR DE EDUCANDO */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#a0a0b0", marginBottom: 10, textTransform: "uppercase" }}>
          Selecionar Educando
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {educandos.map(e => (
            <button key={e.id} onClick={() => selecionar(e)} style={{
              background: educandoSel?.id === e.id ? "linear-gradient(135deg,#e8c97e,#c9974a)" : "rgba(255,255,255,0.06)",
              border: educandoSel?.id === e.id ? "none" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, color: educandoSel?.id === e.id ? "#1a1208" : "#ddd",
              fontWeight: 700, fontSize: 13, padding: "10px 20px", cursor: "pointer"
            }}>
              👤 {e.nome}
            </button>
          ))}
        </div>
      </div>

      {educandoSel && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: tab === t ? "linear-gradient(135deg,#e8c97e,#c9974a)" : "rgba(255,255,255,0.06)",
                border: "none", borderRadius: 8, color: tab === t ? "#1a1208" : "#ccc",
                fontWeight: 700, fontSize: 12, padding: "8px 16px", cursor: "pointer"
              }}>{tabLabels[t]}</button>
            ))}
          </div>

          {loading ? <Loader /> : (
            <>
              {tab === "horario" && (
                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                    <Btn label="◀" onClick={() => setOffset(o => o - 1)} variant="ghost" small />
                    <span style={{ color: "#a0a0b0", fontSize: 13 }}>Semana {offset >= 0 ? `+${offset}` : offset}</span>
                    <Btn label="▶" onClick={() => setOffset(o => o + 1)} variant="ghost" small />
                  </div>
                  {semana.map(a => (
                    <Card key={a.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{a.diaSemana ?? a.dataAula}</div>
                          <div style={{ color: "#a0a0b0", fontSize: 13 }}>{a.horaInicio} – {a.horaFim}</div>
                          {a.turma && <div style={{ color: "#e8c97e", fontSize: 13, marginTop: 4 }}>{a.turma.nome}</div>}
                          {a.estudio && <div style={{ color: "#888", fontSize: 12 }}>📍 {a.estudio.nome}</div>}
                        </div>
                        {a.professor && <Badge label={a.professor.nome} color="#3d6b4f" />}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {tab === "coaching" && (
                <div>
                  {coaching.map(c => (
                    <Card key={c.aulaDto.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.aulaDto.dataAula} {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                          {c.professorDto && <div style={{ color: "#a0a0b0", fontSize: 13 }}>Prof. {c.professorDto.utilizadores?.nome}</div>}
                          {c.modalidadeDto && <Badge label={c.modalidadeDto.nome} color="#2a5298" />}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
                          <Badge label={c.estadoAulaDto?.estado ?? "–"} color={c.estadoAulaDto?.estado === "CONFIRMADO" ? "#27ae60" : "#e67e22"} />
                          <Btn label="Cancelar" onClick={() => cancelar(c.aulaDto.id)} variant="danger" small />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {tab === "disponiveis" && (
                <div>
                  {disponiveis.length === 0 && <p style={{ color: "#666" }}>Sem coachings disponíveis.</p>}
                  {disponiveis.map((c: CoachingDto) => (
                    <Card key={c.aulaDto.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.aulaDto.dataAula} {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}</div>
                          {c.professorDto && <div style={{ color: "#a0a0b0", fontSize: 13 }}>Prof. {c.professorDto.utilizadores?.nome || "Não atribuído"}</div>}
                          {c.modalidadeDto && <Badge label={c.modalidadeDto.nome} color="#2a5298" />}
                          <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Vagas: {c.max_alunos}</div>
                        </div>
                        <Btn label="Inscrever" onClick={() => inscrever(c.aulaDto.id)} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {tab === "marcar" && (
                <Card style={{ borderColor: "rgba(232,201,126,0.25)", maxWidth: 520 }}>
                  <div style={{ fontWeight: 700, color: "#e8c97e", marginBottom: 18, fontSize: 16 }}>Marcar Sessão de Coaching</div>
                  {marcarErr && <Err msg={marcarErr} />}
                  {marcarOk && <div style={{ color: "#27ae60", background: "rgba(39,174,96,0.1)", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13 }}>{marcarOk}</div>}
                  
                  <Select label="Professor" value={marcarForm.professorId}
                    onChange={v => setMarcarForm(f => ({ ...f, professorId: v }))}
                    options={professores.map(p => ({ value: String(p.id), label: p.nome }))} placeholder="Escolher professor..." />
                  
                  <Select label="Modalidade" value={marcarForm.modalidadeId}
                    onChange={v => setMarcarForm(f => ({ ...f, modalidadeId: v }))}
                    options={modalidades.map(m => ({ value: m.id, label: m.nome }))} placeholder="Escolher modalidade..." />
                  
                  <Select label="Estúdio / Sala" value={marcarForm.estudioId}
                    onChange={v => setMarcarForm(f => ({ ...f, estudioId: v }))}
                    options={estudios.map(e => ({ value: e.id, label: e.nome }))} placeholder="Escolher sala..." />
                  
                  <Input label="Data" type="date" value={marcarForm.dataAula} onChange={v => setMarcarForm(f => ({ ...f, dataAula: v }))} />
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <Input label="Hora Início" type="time" value={marcarForm.horaInicio} onChange={v => setMarcarForm(f => ({ ...f, horaInicio: v }))} />
                    <Input label="Hora Fim" type="time" value={marcarForm.horaFim} onChange={v => setMarcarForm(f => ({ ...f, horaFim: v }))} />
                    <Input label="Máx. Alunos" type="number" min={1} value={marcarForm.maxAlunos} 
                      onChange={v => setMarcarForm(f => ({ ...f, maxAlunos: v === "" ? 0 : Number(v) }))} />
                  </div>

                  <div style={{ marginBottom: 14, marginTop: 14 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#a0a0b0", marginBottom: 5, textTransform: "uppercase" }}>Descrição / Notas</label>
                    <textarea value={marcarForm.descricao} onChange={e => setMarcarForm(f => ({ ...f, descricao: e.target.value }))} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#f0f0f0", padding: "9px 12px", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                  <Btn label="Enviar Pedido de Coaching" onClick={marcarCoaching} />
                </Card>
              )}
            </>
          )}
        </>
      )}

      <hr style={{ margin: "40px 0", opacity: 0.1 }} />

      
    </div>
  );
}


// ─── COORDENACAO view ─────────────────────────────────────────────────────────

function CoordenacaoView() {
  const [horarios, setHorarios] = useState<HorarioFixoDto[]>([]);
  const [turmas, setTurmas] = useState<TurmaDto[]>([]);
  const [estudios, setEstudios] = useState<EstudioDto[]>([]);
  const [professores, setProfessores] = useState<ResumoDto[]>([]);
  const [coachings, setCoachings] = useState<CoachingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"horarios"|"coaching">("horarios");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [userId] = useState(() => localStorage.getItem("userId") ?? "");

  const emptyForm = {
    idturma: "", estudioId: "", idProfessor: "",
    dataInicio: "", dataValidade: "", diaSemana: "",
    horaInicio: "", horaFim: "", duracaoMinutos: 0
  };
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
      setHorarios(h?.content ?? []);
      setTurmas(t ?? []);
      setEstudios(e ?? []);
      setProfessores(p ?? []);
      setCoachings(c?.content ?? []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setErr(""); setShowForm(true); };

  const openEdit = (h: HorarioFixoDto) => {
    setForm({
      idturma: h.idturmaId?.id ?? "",
      estudioId: h.estudioId?.id ?? "",
      idProfessor: "",
      dataInicio: h.dataInicio ?? "",
      dataValidade: h.dataValidade ?? "",
      diaSemana: h.diaSemana ?? "",
      horaInicio: h.horaInicio ?? "",
      horaFim: h.horaFim ?? "",
      duracaoMinutos: h.duracaoMinutos
    });
    setEditId(h.id);
    setErr("");
    setShowForm(true);
  };

  const submit = async () => {
    
    setErr("");
    try {
      const body = {
        id: editId ?? null,
        idcriadoPor: userId,
        idturma: form.idturma,
        estudioId: form.estudioId,
        dataInicio: form.dataInicio,
        dataValidade: form.dataValidade,
        diaSemana: form.diaSemana ? parseInt(form.diaSemana.toString()) : null,
        horaInicio: form.horaInicio,
        horaFim: form.horaFim,
        duracaoMinutos: form.duracaoMinutos
      };
      if (editId) {
        await api(`${API}/${editId}?idProfessor=${form.idProfessor}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api(`${API}/criar?idProfessor=${form.idProfessor}`, { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      load();
    } catch(e: unknown) { setErr(String(e)); }
  };

  const del = async (id: string) => {
    if (!confirm("Eliminar este horário e todas as aulas geradas?")) return;
    await api(`${API}/${id}`, { method: "DELETE" });
    load();
  };

  const validarCoaching = async (id: string) => {
    await api(`${API}/coaching/${id}/validar`, { method: "PUT" });
    load();
  };
  const eliminarCoaching = async (id: string) => {
    await api(`${API}/coaching/${id}`, { method: "DELETE" });
    load();
  };

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["horarios","coaching"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? "linear-gradient(135deg,#e8c97e,#c9974a)" : "rgba(255,255,255,0.06)",
            border: "none", borderRadius: 8, color: tab === t ? "#1a1208" : "#ccc",
            fontWeight: 700, fontSize: 12, padding: "8px 16px", cursor: "pointer"
          }}>{t === "horarios" ? "Horários Fixos" : "Coachings"}</button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {tab === "horarios" && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Btn label="+ Criar Horário" onClick={openCreate} />
              </div>

              {showForm && (
                <Card style={{ borderColor: "rgba(232,201,126,0.3)", marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, color: "#e8c97e", marginBottom: 16 }}>
                    {editId ? "Editar Horário" : "Novo Horário"}
                  </div>
                  {err && <Err msg={err} />}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Select label="Turma" value={form.idturma} onChange={v => f("idturma", v)}
                      options={turmas.map(t => ({ value: t.id, label: t.nome }))} placeholder="Escolher turma..." />
                    <Select label="Estúdio" value={form.estudioId} onChange={v => f("estudioId", v)}
                      options={estudios.map(e => ({ value: e.id, label: e.nome }))} placeholder="Escolher estúdio..." />
                    <Select label="Professor" value={form.idProfessor} onChange={v => f("idProfessor", v)}
                      options={professores.map(p => ({ value: p.id, label: p.nome }))} placeholder="Escolher professor..." />
                    <Select 
  label="Dia da Semana" 
  // Convertemos para string para o Select não reclamar, 
  // mas usamos um fallback ("") caso o valor ainda não exista
  value={form.diaSemana?.toString() || ""} 
  
  // No onChange, convertemos de volta para número antes de guardar no estado
  onChange={v => f("diaSemana", parseInt(v) as any)}  
  // Mapeamos o teu array para garantir que os valores são strings
  options={DIAS_OPTIONS.map(d => ({ 
    value: d.value.toString(), 
    label: d.label 
  }))} 
  
  placeholder="Escolher dia..." 
/>
                    <Input label="Hora Início" type="time" value={form.horaInicio} onChange={v => f("horaInicio", v)} />
                    <Input label="Hora Fim" type="time" value={form.horaFim} onChange={v => f("horaFim", v)} />
                    <Input label="Data Início" type="date" value={form.dataInicio} onChange={v => f("dataInicio", v)} />
                    <Input label="Data Validade" type="date" value={form.dataValidade} onChange={v => f("dataValidade", v)} />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <Btn label={editId ? "Atualizar" : "Criar"} onClick={submit} />
                    <Btn label="Cancelar" onClick={() => setShowForm(false)} variant="ghost" />
                  </div>
                </Card>
              )}

              {horarios.length === 0 && !showForm && <p style={{ color: "#666" }}>Sem horários criados.</p>}
              {horarios.map(h => (
                <Card key={h.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {h.diaSemana} · {h.horaInicio} – {h.horaFim}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        {h.idturmaId && <Badge label={h.idturmaId.nome} color="#2a5298" />}
                        {h.estudioId && <Badge label={`📍 ${h.estudioId.nome}`} color="#3d5a3e" />}
                      </div>
                      <div style={{ color: "#777", fontSize: 12, marginTop: 6 }}>
                        {h.dataInicio} → {h.dataValidade} · {h.duracaoMinutos} min
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn label="Editar" onClick={() => openEdit(h)} variant="ghost" small />
                      <Btn label="Eliminar" onClick={() => del(h.id)} variant="danger" small />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === "coaching" && (
            <div>
              {coachings.length === 0 && <p style={{ color: "#666" }}>Sem coachings.</p>}
              {coachings.map(c => (
                <Card key={c.aulaDto.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    {/* Horários dentro de aulaDto */}
                    <div style={{ fontWeight: 700 }}>
                      {c.aulaDto.dataAula} {c.aulaDto.horaInicio} – {c.aulaDto.horaFim}
                    </div>
              
                    {/* Professor dentro de professorDto */}
                    {c.professorDto && (
                      <div style={{ color: "#a0a0b0", fontSize: 13 }}>
                        Prof. {c.professorDto.utilizadores?.nome || "Não atribuído"}
                      </div>
                    )}
              
                    {/* Estado vindo de estadoAulaDto */}
                    <Badge 
                      label={c.estadoAulaDto?.estado ?? "–"} 
                      color={c.estadoAulaDto?.estado === "CONFIRMADO" ? "#27ae60" : "#e67e22"} 
                    />
                  </div>
              
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Usar o ID da aula para as ações de validar e eliminar */}
                    <Btn label="Validar" onClick={() => validarCoaching(c.aulaDto.id)} small />
                    <Btn label="Eliminar" onClick={() => eliminarCoaching(c.aulaDto.id)} variant="danger" small />
                  </div>
                </div>
              </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────

const ROLE_META: Record<Role, { label: string; color: string; icon: string }> = {
  ALUNO:       { label: "Aluno",       color: "#2a5298", icon: "🎓" },
  PROFESSOR:   { label: "Professor",   color: "#3d6b4f", icon: "👨‍🏫" },
  COORDENACAO: { label: "Coordenação", color: "#6b3d4f", icon: "🗂️" },
  ENCARREGADO: { label: "Encarregado", color: "#5a4f2a", icon: "👪" },
};

export default function HorarioPage() {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const r = getRole();
    setRole(r);
  }, []);

  const meta = role ? ROLE_META[role] : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0e0d0b; color: #f0f0f0; font-family: 'DM Sans', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        select option { background: #1e1c18; }
        input[type="time"]::-webkit-calendar-picker-indicator,
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(232,201,126,0.07) 0%, transparent 70%), #0e0d0b" }}>

        {/* Header */}
        <div style={{
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "18px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10,
          background: "rgba(14,13,11,0.85)"
        }}>
          <div>
            <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20, letterSpacing: -0.5, color: "#e8c97e" }}>
              Entidade das Artes
            </div>
            <div style={{ fontSize: 11, color: "#666", letterSpacing: 2, textTransform: "uppercase" }}>Portal de Horários</div>
          </div>
          {meta && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.05)", borderRadius: 10,
              padding: "8px 16px", border: "1px solid rgba(255,255,255,0.08)"
            }}>
              <span style={{ fontSize: 18 }}>{meta.icon}</span>
              <div>
                <div style={{ fontSize: 12, color: "#888", letterSpacing: 1 }}>SESSÃO COMO</div>
                <div style={{ fontWeight: 700, color: "#e8c97e", fontSize: 14 }}>{meta.label}</div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px", animation: "fadeUp .4s ease" }}>
          {!role ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <div style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 800, color: "#e8c97e", marginBottom: 8 }}>
                Sem sessão iniciada
              </div>
              <div style={{ color: "#666", fontSize: 14 }}>
                Por favor, faça login para aceder ao portal de horários.
              </div>
            </div>
          ) : (
            <>
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