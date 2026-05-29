"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";

const BASE_URL = "http://localhost:8080";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface UtilizadorResumoDto {
  id: string;
  nome: string;
  email?: string;
  tipoUtilizador?: string;
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
  encarregadoNome?: string;
  encarregado?: UtilizadorResumoDto;
  educandos?: UtilizadorResumoDto[];
}

const TIPO_LABELS: Record<string, string> = {
  ALUNO: "Aluno",
  PROFESSOR: "Professor",
  ENCARREGADO: "Encarregado",
  COORDENACAO: "Coordenação",
  ROLE_ALUNO: "Aluno",
  ROLE_PROFESSOR: "Professor",
  ROLE_ENCARREGADO: "Encarregado",
  ROLE_COORDENACAO: "Coordenação",
};

const TIPO_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ROLE_ALUNO: { bg: "rgba(78,114,169,0.10)", text: "#2D4E7A", border: "rgba(78,114,169,0.25)" },
  ALUNO: { bg: "rgba(78,114,169,0.10)", text: "#2D4E7A", border: "rgba(78,114,169,0.25)" },
  ROLE_PROFESSOR: { bg: "rgba(160,133,96,0.12)", text: "#7A5020", border: "rgba(160,133,96,0.30)" },
  PROFESSOR: { bg: "rgba(160,133,96,0.12)", text: "#7A5020", border: "rgba(160,133,96,0.30)" },
  ROLE_ENCARREGADO: { bg: "rgba(74,143,89,0.10)", text: "#2D6A3F", border: "rgba(74,143,89,0.25)" },
  ENCARREGADO: { bg: "rgba(74,143,89,0.10)", text: "#2D6A3F", border: "rgba(74,143,89,0.25)" },
  ROLE_COORDENACAO: { bg: "rgba(44,28,10,0.08)", text: "#402F1D", border: "rgba(44,28,10,0.20)" },
  COORDENACAO: { bg: "rgba(44,28,10,0.08)", text: "#402F1D", border: "rgba(44,28,10,0.20)" },
};

function initials(name: string = ""): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatDate(dt: string | null): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

function isAluno(tipo?: string) {
  return tipo === "ROLE_ALUNO" || tipo === "ALUNO";
}

function isEncarregado(tipo?: string) {
  return tipo === "ROLE_ENCARREGADO" || tipo === "ENCARREGADO";
}

export default function PerfilPage() {
  const router = useRouter();

  const [perfil, setPerfil] = useState<UtilizadorResponseDto | null>(null);
  const [educandos, setEducandos] = useState<UtilizadorResumoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEducandos, setLoadingEducandos] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordAtual, setPasswordAtual] = useState("");
  const [novaPassword, setNovaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  const cardStyle: CSSProperties = {
    background: "#FFFCF8",
    border: "1px solid var(--border-warm)",
    borderRadius: 10,
    boxShadow: "0 16px 40px rgba(64,47,29,0.06)",
  };

  const labelStyle: CSSProperties = {
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "var(--accent-muted)",
    fontWeight: 300,
    marginBottom: 6,
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    let ativo = true;

    async function carregarPerfil() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch(`${BASE_URL}/api/utilizadores/meu-perfil`, { headers: authHeaders() });
        if (!res.ok) throw new Error();

        const data: UtilizadorResponseDto = await res.json();
        if (!ativo) return;

        setPerfil(data);
        setEducandos(data.educandos ?? []);

        if (isEncarregado(data.tipoUtilizador)) {
          setLoadingEducandos(true);
          try {
            const educandosRes = await fetch(`${BASE_URL}/api/utilizadores/meus-educandos`, { headers: authHeaders() });
            if (educandosRes.ok) {
              const lista: UtilizadorResumoDto[] = await educandosRes.json();
              if (ativo) setEducandos(lista);
            }
          } finally {
            if (ativo) setLoadingEducandos(false);
          }
        }
      } catch {
        if (ativo) setErrorMsg("Não foi possível carregar o perfil.");
      } finally {
        if (ativo) setLoading(false);
      }
    }

    carregarPerfil();
    return () => { ativo = false; };
  }, [router]);

  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => {
        setSuccessMsg(null);
        setErrorMsg(null);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  async function alterarPassword(e: FormEvent) {
    e.preventDefault();
    if (novaPassword !== confirmarPassword) {
      setErrorMsg("As passwords não coincidem.");
      return;
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

      setSuccessMsg("Palavra-passe alterada com sucesso!");
      setShowPasswordForm(false);
      setPasswordAtual("");
      setNovaPassword("");
      setConfirmarPassword("");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao alterar a palavra-passe.");
    } finally {
      setLoadingPassword(false);
    }
  }

  const tipoStyle = perfil ? TIPO_STYLES[perfil.tipoUtilizador] ?? TIPO_STYLES.ROLE_ALUNO : TIPO_STYLES.ROLE_ALUNO;
  const encarregadoNome = perfil?.encarregadoNome ?? perfil?.encarregado?.nome;
  const temBlocoRelacoes = perfil ? isAluno(perfil.tipoUtilizador) || isEncarregado(perfil.tipoUtilizador) : false;

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        .perfil-btn { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .perfil-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(64,47,29,.10); }
        .perfil-input:focus { border-color: rgba(160,133,96,.70) !important; box-shadow: 0 0 0 3px rgba(160,133,96,.12); outline: none; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: "transparent", fontFamily: "var(--font-lato)" }}>
        <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "18px 18px 28px" }}>
          <div style={{ width: "100%", maxWidth: 860, animation: "fadeUp .3s ease" }}>
            <section style={{ ...cardStyle, padding: 24, marginBottom: 16, background: "linear-gradient(135deg, #FFFCF8 0%, #FBF7F2 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, margin: "0 0 6px" }}>Conta</p>
                  <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 30, color: "var(--panel-dark)", fontWeight: 400, margin: 0 }}>O meu perfil</h1>
                  <p style={{ fontSize: 13, color: "var(--accent-muted)", fontWeight: 300, margin: "8px 0 0" }}>Consulta os teus dados e gere a tua palavra-passe.</p>
                </div>

                {perfil && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: tipoStyle.bg, border: `1px solid ${tipoStyle.border}`, color: tipoStyle.text, borderRadius: 999, padding: "7px 12px", fontSize: 11, letterSpacing: .7, textTransform: "uppercase" }}>
                    {TIPO_LABELS[perfil.tipoUtilizador] ?? perfil.tipoUtilizador}
                  </span>
                )}
              </div>
            </section>

            {loading && (
              <div style={{ ...cardStyle, display: "flex", justifyContent: "center", padding: 70 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border-warm)", borderTopColor: "var(--accent-gold)", animation: "spin .8s linear infinite" }} />
              </div>
            )}

            {perfil && (
              <div style={{ display: "grid", gridTemplateColumns: temBlocoRelacoes ? "minmax(0, 1.25fr) minmax(280px, .75fr)" : "minmax(0, 680px)", justifyContent: temBlocoRelacoes ? "stretch" : "center", gap: 16 }}>
                <section style={{ ...cardStyle, overflow: "hidden" }}>
                  <div style={{ padding: 24, borderBottom: "1px solid var(--border-warm)", display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{ width: 70, height: 70, borderRadius: "50%", background: "var(--panel-dark)", color: "var(--accent-gold)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontWeight: 400, fontSize: 23, letterSpacing: 1, flexShrink: 0 }}>
                      {initials(perfil.nome)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: 24, color: "var(--panel-dark)", fontWeight: 400, margin: "0 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{perfil.nome}</h2>
                      <p style={{ fontSize: 13, color: "var(--accent-muted)", fontWeight: 300, margin: 0, overflowWrap: "anywhere" }}>{perfil.email}</p>
                    </div>
                  </div>

                  <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}>
                    {[
                      { label: "Telefone", value: perfil.telefone || "—" },
                      { label: "NIF", value: perfil.nif || "—" },
                      { label: "Nascimento", value: formatDate(perfil.dataNascimento) },
                      { label: "Membro desde", value: formatDate(perfil.criadoEm) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 8, padding: 14 }}>
                        <div style={labelStyle}>{label}</div>
                        <div style={{ fontSize: 14, color: "var(--panel-dark)", fontWeight: 500 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {temBlocoRelacoes && (
                <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {isAluno(perfil.tipoUtilizador) && (
                    <section style={{ ...cardStyle, padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={labelStyle}>Encarregado</div>
                          <strong style={{ fontSize: 14, color: "var(--panel-dark)", fontWeight: 500 }}>Educação</strong>
                        </div>
                      </div>
                      {encarregadoNome ? (
                        <div style={{ padding: "11px 12px", borderRadius: 8, background: "rgba(74,143,89,0.08)", border: "1px solid rgba(74,143,89,0.20)", color: "#2D6A3F", fontSize: 13 }}>
                          {encarregadoNome}
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: "var(--accent-muted)", fontSize: 13 }}>Sem encarregado associado.</p>
                      )}
                    </section>
                  )}

                  {isEncarregado(perfil.tipoUtilizador) && (
                    <section style={{ ...cardStyle, padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div>
                            <div style={labelStyle}>Educandos</div>
                            <strong style={{ fontSize: 14, color: "var(--panel-dark)", fontWeight: 500 }}>{educandos.length} associados</strong>
                          </div>
                        </div>
                        {loadingEducandos && <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--border-warm)", borderTopColor: "#2D4E7A", animation: "spin .8s linear infinite" }} />}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {educandos.length > 0 ? educandos.map((educando) => (
                          <div key={educando.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 8, background: "#FBF7F2", border: "1px solid var(--border-warm)" }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(78,114,169,0.12)", color: "#2D4E7A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-playfair)", fontSize: 12 }}>
                              {initials(educando.nome)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "var(--panel-dark)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{educando.nome}</div>
                              {educando.email && <div style={{ color: "var(--accent-muted)", fontSize: 11, overflowWrap: "anywhere" }}>{educando.email}</div>}
                            </div>
                          </div>
                        )) : (
                          <p style={{ margin: 0, color: "var(--accent-muted)", fontSize: 13 }}>Sem educandos associados à conta.</p>
                        )}
                      </div>
                    </section>
                  )}

                </aside>
                )}

                <section style={{ ...cardStyle, gridColumn: "1 / -1", padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Segurança</div>
                      <strong style={{ fontFamily: "var(--font-playfair)", fontSize: 18, color: "var(--panel-dark)", fontWeight: 400 }}>Palavra-passe</strong>
                    </div>
                  </div>
                  <button className="perfil-btn" onClick={() => setShowPasswordForm(!showPasswordForm)}
                    style={{ padding: "11px 18px", borderRadius: 8, background: showPasswordForm ? "#FFFCF8" : "var(--panel-dark)", border: `1px solid ${showPasswordForm ? "var(--border-warm)" : "var(--panel-dark)"}`, color: showPasswordForm ? "var(--accent-muted)" : "var(--accent-gold)", fontFamily: "var(--font-lato)", fontSize: 12, letterSpacing: .7, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textTransform: "uppercase" }}>
                    <i className={`ti ${showPasswordForm ? "ti-x" : "ti-key"}`} style={{ fontSize: 14 }} />
                    {showPasswordForm ? "Cancelar" : "Alterar palavra-passe"}
                  </button>
                </section>

                {showPasswordForm && (
                  <form onSubmit={alterarPassword} style={{ ...cardStyle, gridColumn: "1 / -1", padding: 24, animation: "fadeUp .2s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(160,133,96,0.12)", color: "#7A5020", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="ti ti-key" />
                      </div>
                      <div>
                        <div style={labelStyle}>Segurança</div>
                        <h3 style={{ fontFamily: "var(--font-playfair)", fontSize: 19, color: "var(--panel-dark)", fontWeight: 400, margin: 0 }}>Alterar palavra-passe</h3>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                      {[
                        { label: "Palavra-passe atual", val: passwordAtual, set: setPasswordAtual },
                        { label: "Nova palavra-passe", val: novaPassword, set: setNovaPassword, min: 6 },
                        { label: "Confirmar nova password", val: confirmarPassword, set: setConfirmarPassword },
                      ].map(({ label, val, set, min }) => (
                        <div key={label}>
                          <label style={{ display: "block", ...labelStyle }}>{label}</label>
                          <input className="perfil-input" type="password" value={val} onChange={e => set(e.target.value)} required minLength={min}
                            style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 8, padding: "10px 12px", color: "var(--panel-dark)", fontFamily: "var(--font-lato)", fontSize: 13 }} />
                        </div>
                      ))}
                    </div>

                    <button className="perfil-btn" type="submit" disabled={loadingPassword}
                      style={{ marginTop: 16, padding: "12px 18px", borderRadius: 8, background: "var(--panel-dark)", border: "none", color: "var(--accent-gold)", fontFamily: "var(--font-lato)", fontSize: 12, fontWeight: 400, letterSpacing: 1, textTransform: "uppercase", cursor: loadingPassword ? "not-allowed" : "pointer", opacity: loadingPassword ? .7 : 1 }}>
                      {loadingPassword ? "A guardar..." : "Guardar palavra-passe"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {successMsg && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "rgba(45,106,63,0.10)", border: "1px solid rgba(45,106,63,0.25)", color: "#2D6A3F", borderRadius: 8, padding: "10px 16px", fontSize: 12, zIndex: 200, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-circle-check" /> {successMsg}
          <button onClick={() => setSuccessMsg(null)} style={{ background: "none", border: "none", color: "#2D6A3F", cursor: "pointer", marginLeft: 4 }}><i className="ti ti-x" /></button>
        </div>
      )}

      {errorMsg && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.22)", color: "#c0392b", borderRadius: 8, padding: "10px 16px", fontSize: 12, zIndex: 200, display: "flex", alignItems: "center", gap: 10 }}>
          <i className="ti ti-alert-circle" /> {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", marginLeft: 4 }}><i className="ti ti-x" /></button>
        </div>
      )}
    </>
  );
}