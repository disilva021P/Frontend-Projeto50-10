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
}

const TIPO_LABELS: Record<string, string> = {
  ROLE_ALUNO: "Aluno",
  ROLE_PROFESSOR: "Professor",
  ROLE_ENCARREGADO: "Encarregado",
  ROLE_COORDENACAO: "Coordenação",
};

function initials(name: string = ""): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatDate(dt: string | null): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return "—"; }
}

export default function PerfilPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<UtilizadorResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulário password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordAtual, setPasswordAtual] = useState("");
  const [novaPassword, setNovaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    fetch(`${BASE_URL}/api/utilizadores/meu-perfil`, { headers: authHeaders() })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: UtilizadorResponseDto) => setPerfil(data))
      .catch(() => setErrorMsg("Não foi possível carregar o perfil."))
      .finally(() => setLoading(false));
  }, [router]);

  async function alterarPassword(e: React.FormEvent) {
    e.preventDefault();
    if (novaPassword !== confirmarPassword) {
      setErrorMsg("As passwords não coincidem."); return;
    }
    setLoadingPassword(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores/minha-password`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ passwordAtual, novaPassword, confirmarNovaPassword: confirmarPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.erro ?? "Erro ao alterar a palavra-passe.");
      }
      setSuccessMsg("Palavra-passe alteredo com sucesso!");
      setShowPasswordForm(false);
      setPasswordAtual(""); setNovaPassword(""); setConfirmarPassword("");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Erro ao alterar a palavra-passe.");
    } finally {
      setLoadingPassword(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus { border-color: var(--panel-dark) !important; outline: none; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: "transparent", fontFamily: "var(--font-lato)" }}>

        {/* ── CONTEÚDO (Sem <nav> redundante nem <aside>) ── */}
        <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "12px 0 20px" }}>
          <div style={{ width: "100%", maxWidth: 520, animation: "fadeUp .3s ease" }}>

            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 4 }}>Conta</p>
              <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", fontWeight: 400 }}>O meu perfil</h1>
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid var(--border-warm)", borderTopColor: "var(--accent-gold)", animation: "spin 0.8s linear infinite" }} />
              </div>
            )}

            {/* Card perfil */}
            {perfil && (
              <>
                <div style={{ background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10, padding: 24, marginBottom: 14, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "var(--panel-dark)", borderRadius: "10px 0 0 10px" }} />

                  {/* Avatar + nome */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--border-warm)", paddingLeft: 8 }}>
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontWeight: 400, fontSize: 20, letterSpacing: 1, flexShrink: 0 }}>
                      {initials(perfil.nome)}
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--font-playfair)", fontSize: 20, color: "var(--panel-dark)", fontWeight: 400, marginBottom: 4 }}>{perfil.nome}</div>
                      <div style={{ fontSize: 12, color: "var(--accent-muted)", fontWeight: 300, marginBottom: 8 }}>{perfil.email}</div>
                      <span style={{ background: "rgba(44,28,10,0.07)", border: "1px solid rgba(44,28,10,0.15)", color: "var(--panel-dark)", borderRadius: 4, padding: "2px 10px", fontSize: 10, fontWeight: 400, letterSpacing: .5 }}>
                        {TIPO_LABELS[perfil.tipoUtilizador] ?? perfil.tipoUtilizador}
                      </span>
                    </div>
                  </div>

                  {/* Campos */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, paddingLeft: 8 }}>
                    {[
                      { label: "Telefone",     value: perfil.telefone || "—" },
                      { label: "NIF",          value: perfil.nif || "—" },
                      { label: "Nascimento",   value: formatDate(perfil.dataNascimento) },
                      { label: "Membro desde", value: formatDate(perfil.criadoEm) },
                      { label: "Estado",       value: perfil.ativo ? "Conta ativa" : "Conta inativa" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 5 }}>{label}</div>
                        <div style={{ fontSize: 14, color: "var(--panel-dark)", fontWeight: 400 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botão alterar password */}
                <button onClick={() => setShowPasswordForm(!showPasswordForm)}
                  style={{ width: "100%", padding: "11px", borderRadius: 8, background: showPasswordForm ? "#FFFCF8" : "rgba(44,28,10,0.05)", border: `1px solid ${showPasswordForm ? "var(--border-warm)" : "rgba(44,28,10,0.15)"}`, color: showPasswordForm ? "var(--accent-muted)" : "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 12, letterSpacing: .5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                  <i className={`ti ${showPasswordForm ? "ti-x" : "ti-lock"}`} style={{ fontSize: 14 }} />
                  {showPasswordForm ? "Cancelar" : "Alterar palavra-passe"}
                </button>

                {/* Formulário password */}
                {showPasswordForm && (
                  <form onSubmit={alterarPassword}
                    style={{ background: "#FFFCF8", border: "1px solid var(--border-warm)", borderRadius: 10, padding: 24, animation: "fadeUp .2s ease", position: "relative" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: "rgba(160,133,96,0.5)", borderRadius: "10px 0 0 10px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 8 }}>
                      <p style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, margin: 0 }}>Nova palavra-passe</p>
                      {[
                        { label: "Palavra-passe atual", val: passwordAtual, set: setPasswordAtual },
                        { label: "Nova palavra-passe",  val: novaPassword,  set: setNovaPassword, min: 6 },
                        { label: "Confirmar nova password", val: confirmarPassword, set: setConfirmarPassword },
                      ].map(({ label, val, set, min }) => (
                        <div key={label}>
                          <label style={{ display: "block", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 6 }}>{label}</label>
                          <input type="password" value={val} onChange={e => set(e.target.value)} required minLength={min}
                            style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13 }} />
                        </div>
                      ))}
                      <button type="submit" disabled={loadingPassword}
                        style={{ padding: "11px", borderRadius: 8, background: "var(--panel-dark)", border: "none", color: "var(--accent-gold)", fontFamily: "var(--font-lato)", fontSize: 12, fontWeight: 400, letterSpacing: 1, textTransform: "uppercase", cursor: loadingPassword ? "not-allowed" : "pointer", opacity: loadingPassword ? .7 : 1 }}>
                        {loadingPassword ? "A guardar…" : "Guardar palavra-passe"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Toasts */}
      {successMsg && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "rgba(45,106,63,0.10)", border: "1px solid rgba(45,106,63,0.25)", color: "#2D6A3F", borderRadius: 8, padding: "10px 16px", fontSize: 12, zIndex: 200, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-circle-check" /> {successMsg}
          <button onClick={() => setSuccessMsg(null)} style={{ background: "none", border: "none", color: "#2D6A3F", cursor: "pointer", marginLeft: 4 }}>✕</button>
        </div>
      )}
      {errorMsg && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.22)", color: "#c0392b", borderRadius: 8, padding: "10px 16px", fontSize: 12, zIndex: 200, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-alert-circle" /> {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", marginLeft: 4 }}>✕</button>
        </div>
      )}
    </>
  );
}