'use client'
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "COORDENACAO" | "ALUNO" | "PROFESSOR" | "ENCARREGADO";

interface CurrentUser {
  id: string;
  nome: string;
  role: Role;
}

interface PagamentoDto {
  id: string;
  valorPagamento: number;
  pago: boolean;
  descricao: string;
  idTipoPagamento: string;
  tipoPagamentoNome: string;
  aula?: { id: string; nome?: string };
  dataPagamento: string;
  dataConfirmado?: string;
  utilizadoreResumoDto?: { id: string; nome?: string };
}

interface AlunoEstatisticaDto {
  totalPago?: number;
  totalPorPagar?: number;
  diferenca?: number;
  [key: string]: unknown;
}

interface PagamentosEstatisiticaCoordenacao {
  getTotalPago: number;
  getTotalPorPagar: number;
  diferenca: number;
}

interface DespesasEstatisticaDto {
  totalDespesaEfetiva: number;
  totalDespesaPendente: number;
}

interface ProfessorEstatisticaDto {
  totalEsperado: number;
  jaRecebido: number;
  porLiquidar: number;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ── API ───────────────────────────────────────────────────────────────────────

async function apiFetch(method: Method, url: string, body?: unknown) {
  const res = await api.request({ method, url, data: body });
  return { status: res.status, data: res.data };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useApiCall<T = unknown>() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (method: Method, url: string, body?: unknown) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await apiFetch(method, url, body);
      setData(r.data as T);
      return r.data as T;
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "Erro desconhecido";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, data, error, call };
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

const css = {
  root: {
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    background: "#0f1117",
    minHeight: "100vh",
    color: "#e8eaf0",
  } as React.CSSProperties,
  container: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "32px 20px",
  } as React.CSSProperties,
  card: {
    background: "#191c26",
    border: "1px solid #2a2d3a",
    borderRadius: 14,
    padding: "20px 22px",
    marginBottom: 16,
  } as React.CSSProperties,
  statCard: {
    background: "#191c26",
    border: "1px solid #2a2d3a",
    borderRadius: 12,
    padding: "18px 20px",
    flex: 1,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #2a2d3a",
    background: "#0f1117",
    color: "#e8eaf0",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  } as React.CSSProperties,
  select: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #2a2d3a",
    background: "#0f1117",
    color: "#e8eaf0",
    fontSize: 13,
    outline: "none",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.07em",
    color: "#6b7280",
    textTransform: "uppercase" as const,
    marginBottom: 5,
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  } as React.CSSProperties,
  row3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
  } as React.CSSProperties,
  divider: {
    border: "none",
    borderTop: "1px solid #2a2d3a",
    margin: "20px 0",
  } as React.CSSProperties,
};

function Pill({ text, color }: { text: string; color: string }) {
  const palettes: Record<string, { bg: string; fg: string; border: string }> = {
    green: { bg: "#0d2818", fg: "#34d399", border: "#1a4a2e" },
    red: { bg: "#280d0d", fg: "#f87171", border: "#4a1a1a" },
    blue: { bg: "#0d1828", fg: "#60a5fa", border: "#1a2e4a" },
    amber: { bg: "#281d0d", fg: "#fbbf24", border: "#4a381a" },
    purple: { bg: "#1a0d28", fg: "#c084fc", border: "#38184a" },
    gray: { bg: "#1a1c24", fg: "#9ca3af", border: "#2a2d3a" },
  };
  const p = palettes[color] ?? palettes.gray;
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 99,
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
      }}
    >
      {text}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "blue", POST: "green", PUT: "amber", PATCH: "purple", DELETE: "red",
  };
  return <Pill text={method} color={colors[method] ?? "gray"} />;
}

function Btn({
  label,
  variant = "default",
  onClick,
  disabled,
  full,
}: {
  label: string;
  variant?: "default" | "primary" | "danger" | "success";
  onClick: () => void;
  disabled?: boolean;
  full?: boolean;
}) {
  const variants = {
    default: { bg: "#23263a", text: "#d1d5db", border: "#2a2d3a", hover: "#2e3250" },
    primary: { bg: "#1e3a5f", text: "#93c5fd", border: "#2a4a7a", hover: "#234570" },
    danger: { bg: "#3a1e1e", text: "#fca5a5", border: "#5a2828", hover: "#4a2020" },
    success: { bg: "#1e3a2a", text: "#86efac", border: "#2a5a3a", hover: "#234530" },
  };
  const v = variants[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 18px",
        borderRadius: 8,
        border: `1px solid ${v.border}`,
        background: v.bg,
        color: v.text,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.15s",
        width: full ? "100%" : undefined,
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={css.label}>{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#e8eaf0" }}>{title}</span>
      </div>
      {subtitle && <p style={{ fontSize: 13, color: "#6b7280", marginLeft: 30 }}>{subtitle}</p>}
    </div>
  );
}

function ResponseBox({ data, error, loading }: { data: unknown; error: string | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0", color: "#6b7280", fontSize: 13 }}>
        A carregar…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, background: "#280d0d", border: "1px solid #4a1a1a", color: "#f87171", fontSize: 12 }}>
        ⚠ {error}
      </div>
    );
  }
  if (data === null || data === undefined) return null;
  return (
    <pre style={{
      marginTop: 12,
      padding: "12px 14px",
      borderRadius: 8,
      background: "#0c0e14",
      border: "1px solid #2a2d3a",
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      color: "#a5b4fc",
      whiteSpace: "pre-wrap",
      wordBreak: "break-all",
      maxHeight: 260,
      overflowY: "auto",
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StatCard({ label, value, color = "blue", note }: { label: string; value: string | number; color?: string; note?: string }) {
  const colors: Record<string, string> = {
    blue: "#60a5fa", green: "#34d399", red: "#f87171", amber: "#fbbf24", purple: "#c084fc",
  };
  const c = colors[color] ?? colors.blue;
  return (
    <div style={{ ...css.statCard, borderTop: `2px solid ${c}` }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: c, marginBottom: 2 }}>{value}</p>
      {note && <p style={{ fontSize: 11, color: "#6b7280" }}>{note}</p>}
    </div>
  );
}

// ── Pagamento Table ───────────────────────────────────────────────────────────

function PagamentoRow({ p }: { p: PagamentoDto }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 120px 100px 90px",
      alignItems: "center",
      gap: 12,
      padding: "12px 16px",
      borderBottom: "1px solid #1e2130",
      fontSize: 13,
    }}>
      <div>
        <p style={{ color: "#e8eaf0", fontWeight: 500, marginBottom: 2 }}>{p.descricao || "—"}</p>
        <p style={{ color: "#6b7280", fontSize: 11 }}>{p.tipoPagamentoNome}</p>
      </div>
      <p style={{ color: "#a5b4fc", fontFamily: "monospace", fontSize: 12 }}>
        {new Date(p.dataPagamento).toLocaleDateString("pt-PT")}
      </p>
      <p style={{ fontWeight: 700, color: "#e8eaf0" }}>
        {p.valorPagamento.toFixed(2)} €
      </p>
      <div>
        <Pill text={p.pago ? "Pago" : "Pendente"} color={p.pago ? "green" : "amber"} />
      </div>
    </div>
  );
}

function PagamentosTable({ pagamentos }: { pagamentos: PagamentoDto[] }) {
  if (!pagamentos.length) {
    return <p style={{ textAlign: "center", color: "#6b7280", padding: "24px 0", fontSize: 13 }}>Sem pagamentos.</p>;
  }
  return (
    <div style={{ border: "1px solid #2a2d3a", borderRadius: 10, overflow: "hidden" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 100px 90px",
        gap: 12,
        padding: "8px 16px",
        background: "#13151f",
        borderBottom: "1px solid #2a2d3a",
      }}>
        {["Descrição", "Data", "Valor", "Estado"].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
        ))}
      </div>
      {pagamentos.map((p) => <PagamentoRow key={p.id} p={p} />)}
    </div>
  );
}

// ── ALUNO VIEW ────────────────────────────────────────────────────────────────

function offsetLabel(offset: number): string {
  if (offset === 0) return "Mês atual";
  if (offset === -1) return "Mês passado";
  if (offset < 0) return `Há ${Math.abs(offset)} meses`;
  if (offset === 1) return "Mês seguinte";
  return `Daqui a ${offset} meses`;
}

function OffsetNav({ offset, setOffset, loading }: { offset: number; setOffset: (o: number) => void; loading: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Btn
        label="◂ Mais antigo"
        onClick={() => setOffset(offset - 1)}
        disabled={loading}
      />
      <Btn
        label="Mais recente ▸"
        onClick={() => setOffset(offset + 1)}
        disabled={loading || offset >= 0}
      />
      {offset !== 0 && (
        <Btn label="Hoje" onClick={() => setOffset(0)} disabled={loading} />
      )}
    </div>
  );
}

function AlunoView({ userId }: { userId: string }) {
  const listApi = useApiCall<PagamentoDto[]>();
  const statsApi = useApiCall<AlunoEstatisticaDto>();
  const [offset, setOffset] = useState(0);

  const fetch = useCallback((o: number) => {
    listApi.call("GET", `/pagamentos/meus?offset=${o}`);
    statsApi.call("GET", `/pagamentos/meus/estatisticas?offset=${o}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetch(offset); }, [offset, fetch]);

  const stats = statsApi.data;
  const pagamentos = listApi.data ?? [];

  return (
    <div>
      <SectionTitle icon="💳" title="Os Meus Pagamentos" subtitle="Consulte o estado das suas mensalidades" />

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Total Pago" value={`${(stats.totalPago ?? 0).toFixed(2)} €`} color="green" />
          <StatCard label="Por Pagar" value={`${(stats.totalPorPagar ?? 0).toFixed(2)} €`} color="amber" />
          <StatCard label="Diferença" value={`${(stats.diferenca ?? 0).toFixed(2)} €`} color="blue" />
        </div>
      )}

      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, color: "#e8eaf0" }}>Histórico</span>
            <span style={{ fontSize: 11, color: "#a5b4fc", fontFamily: "monospace", background: "#1e2240", padding: "2px 8px", borderRadius: 6 }}>
              {offsetLabel(offset)}
            </span>
          </div>
          <OffsetNav offset={offset} setOffset={setOffset} loading={listApi.loading} />
        </div>
        {listApi.loading
          ? <p style={{ color: "#6b7280", fontSize: 13 }}>A carregar…</p>
          : <PagamentosTable pagamentos={pagamentos} />}
      </div>
    </div>
  );
}

// ── PROFESSOR VIEW ────────────────────────────────────────────────────────────

function ProfessorView({ userId }: { userId: string }) {
  const statsApi = useApiCall<ProfessorEstatisticaDto>();
  const listApi = useApiCall<PagamentoDto[]>();
  const [offset, setOffset] = useState(0);

  const fetch = useCallback((o: number) => {
    statsApi.call("GET", `/pagamentos/meus/professor/estatisticas?offset=${o}`);
    listApi.call("GET", `/pagamentos/meus/professor?offset=${o}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetch(offset); }, [offset, fetch]);

  const stats = statsApi.data;
  const pagamentos = listApi.data ?? [];

  return (
    <div>
      <SectionTitle icon="🎓" title="Os Meus Recebimentos" subtitle="Acompanhe os seus honorários" />

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Total Esperado" value={`${stats.totalEsperado.toFixed(2)} €`} color="blue" />
          <StatCard label="Já Recebido" value={`${stats.jaRecebido.toFixed(2)} €`} color="green" />
          <StatCard label="Por Liquidar" value={`${stats.porLiquidar.toFixed(2)} €`} color="amber" />
        </div>
      )}

      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, color: "#e8eaf0" }}>Histórico de Pagamentos</span>
            <span style={{ fontSize: 11, color: "#a5b4fc", fontFamily: "monospace", background: "#1e2240", padding: "2px 8px", borderRadius: 6 }}>
              {offsetLabel(offset)}
            </span>
          </div>
          <OffsetNav offset={offset} setOffset={setOffset} loading={listApi.loading} />
        </div>
        {listApi.loading
          ? <p style={{ color: "#6b7280", fontSize: 13 }}>A carregar…</p>
          : <PagamentosTable pagamentos={pagamentos} />}
      </div>
    </div>
  );
}

// ── ENCARREGADO VIEW ──────────────────────────────────────────────────────────

interface Educando {
  id: string;
  nome?: string;
}

function EncarregadoView({ userId }: { userId: string }) {
  const educandosApi = useApiCall<Educando[]>();
  const listApi = useApiCall<PagamentoDto[]>();
  const statsApi = useApiCall<AlunoEstatisticaDto>();
  const [selectedId, setSelectedId] = useState<string>("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    educandosApi.call("GET", `/utilizadores/${userId}/educandos`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const educandos = educandosApi.data;
    if (educandos && educandos.length > 0 && !selectedId) {
      setSelectedId(educandos[0].id);
    }
  }, [educandosApi.data, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    listApi.call("GET", `/pagamentos/educando/${selectedId}?offset=${offset}`);
    statsApi.call("GET", `/pagamentos/educando/${selectedId}/estatisticas?offset=${offset}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, offset]);

  const educandos = educandosApi.data ?? [];
  const stats = statsApi.data;
  const pagamentos = listApi.data ?? [];

  return (
    <div>
      <SectionTitle icon="👨‍👧" title="Pagamentos do Educando" subtitle="Consulte os pagamentos dos seus educandos" />

      {educandos.length > 0 && (
        <div style={css.card}>
          <Field label="Selecionar educando">
            <select
              style={css.select}
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setOffset(0); }}
            >
              {educandos.map((e) => (
                <option key={e.id} value={e.id}>{e.nome ?? e.id}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Total Pago" value={`${(stats.totalPago ?? 0).toFixed(2)} €`} color="green" />
          <StatCard label="Por Pagar" value={`${(stats.totalPorPagar ?? 0).toFixed(2)} €`} color="amber" />
          <StatCard label="Diferença" value={`${(stats.diferenca ?? 0).toFixed(2)} €`} color="blue" />
        </div>
      )}

      {selectedId && (
        <div style={css.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, color: "#e8eaf0" }}>Histórico</span>
              <span style={{ fontSize: 11, color: "#a5b4fc", fontFamily: "monospace", background: "#1e2240", padding: "2px 8px", borderRadius: 6 }}>
                {offsetLabel(offset)}
              </span>
            </div>
            <OffsetNav offset={offset} setOffset={setOffset} loading={listApi.loading} />
          </div>
          {listApi.loading
            ? <p style={{ color: "#6b7280", fontSize: 13 }}>A carregar…</p>
            : <PagamentosTable pagamentos={pagamentos} />}
        </div>
      )}
    </div>
  );
}

// ── COORDENACAO VIEW ──────────────────────────────────────────────────────────

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type CoordTab = "dashboard" | "pagamentos" | "utilizador" | "professor" | "gerir" | "relatorio";

const COORD_TABS: { id: CoordTab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "pagamentos", label: "Pagamentos", icon: "💳" },
  { id: "utilizador", label: "Por Utilizador", icon: "👤" },
  { id: "professor", label: "Professor", icon: "🎓" },
  { id: "gerir", label: "Gerir", icon: "⚙️" },
  { id: "relatorio", label: "Relatório", icon: "📄" },
];

function CoordDashboard() {
  const coordApi = useApiCall<PagamentosEstatisiticaCoordenacao>();
  const despesasApi = useApiCall<DespesasEstatisticaDto>();

  useEffect(() => {
    coordApi.call("GET", "/pagamentos/estatisticas/coordenacao");
    despesasApi.call("GET", "/pagamentos/estatisticas/despesas");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coord = coordApi.data;
  const despesas = despesasApi.data;

  return (
    <div>
      <SectionTitle icon="📊" title="Dashboard" subtitle="Visão geral financeira da escola" />

      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Receitas — Coordenação
      </p>
      {coord ? (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Total Pago" value={`${coord.getTotalPago.toFixed(2)} €`} color="green" />
          <StatCard label="Por Pagar" value={`${coord.getTotalPorPagar.toFixed(2)} €`} color="amber" />
          <StatCard label="Diferença" value={`${coord.diferenca.toFixed(2)} €`} color={coord.diferenca >= 0 ? "blue" : "red"} />
        </div>
      ) : <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>{coordApi.loading ? "A carregar…" : "Sem dados."}</p>}

      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        Despesas
      </p>
      {despesas ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Despesa Efetiva" value={`${despesas.totalDespesaEfetiva.toFixed(2)} €`} color="red" />
          <StatCard label="Despesa Pendente" value={`${despesas.totalDespesaPendente.toFixed(2)} €`} color="amber" />
        </div>
      ) : <p style={{ color: "#6b7280", fontSize: 13 }}>{despesasApi.loading ? "A carregar…" : "Sem dados."}</p>}
    </div>
  );
}

function CoordPagamentos() {
  const listApi = useApiCall<PagamentoDto[]>();
  const singleApi = useApiCall<PagamentoDto>();
  const [buscarId, setBuscarId] = useState("");

  useEffect(() => { listApi.call("GET", "/pagamentos"); }, []);  // eslint-disable-line

  return (
    <div>
      <SectionTitle icon="💳" title="Todos os Pagamentos" />

      {/* Buscar */}
      <div style={css.card}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="Buscar por ID">
              <input style={css.input} value={buscarId} onChange={(e) => setBuscarId(e.target.value)} placeholder="ex: abc-123" />
            </Field>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Btn label="Buscar" variant="primary" onClick={() => singleApi.call("GET", `/pagamentos/${buscarId}`)} disabled={!buscarId} />
          </div>
        </div>
        <ResponseBox data={singleApi.data} error={singleApi.error} loading={singleApi.loading} />
      </div>

      {/* Table */}
      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontWeight: 600, color: "#e8eaf0" }}>Lista completa</span>
          <Btn label="↺ Atualizar" onClick={() => listApi.call("GET", "/pagamentos")} />
        </div>
        {listApi.loading
          ? <p style={{ color: "#6b7280", fontSize: 13 }}>A carregar…</p>
          : <PagamentosTable pagamentos={listApi.data ?? []} />}
      </div>
    </div>
  );
}

function CoordUtilizador() {
  const listApi = useApiCall<PagamentoDto[]>();
  const statsApi = useApiCall<AlunoEstatisticaDto>();
  const [uid, setUid] = useState("");
  const [offset, setOffset] = useState("0");

  const go = () => {
    listApi.call("GET", `/pagamentos/utilizador/${uid}?offset=${offset}`);
    statsApi.call("GET", `/pagamentos/utilizador/${uid}/estatisticas?offset=${offset}`);
  };

  return (
    <div>
      <SectionTitle icon="👤" title="Pagamentos por Utilizador" />

      <div style={css.card}>
        <div style={css.row2}>
          <Field label="ID Utilizador">
            <input style={css.input} value={uid} onChange={(e) => setUid(e.target.value)} placeholder="ex: abc-123" />
          </Field>
          <Field label="Offset">
            <input style={css.input} type="number" value={offset} onChange={(e) => setOffset(e.target.value)} />
          </Field>
        </div>
        <Btn label="Consultar" variant="primary" onClick={go} disabled={!uid} />
      </div>

      {statsApi.data && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Total Pago" value={`${((statsApi.data.totalPago as number) ?? 0).toFixed(2)} €`} color="green" />
          <StatCard label="Por Pagar" value={`${((statsApi.data.totalPorPagar as number) ?? 0).toFixed(2)} €`} color="amber" />
          <StatCard label="Diferença" value={`${((statsApi.data.diferenca as number) ?? 0).toFixed(2)} €`} color="blue" />
        </div>
      )}

      {listApi.data && (
        <div style={css.card}>
          <PagamentosTable pagamentos={listApi.data} />
        </div>
      )}

      {(listApi.loading || statsApi.loading) && <p style={{ color: "#6b7280", fontSize: 13 }}>A carregar…</p>}
      {(listApi.error || statsApi.error) && <ResponseBox data={null} error={listApi.error ?? statsApi.error} loading={false} />}
    </div>
  );
}

function CoordProfessor() {
  const statsApi = useApiCall<ProfessorEstatisticaDto>();
  const [pid, setPid] = useState("");
  const [offset, setOffset] = useState("0");

  return (
    <div>
      <SectionTitle icon="🎓" title="Estatísticas de Professor" />

      <div style={css.card}>
        <div style={css.row2}>
          <Field label="ID Professor">
            <input style={css.input} value={pid} onChange={(e) => setPid(e.target.value)} placeholder="ex: abc-123" />
          </Field>
          <Field label="Offset">
            <input style={css.input} type="number" value={offset} onChange={(e) => setOffset(e.target.value)} />
          </Field>
        </div>
        <Btn label="Consultar" variant="primary" onClick={() => statsApi.call("GET", `/pagamentos/professor/${pid}/estatisticas?offset=${offset}`)} disabled={!pid} />
      </div>

      {statsApi.data && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Total Esperado" value={`${statsApi.data.totalEsperado.toFixed(2)} €`} color="blue" />
          <StatCard label="Já Recebido" value={`${statsApi.data.jaRecebido.toFixed(2)} €`} color="green" />
          <StatCard label="Por Liquidar" value={`${statsApi.data.porLiquidar.toFixed(2)} €`} color="amber" />
        </div>
      )}

      <ResponseBox data={statsApi.loading || statsApi.data ? null : statsApi.error ? null : null} error={statsApi.error} loading={statsApi.loading} />
    </div>
  );
}

function CoordGerir() {
  const createApi = useApiCall<PagamentoDto>();
  const updateApi = useApiCall<PagamentoDto>();
  const confirmApi = useApiCall<PagamentoDto>();
  const deleteApi = useApiCall<void>();

  // Create fields
  const [cValor, setCValor] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cTipo, setCTipo] = useState("");
  const [cUid, setCUid] = useState("");

  // Update fields
  const [uId, setUId] = useState("");
  const [uValor, setUValor] = useState("");
  const [uDesc, setUDesc] = useState("");
  const [uTipo, setUTipo] = useState("");
  const [uUid, setUUid] = useState("");

  // Confirm/Delete
  const [confirmId, setConfirmId] = useState("");
  const [deleteId, setDeleteId] = useState("");

  return (
    <div>
      <SectionTitle icon="⚙️" title="Gerir Pagamentos" />

      {/* Criar */}
      <div style={css.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <MethodBadge method="POST" />
          <span style={{ fontWeight: 600, color: "#e8eaf0", fontSize: 14 }}>Criar Pagamento</span>
        </div>
        <div style={css.row2}>
          <Field label="Valor (€)">
            <input style={css.input} type="number" step="0.01" value={cValor} onChange={(e) => setCValor(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="ID Tipo Pagamento">
            <input style={css.input} value={cTipo} onChange={(e) => setCTipo(e.target.value)} placeholder="ex: tipo-abc" />
          </Field>
        </div>
        <Field label="Descrição">
          <input style={css.input} value={cDesc} onChange={(e) => setCDesc(e.target.value)} placeholder="Descrição do pagamento" />
        </Field>
        <Field label="ID Utilizador">
          <input style={css.input} value={cUid} onChange={(e) => setCUid(e.target.value)} placeholder="ex: user-abc" />
        </Field>
        <Btn
          label="Criar"
          variant="success"
          onClick={() => createApi.call("POST", "/pagamentos", {
            valorPagamento: parseFloat(cValor) || 0,
            descricao: cDesc,
            idTipoPagamento: cTipo,
            utilizadoreResumoDto: { id: cUid },
          })}
          disabled={createApi.loading || !cValor || !cTipo || !cUid}
        />
        <ResponseBox data={createApi.data} error={createApi.error} loading={createApi.loading} />
      </div>

      <hr style={css.divider} />

      {/* Atualizar */}
      <div style={css.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <MethodBadge method="PUT" />
          <span style={{ fontWeight: 600, color: "#e8eaf0", fontSize: 14 }}>Atualizar Pagamento</span>
        </div>
        <Field label="ID do Pagamento">
          <input style={css.input} value={uId} onChange={(e) => setUId(e.target.value)} placeholder="ex: abc-123" />
        </Field>
        <div style={css.row2}>
          <Field label="Valor (€)">
            <input style={css.input} type="number" step="0.01" value={uValor} onChange={(e) => setUValor(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="ID Tipo Pagamento">
            <input style={css.input} value={uTipo} onChange={(e) => setUTipo(e.target.value)} placeholder="ex: tipo-abc" />
          </Field>
        </div>
        <Field label="Descrição">
          <input style={css.input} value={uDesc} onChange={(e) => setUDesc(e.target.value)} placeholder="Descrição" />
        </Field>
        <Field label="ID Utilizador">
          <input style={css.input} value={uUid} onChange={(e) => setUUid(e.target.value)} placeholder="ex: user-abc" />
        </Field>
        <Btn
          label="Atualizar"
          variant="primary"
          onClick={() => updateApi.call("PUT", `/pagamentos/${uId}`, {
            valorPagamento: parseFloat(uValor) || 0,
            descricao: uDesc,
            idTipoPagamento: uTipo,
            utilizadoreResumoDto: { id: uUid },
          })}
          disabled={updateApi.loading || !uId || !uValor || !uTipo || !uUid}
        />
        <ResponseBox data={updateApi.data} error={updateApi.error} loading={updateApi.loading} />
      </div>

      <hr style={css.divider} />

      {/* Confirmar & Eliminar lado a lado */}
      <div style={css.row2}>
        <div style={css.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <MethodBadge method="PATCH" />
            <span style={{ fontWeight: 600, color: "#e8eaf0", fontSize: 14 }}>Confirmar</span>
          </div>
          <Field label="ID do Pagamento">
            <input style={css.input} value={confirmId} onChange={(e) => setConfirmId(e.target.value)} placeholder="ex: abc-123" />
          </Field>
          <Btn label="Confirmar" variant="success" onClick={() => confirmApi.call("PATCH", `/pagamentos/${confirmId}/confirmar`)} disabled={confirmApi.loading || !confirmId} />
          <ResponseBox data={confirmApi.data} error={confirmApi.error} loading={confirmApi.loading} />
        </div>

        <div style={css.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <MethodBadge method="DELETE" />
            <span style={{ fontWeight: 600, color: "#e8eaf0", fontSize: 14 }}>Eliminar</span>
          </div>
          <Field label="ID do Pagamento">
            <input style={css.input} value={deleteId} onChange={(e) => setDeleteId(e.target.value)} placeholder="ex: abc-123" />
          </Field>
          <Btn label="Eliminar" variant="danger" onClick={() => deleteApi.call("DELETE", `/pagamentos/${deleteId}`)} disabled={deleteApi.loading || !deleteId} />
          <ResponseBox data={deleteApi.data} error={deleteApi.error} loading={deleteApi.loading} />
        </div>
      </div>
    </div>
  );
}

function CoordRelatorio() {
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const download = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.get(`/pagamentos/relatorio?mes=${mes}&ano=${ano}`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=UTF-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `relatorio_${ano}_${mes.padStart(2, "0")}.csv`;
      a.click();
      setStatus({ ok: true, msg: `Ficheiro relatorio_${ano}_${mes.padStart(2, "0")}.csv descarregado.` });
    } catch (e: unknown) {
      setStatus({ ok: false, msg: "Erro: " + (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SectionTitle icon="📄" title="Relatório Mensal" subtitle="Exportar pagamentos em CSV" />

      <div style={css.card}>
        <div style={css.row2}>
          <Field label="Mês">
            <select style={css.select} value={mes} onChange={(e) => setMes(e.target.value)}>
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={String(i + 1)}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Ano">
            <input style={css.input} type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
          </Field>
        </div>
        <Btn label={loading ? "A exportar…" : "⬇ Descarregar CSV"} variant="primary" onClick={download} disabled={loading} full />
        {status && (
          <p style={{ marginTop: 12, fontSize: 13, color: status.ok ? "#34d399" : "#f87171" }}>
            {status.ok ? "✓ " : "⚠ "}{status.msg}
          </p>
        )}
      </div>
    </div>
  );
}

function CoordenacaoView() {
  const [activeTab, setActiveTab] = useState<CoordTab>("dashboard");

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        marginBottom: 24,
        background: "#13151f",
        borderRadius: 10,
        padding: 6,
      }}>
        {COORD_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 7,
              border: "none",
              background: activeTab === t.id ? "#23263a" : "transparent",
              color: activeTab === t.id ? "#e8eaf0" : "#6b7280",
              fontWeight: activeTab === t.id ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && <CoordDashboard />}
      {activeTab === "pagamentos" && <CoordPagamentos />}
      {activeTab === "utilizador" && <CoordUtilizador />}
      {activeTab === "professor" && <CoordProfessor />}
      {activeTab === "gerir" && <CoordGerir />}
      {activeTab === "relatorio" && <CoordRelatorio />}
    </div>
  );
}

// ── Role Badge ────────────────────────────────────────────────────────────────

function roleMeta(role: Role): { label: string; color: string; icon: string } {
  return {
    COORDENACAO: { label: "Coordenação", color: "purple", icon: "🏛️" },
    ALUNO:       { label: "Aluno",        color: "blue",   icon: "🎒" },
    PROFESSOR:   { label: "Professor",    color: "green",  icon: "🎓" },
    ENCARREGADO: { label: "Encarregado",  color: "amber",  icon: "👨‍👧" },
  }[role];
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function PagamentosPanel() {
  const [user, setUser] = useState<{ id: string; nome: string; role: string } | null>(null);

  useEffect(() => {
    // 1. Ir buscar a string do localStorage
    const userStorage = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (userStorage && token) {
      try {
        const userData = JSON.parse(userStorage);
        
        // 2. Mapear para o estado (o id pode vir do token ou do user se o gravares lá)
        setUser({
          id: userData.id || "", // Garante que o teu login também grava o ID no objeto 'user'
          nome: userData.nome,
          role: userData.tipoUtilizadorId, // Ex: 'COORDENACAO', 'ALUNO'
        });
      } catch (error) {
        console.error("Erro ao ler dados do utilizador", error);
      }
    }
  }, []);

  // Enquanto não temos o user, não renderizamos nada ou mostramos loading
  if (!user) return <div className="p-8 text-white">A carregar sessão...</div>;

  return (
    <div className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black italic text-blue-500 uppercase">Pagamentos</h1>
          <p className="text-gray-400">Olá, <span className="text-white font-bold">{user.nome}</span></p>
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-black uppercase mt-2 inline-block">
            {user.role}
          </span>
        </div>

        {/* Lógica de Views baseada no Role */}
        {user.role === 'ALUNO' && <AlunoView userId={user.id} />}
        {user.role === 'COORDENACAO' && <CoordenacaoView />}
        {user.role === 'PROFESSOR' && <ProfessorView userId={user.id} />}
        
      </div>
    </div>
  );
}