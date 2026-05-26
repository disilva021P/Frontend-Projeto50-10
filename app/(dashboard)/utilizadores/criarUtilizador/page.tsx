"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = "http://localhost:8080";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "";
}
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface TipoUtilizador {
  id: string;
  tipoUtilizador: string;
}

const TIPO_LABELS: Record<string, string> = {
  ROLE_ALUNO: "Aluno",
  ROLE_PROFESSOR: "Professor",
  ROLE_ENCARREGADO: "Encarregado",
};

const TIPOS_PERMITIDOS = ["ROLE_ALUNO", "ROLE_PROFESSOR", "ROLE_ENCARREGADO"];

export default function CriarUtilizadorPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tipos, setTipos] = useState<TipoUtilizador[]>([]);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    id_tipoUtilizador: "",
    dataNascimento: "",
    nif: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUserName(u.nome ?? "");
        if (u.tipoUtilizadorId !== "COORDENACAO") { router.push("/landingPage"); }
      } catch { /* ignora */ }
    }

    // Carregar tipos de utilizador para pegar os IDs hash corretos
    fetch(`${BASE_URL}/api/tiposutilizador`, { headers: authHeaders() })
      .then(res => res.ok ? res.json() : [])
      .then((data: TipoUtilizador[]) => {
        const filtrados = data.filter(t => TIPOS_PERMITIDOS.includes(t.tipoUtilizador));
        setTipos(filtrados);
        if (filtrados.length > 0) setForm(f => ({ ...f, id_tipoUtilizador: filtrados[0].id }));
      })
      .catch(() => {
        // Fallback se o endpoint não existir — usa os tipos diretamente
        setForm(f => ({ ...f, id_tipoUtilizador: "ROLE_ALUNO" }));
      });
  }, [router]);

  function updateForm(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.erro ?? "Erro ao criar utilizador.");
      }
      router.push("/utilizadores");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Erro ao criar utilizador.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: var(--panel-dark) !important; outline: none; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--background)", fontFamily: "var(--font-lato)" }}>

        {/* ── NAVBAR mínima ── */}
        <nav style={{ height: 52, borderBottom: "1px solid var(--border-warm)", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/utilizadores")}
              style={{ width: 32, height: 32, border: "1px solid var(--border-warm)", borderRadius: 4, background: "#FFFCF8", color: "var(--panel-dark)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Voltar">
              <i className="ti ti-arrow-left" style={{ fontSize: 15 }} />
            </button>
            <div>
              <span style={{ fontFamily: "var(--font-playfair)", fontSize: 16, letterSpacing: 4, color: "var(--panel-dark)", fontWeight: 400 }}>entartes</span>
              <span style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginLeft: 4 }}>· novo utilizador</span>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300 }}>
            {userName ? `${userName.split(" ")[0]}` : ""}
          </span>
        </nav>

        {/* ── CONTEÚDO ── */}
        <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 20px 60px", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: 540, animation: "fadeUp .3s ease" }}>

            {/* Cabeçalho */}
            <div style={{ marginBottom: 28 }}>
              <button onClick={() => router.push("/utilizadores")}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--accent-muted)", cursor: "pointer", fontSize: 12, fontWeight: 300, letterSpacing: .5, marginBottom: 16, padding: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--panel-dark)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--accent-muted)")}>
                <i className="ti ti-arrow-left" style={{ fontSize: 13 }} /> Voltar à lista
              </button>
              <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Coordenação</p>
              <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", fontWeight: 400, marginBottom: 4 }}>Novo utilizador</h1>
              <p style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300 }}>Preenche os dados para criar a conta. A palavra-passe temporária será enviada por email.</p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit}
              style={{ background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10, padding: 28, position: "relative" }}>

              <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "10px 0 0 10px" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingLeft: 8 }}>

                {/* Tipo */}
                <div>
                  <label style={{ display: "block", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 6 }}>
                    Tipo de utilizador
                  </label>
                  {tipos.length > 0 ? (
                    <select value={form.id_tipoUtilizador} onChange={e => updateForm("id_tipoUtilizador", e.target.value)}
                      style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, cursor: "pointer" }}>
                      {tipos.map(t => <option key={t.id} value={t.id}>{TIPO_LABELS[t.tipoUtilizador] ?? t.tipoUtilizador}</option>)}
                    </select>
                  ) : (
                    <select value={form.id_tipoUtilizador} onChange={e => updateForm("id_tipoUtilizador", e.target.value)}
                      style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13, cursor: "pointer" }}>
                      {TIPOS_PERMITIDOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                    </select>
                  )}
                </div>

                {/* Nome + Email */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { label: "Nome completo", key: "nome", type: "text", placeholder: "Ex: João Silva", required: true },
                    { label: "Email", key: "email", type: "email", placeholder: "joao@entartes.pt", required: true },
                  ].map(({ label, key, type, placeholder, required }) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 6 }}>{label}</label>
                      <input type={type} placeholder={placeholder} required={required}
                        value={(form as any)[key]} onChange={e => updateForm(key as keyof typeof form, e.target.value)}
                        style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13 }} />
                    </div>
                  ))}
                </div>

                {/* Telefone + NIF */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {[
                    { label: "Telefone", key: "telefone", type: "tel", placeholder: "9XXXXXXXX" },
                    { label: "NIF", key: "nif", type: "text", placeholder: "XXXXXXXXX" },
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 6 }}>{label}</label>
                      <input type={type} placeholder={placeholder}
                        value={(form as any)[key]} onChange={e => updateForm(key as keyof typeof form, e.target.value)}
                        style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13 }} />
                    </div>
                  ))}
                </div>

                {/* Data de nascimento */}
                <div>
                  <label style={{ display: "block", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 6 }}>
                    Data de nascimento
                  </label>
                  <input type="date" required value={form.dataNascimento} onChange={e => updateForm("dataNascimento", e.target.value)}
                    style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13 }} />
                </div>

                {/* Info sobre password */}
                <div style={{ background: "rgba(160,133,96,0.06)", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <i className="ti ti-mail" style={{ fontSize: 15, color: "var(--accent-muted)", marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300, lineHeight: 1.6, margin: 0 }}>
                    Uma palavra-passe temporária será gerada automaticamente e enviada para o email indicado.
                  </p>
                </div>

                {/* Erro */}
                {errorMsg && (
                  <div style={{ background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.20)", borderRadius: 6, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="ti ti-alert-circle" style={{ color: "#c0392b", fontSize: 15, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: "#c0392b", margin: 0, fontWeight: 300 }}>{errorMsg}</p>
                  </div>
                )}

                {/* Botões */}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => router.push("/utilizadores")}
                    style={{ flex: 1, padding: "11px", borderRadius: 8, background: "#FFFCF8", border: "1px solid var(--border-warm)", color: "var(--accent-muted)", fontFamily: "var(--font-lato)", fontSize: 12, cursor: "pointer", letterSpacing: .5 }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading}
                    style={{ flex: 2, padding: "11px", borderRadius: 8, background: "var(--panel-dark)", border: "none", color: "var(--accent-gold)", fontFamily: "var(--font-lato)", fontSize: 12, fontWeight: 400, letterSpacing: 1, textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .7 : 1 }}>
                    {loading ? "A criar…" : "Criar utilizador"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>

        <footer style={{ padding: "12px 24px", borderTop: "1px solid var(--border-warm)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontSize: 12, letterSpacing: 3, color: "var(--accent-muted)", fontWeight: 400 }}>entartes</span>
          <span style={{ fontSize: 10, color: "var(--accent-muted)", fontWeight: 300 }}>© 2026 Entartes — Escola de Dança</span>
        </footer>
      </div>
    </>
  );
}