"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSearchParams } from "next/navigation";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface MensagenPreviewDto {
  id: string;
  nome: string;
  conteudo: string;
  horas: string;
}

interface UtilizadoreResumoDto {
  id: string;  
  nome: string;
}

interface MensagenDto {
  id: string | null;
  remetente: UtilizadoreResumoDto;
  destinatario: UtilizadoreResumoDto;
  conteudo: string;
  enviadaEm: string | null;
}

interface JwtPayload {
  sub: string;
  role: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getTokenPayload(): JwtPayload | null {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch { return null; }
}

function getInitials(name: string = ""): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatTime(dt: string | null): string {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch { return ""; }
}

function formatDate(dt: string | null): string {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return ""; }
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function MensagensPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estados do utilizador e sessão
  const [currentUserHashId, setCurrentUserHashId] = useState<string | null>(null);
  const [currentUserType, setCurrentUserType] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");

  // Estados principais do Chat
  const [previews, setPreviews] = useState<MensagenPreviewDto[]>([]);
  const [messages, setMessages] = useState<MensagenDto[]>([]);
  const [activeConv, setActiveConv] = useState<MensagenPreviewDto | null>(null);
  const [inputText, setInputText] = useState("");
  const [search, setSearch] = useState("");
  const [loadingPrev, setLoadingPrev] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estados para o Modal de Criação de Grupo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState("");
  const [utilizadoresBusca, setUtilizadoresBusca] = useState<UtilizadoreResumoDto[]>([]);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  
  // Estados para Gestão de Grupo (Coordenação)
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [membrosDoGrupoAtivo, setMembrosDoGrupoAtivo] = useState<UtilizadoreResumoDto[]>([]);

  // ── Verifica login e lê payload do token ──
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const payload = getTokenPayload();
    if (!payload) { router.push("/login"); return; }
    
    setCurrentUserHashId(payload.sub);
    
    // Tenta obter o nome guardado no login para a Navbar, senão usa o formato da Role
    const savedName = localStorage.getItem("userName");
    setUserName(savedName || payload.role);

    if (payload.role === "COORDENACAO") {
      setCurrentUserType(1);
    } else if (payload.role === "PROFESSOR") {
      setCurrentUserType(2);
    } else if (payload.role === "ALUNO"){
      setCurrentUserType(3);
    } else {
      setCurrentUserType(4);
    }
  }, [router]);

  // ── Load previews (Conversas Laterais) ──
  const loadPreviews = useCallback(async () => {
    try {
      const { data } = await api.get<MensagenPreviewDto[]>("/mensagens/previews");
      setPreviews(data);
    } catch (e: any) {
      if (e.response?.status === 401) { router.push("/login"); return; }
      setError(`Erro ao carregar conversas: ${e.message}`);
    } finally {
      setLoadingPrev(false);
    }
  }, [router]);

  // ── Load messages (Histórico do Chat) ──
  const loadMessages = useCallback(async (convId: string) => {
    try {
      let url = "";
      if (convId.startsWith("GRUPO_")) {
        const grupoHash = convId.replace("GRUPO_", "");
        url = `/mensagens/conversa-grupo?grupoId=${grupoHash}`;
      } else {
        url = `/mensagens/conversa?conversaId=${convId}`;
      }

      const { data } = await api.get<MensagenDto[]>(url);
      setMessages(prev => {
        if (prev.length === data.length) return prev;
        return data;
      });
    } catch (e: any) {
      if (e.response?.status === 401) { router.push("/login"); return; }
      setError(`Erro ao carregar mensagens: ${e.message}`);
    }
  }, [router]);

  useEffect(() => { loadPreviews(); }, [loadPreviews]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Gestão de Membros de Grupo ──
  const loadMembrosGrupo = async (grupoIdHash: string) => {
    try {
      const resMembros = await api.get<UtilizadoreResumoDto[]>(`/grupos/${grupoIdHash}/membros`);
      setMembrosDoGrupoAtivo(resMembros.data);

      if (utilizadoresBusca.length === 0) {
        const resGeral = await api.get<UtilizadoreResumoDto[]>("/utilizadores/disponiveis-grupo");
        const listaFiltrada = resGeral.data.filter(u => u.id !== currentUserHashId);
        setUtilizadoresBusca(listaFiltrada);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do grupo/utilizadores", e);
      setError("Não foi possível carregar a lista de utilizadores.");
    }
  };

  // ── Abrir Conversa ──
  const openConversation = useCallback(async (preview: MensagenPreviewDto) => {
    setActiveConv(preview);
    setMessages([]);       
    setLoadingMsgs(true);  

    await loadMessages(preview.id);
    setLoadingMsgs(false);

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => loadMessages(preview.id), 5000);
  }, [loadMessages]);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // ── Enviar Mensagem ──
  async function sendMessage() {
    const content = inputText.trim();
    if (!content || !activeConv) return;

    const currentId = activeConv.id;
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
        if (currentId.startsWith("GRUPO_")) {
            const grupoHash = currentId.replace("GRUPO_", "");
            await api.post("/mensagens/grupo", {
                grupoId: grupoHash,
                conteudo: content,
            });
        } else {
            await api.post("/mensagens", {
                destinatario: currentId,
                conteudo: content,
            });
        }
        
        await loadMessages(currentId);
        await loadPreviews(); 
    } catch (e: any) {
        setError(`Erro ao enviar: ${e.message}`);
    }
  }

  // Quando alguém clica numa notificação do Sino

    
  async function handleRemoverMembro(membroId: string) {
    if (!activeConv) return;
    const grupoId = activeConv.id.replace("GRUPO_", "");
    try {
      await api.delete(`/grupos/${grupoId}/remover/${membroId}`);
      setMembrosDoGrupoAtivo(prev => prev.filter(m => m.id !== membroId));
    } catch (e: any) {
      setError("Erro ao remover membro.");
    }
  }

  async function handleAdicionarMembro(membroId: string) {
    if (!activeConv || !membroId) return;
    const grupoId = activeConv.id.replace("GRUPO_", "");
    try {
      await api.put(`/grupos/${grupoId}/adicionar/${membroId}`);
      loadMembrosGrupo(grupoId);
    } catch (e: any) {
      setError("Erro ao adicionar membro.");
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  const filteredPreviews = previews.filter((p) =>
    p.nome?.toLowerCase().includes(search.toLowerCase())
  );

  let lastDate = "";

  useEffect(() => {
    const vId = searchParams.get("vendedorId");
    const vNome = searchParams.get("nome");

    if (vId && vNome && !activeConv) { 
      const conversaExistente = previews.find(p => p.id === vId);

      if (conversaExistente) {
        openConversation(conversaExistente);
      } else {
        const novoContexto = {
          id: vId,
          nome: decodeURIComponent(vNome),
          conteudo: "Iniciar nova conversa...",
          horas: ""
        } as MensagenPreviewDto;

        setActiveConv(novoContexto);
        setMessages([]);
        loadMessages(vId);

        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(() => loadMessages(vId), 5000);
      }

      router.replace('/mensagens', { scroll: false });
    }
  }, [searchParams, previews, activeConv, loadMessages, router, openConversation]);

  async function openCreateGroup() {
    setIsModalOpen(true);
    setError(null);
    try {
      const { data } = await api.get<UtilizadoreResumoDto[]>("/utilizadores/disponiveis-grupo");
      const listaFiltrada = data.filter(u => u.id !== currentUserHashId);
      setUtilizadoresBusca(listaFiltrada);
    } catch (e: any) { 
      setError("Erro ao carregar lista de utilizadores."); 
    }
  }

  async function handleCriarGrupo() {
    if (!nomeNovoGrupo || membrosSelecionados.length === 0) return;
    setError(null);

    try {
      const response = await api.post("/grupos", {
        nome: nomeNovoGrupo,
        membrosIds: membrosSelecionados 
      });

      const grupoId = response.data.id || response.data; 

      const novoGrupoPreview = {
        id: `GRUPO_${grupoId}`, 
        nome: nomeNovoGrupo,
        conteudo: "Grupo criado com sucesso!",
        horas: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
      };

      setPreviews(prev => [novoGrupoPreview, ...prev]);
      setIsModalOpen(false);
      setNomeNovoGrupo("");
      setMembrosSelecionados([]);
      loadPreviews();
      
    } catch (e: any) {
      const errorMsg = e.response?.data || "Erro ao criar grupo";
      setError(typeof errorMsg === 'string' ? errorMsg : "Erro de validação no servidor.");
    }
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100% { transform:scale(.6); opacity:.5; } 40% { transform:scale(1); opacity:1; } }
        @keyframes overlayShow { from { opacity: 0; } to { opacity: 1; } }
        @keyframes contentShow { from { opacity: 0; transform: translate(-50%, -46%) scale(0.98); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      `}</style>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ═══ SIDEBAR DE CONVERSAS ═══ */}
        <aside style={{
          width: 340, minWidth: 340, background: "var(--panel-light)",
          borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 700, color: "var(--menu-dark)", letterSpacing: "-.01em" }}>
                Mensa<span style={{ color: "var(--accent-gold)" }}>gens</span>
              </h1>
              <p style={{ fontSize:".8rem", color:"var(--text-muted)", marginTop:2, fontWeight:400 }}>As minhas conversas</p>
            </div>
            
            {/* Botão criar grupo */}
            {currentUserType !== 3 && (
              <button 
                onClick={openCreateGroup}
                style={{ 
                  background: "transparent", border: "1.5px solid var(--accent-gold)", 
                  borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-gold)",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-gold)"; e.currentTarget.style.color = "#FFF"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--accent-gold)"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            )}
          </div>

          {/* Input Pesquisa */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-color)" }}>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar conversa…"
              style={{
                width: "100%", background: "var(--bg-main)", border: "1px solid var(--border-color)",
                borderRadius: 8, padding: "10px 14px", color: "var(--text-dark)",
                fontFamily: "'Lato', sans-serif", fontSize: ".85rem", outline: "none",
                transition: "border-color 0.2s"
              }}
              onFocus={e => e.currentTarget.style.borderColor = "var(--accent-gold)"}
              onBlur={e => e.currentTarget.style.borderColor = "var(--border-color)"}
            />
          </div>

          {/* Lista de Conversas Laterais */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {loadingPrev ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-gold)", display: "block", animation: `bounce .9s ease ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            ) : filteredPreviews.length === 0 ? (
              <p style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: ".85rem" }}>Nenhuma conversa encontrada.</p>
            ) : filteredPreviews.map((p) => {
              const isActive = activeConv?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => openConversation(p)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 20px", cursor: "pointer",
                    borderLeft: isActive ? "4px solid var(--accent-gold)" : "4px solid transparent",
                    background: isActive ? "#F6EFE5" : "transparent",
                    transition: "background .15s, border-color .15s",
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = "#FAF4EC"; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Avatar Circular */}
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: p.id.startsWith("GRUPO_") ? "linear-gradient(135deg, #71583B, #503C25)" : "linear-gradient(135deg, #EADFC9, #C5A880)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: ".9rem", color: p.id.startsWith("GRUPO_") ? "#FFF" : "var(--menu-dark)",
                  }}>
                    {p.id.startsWith("GRUPO_") ? "👥" : getInitials(p.nome)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--text-dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div>
                    <div style={{ fontSize: ".8rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{p.conteudo}</div>
                  </div>
                  <div style={{ fontSize: ".72rem", color: "var(--text-muted)", flexShrink: 0 }}>{p.horas}</div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ═══ CHAT VAZIO OU ATIVO ═══ */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg-main)" }}>
          {!activeConv ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "var(--text-muted)" }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: "var(--accent-gold)", opacity: 0.7 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ fontSize: "1rem", fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>Seleciona uma conversa para começar a interagir</p>
            </div>
          ) : (
            <>
              {/* Header do Chat Ativo */}
              <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-color)", background: "var(--panel-light)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: activeConv.id.startsWith("GRUPO_") ? "linear-gradient(135deg, #71583B, #503C25)" : "linear-gradient(135deg, #EADFC9, #C5A880)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: ".85rem", color: activeConv.id.startsWith("GRUPO_") ? "#FFF" : "var(--menu-dark)", flexShrink: 0,
                  }}>
                    {activeConv.id.startsWith("GRUPO_") ? "👥" : getInitials(activeConv.nome)}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--menu-dark)" }}>{activeConv.nome}</div>
                    <div style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: 1 }}>
                      {activeConv.id.startsWith("GRUPO_") ? "Conversa de Grupo" : "Online"}
                    </div>
                  </div>
                </div>

                {/* Botão Gerir Membros de Grupo */}
                {activeConv.id.startsWith("GRUPO_") && currentUserType === 1 && (
                  <button 
                    onClick={() => {
                      if (activeConv) {
                        const grupoId = activeConv.id.replace("GRUPO_", "");
                        loadMembrosGrupo(grupoId); 
                        setIsEditGroupModalOpen(true);
                      }
                    }} 
                    style={{ 
                      background: "transparent", 
                      border: "1.5px solid var(--menu-dark)", 
                      padding: "8px 16px", 
                      borderRadius: "8px", 
                      color: "var(--menu-dark)", 
                      fontSize: "0.78rem", 
                      cursor: "pointer", 
                      fontWeight: 700,
                      fontFamily: "'Lato', sans-serif",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "var(--menu-dark)"; e.currentTarget.style.color = "#FFF"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--menu-dark)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    Gerir Membros
                  </button>
                )}
              </header>

              {/* Feed de Mensagens Históricas */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
                {loadingMsgs ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-gold)", display: "block", animation: `bounce .9s ease ${i * 0.15}s infinite` }} />
                      ))}
                    </div>
                  </div>
                ) : messages.map((m, i) => {
                  const isSent = m.remetente.id === currentUserHashId;
                  const date = formatDate(m.enviadaEm);
                  const showDiv = date !== lastDate;
                  if (showDiv) lastDate = date;
                  
                  return (
                    <div key={`${m.id ?? ""}-${i}`}>
                      {showDiv && (
                        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "16px 0", color: "var(--text-muted)", fontSize: ".75rem", fontWeight: 400 }}>
                          <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
                          {date}
                          <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
                        </div>
                      )}
                      
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexDirection: isSent ? "row-reverse" : "row", animation: "fadeUp .25s ease" }}>
                        {!isSent && (
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg, #EADFC9, #C5A880)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: ".65rem", color: "var(--menu-dark)",
                          }}>
                            {getInitials(m.remetente.nome)}
                          </div>
                        )}
                        
                        <div style={{ display: "flex", flexDirection: "column", maxWidth: "65%", alignItems: isSent ? "flex-end" : "flex-start" }}>
                          {!isSent && activeConv.id.startsWith("GRUPO_") && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--menu-dark)', marginBottom: 3, marginLeft: 4 }}>
                              {m.remetente.nome}
                            </span>
                          )}
                          <div style={{
                            padding: "11px 16px",
                            borderRadius: isSent ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            fontSize: ".9rem", lineHeight: 1.5, wordBreak: "break-word",
                            background: isSent ? "var(--chat-sent)" : "var(--chat-received)",
                            border: `1px solid ${isSent ? "var(--menu-dark)" : "var(--border-color)"}`,
                            color: isSent ? "var(--chat-sent-text)" : "var(--chat-received-text)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.03)"
                          }}>
                            {m.conteudo}
                          </div>
                          <div style={{ fontSize: ".68rem", color: "var(--text-muted)", marginTop: 4, padding: "0 4px" }}>
                            {formatTime(m.enviadaEm)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Caixa de Input inferior */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", background: "var(--panel-light)", display: "flex", gap: 12, alignItems: "flex-end" }}>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={autoResize}
                  onKeyDown={handleKey}
                  rows={1}
                  placeholder="Escreve uma mensagem…"
                  style={{
                    flex: 1, background: "var(--bg-main)", border: "1px solid var(--border-color)",
                    borderRadius: 12, padding: "12px 16px", color: "var(--text-dark)",
                    fontFamily: "'Lato', sans-serif", fontSize: ".9rem",
                    resize: "none", maxHeight: 120, outline: "none", lineHeight: 1.5,
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "var(--accent-gold)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--border-color)"}
                />
                <button 
                  onClick={sendMessage} 
                  style={{ 
                    width: 44, height: 44, borderRadius: "50%", 
                    background: "var(--accent-gold)", border: "none", cursor: "pointer", 
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "background 0.2s" 
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--accent-gold)"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFF"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ═══ MODAL: CRIAR GRUPO ═══ */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44, 37, 30, 0.4)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayShow 0.2s ease" }}>
          <div style={{ 
            background: "var(--panel-light)", border: "1px solid var(--border-color)", borderRadius: 16, 
            width: "90%", maxWidth: 460, padding: 32, position: "relative", animation: "contentShow 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
          }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--menu-dark)", marginBottom: 20 }}>
              Criar Novo <span style={{ color: "var(--accent-gold)" }}>Grupo</span>
            </h2>
            
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Nome do Grupo</label>
              <input 
                value={nomeNovoGrupo} onChange={e => setNomeNovoGrupo(e.target.value)}
                placeholder="Ex: Turma Avançada de Ballet"
                style={{ width: "100%", background: "var(--bg-main)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 12, color: "var(--text-dark)", outline: "none" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, display: "block", marginBottom: 6 }}>Selecionar Membros</label>
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: 8, padding: 8, background: "var(--bg-main)" }}>
                {utilizadoresBusca.map(u => {
                  const isSelected = membrosSelecionados.includes(u.id);
                  return (
                    <div 
                      key={u.id} 
                      onClick={() => setMembrosSelecionados(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      style={{ 
                        padding: "10px 12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                        background: isSelected ? "#EADFC9" : "transparent",
                        marginBottom: 4, transition: "all 0.15s"
                      }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--menu-dark)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700 }}>
                        {getInitials(u.nome)}
                      </div>
                      <span style={{ fontSize: "0.88rem", color: "var(--text-dark)" }}>{u.nome}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 8, background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-dark)", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button 
                onClick={handleCriarGrupo}
                disabled={!nomeNovoGrupo || membrosSelecionados.length === 0}
                style={{ 
                  flex: 1.8, padding: 12, borderRadius: 8, background: "var(--menu-dark)", border: "none", color: "#FFF", cursor: "pointer", fontWeight: 700,
                  opacity: (!nomeNovoGrupo || membrosSelecionados.length === 0) ? 0.4 : 1 
                }}
              >Criar Grupo</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: GERIR MEMBROS DO GRUPO ═══ */}
      {isEditGroupModalOpen && activeConv && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44, 37, 30, 0.4)", backdropFilter: "blur(4px)", zIndex: 101, display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayShow 0.2s ease" }}>
          <div style={{ background: "var(--panel-light)", border: "1px solid var(--border-color)", borderRadius: 16, width: "90%", maxWidth: 460, padding: 32, animation: "contentShow 0.3s ease" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--menu-dark)", marginBottom: 18 }}>
              Gerir Membros: <span style={{ color: "var(--accent-gold)" }}>{activeConv?.nome}</span>
            </h2>
            
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Membros Atuais</p>
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: 8, background: "var(--bg-main)" }}>
                {membrosDoGrupoAtivo.length === 0 && <p style={{ padding: 15, fontSize: "0.8rem", color: "var(--text-muted)" }}>Nenhum membro ativo.</p>}
                {membrosDoGrupoAtivo.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-dark)" }}>{m.nome}</span>
                    <button 
                      onClick={() => handleRemoverMembro(m.id)}
                      style={{ background: "none", border: "none", color: "#C94B4B", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
                    >Remover</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Adicionar Novo Utilizador</p>
              <select 
                onChange={(e) => { if(e.target.value) handleAdicionarMembro(e.target.value); e.target.value = ""; }}
                style={{ width: "100%", background: "var(--bg-main)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 12, color: "var(--text-dark)", outline: "none" }}
              >
                <option value="">Selecione um utilizador...</option>
                {utilizadoresBusca.filter(u => !membrosDoGrupoAtivo.find(m => m.id === u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setIsEditGroupModalOpen(false)} 
              style={{ width: "100%", padding: 12, borderRadius: 8, background: "var(--menu-dark)", border: "none", color: "#FFF", cursor: "pointer", fontWeight: 700 }}
            >Concluir</button>
          </div>
        </div>
      )}

      {/* Alerta de erro Toast */}
      {error && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#FFF5F5", border: "1px solid #ECAAAA", color: "#C94B4B", borderRadius: 8, padding: "12px 20px", fontSize: ".85rem", zIndex: 1000, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          {error} <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", color: "#C94B4B", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}
    </>
  );
}