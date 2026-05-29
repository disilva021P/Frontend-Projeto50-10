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
  criadorId?: string;
  criador?: { id: string; nome?: string };
  criadoPorId?: string;
  ownerId?: string;
}

interface UtilizadorFiltroGrupoDto {
  id: string;  
  nome: string;
  dataNascimento: string | null;
}

interface UtilizadoreResumoDto {
  id: string;
  nome: string;
}

interface MensagenDto {
  id: string | null;
  remetente: { id: string; nome: string };
  destinatario: { id: string; nome: string };
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

function formatUserBadge(nome: string): { label: string; color: string } {
  const n = nome.toUpperCase();
  if (n.includes("COORD") || n.includes("ADMIN")) return { label: "Coordenação", color: "#D4AF37" };
  if (n.includes("PROF") || n.includes("DOCENTE")) return { label: "Professor", color: "#4A90E2" };
  if (n.includes("ENCARREGADO") || n.includes("PAI")) return { label: "Encarregado", color: "#9B59B6" };
  return { label: "Aluno", color: "#2ECC71" };
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
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState("");
  const [utilizadoresBusca, setUtilizadoresBusca] = useState<UtilizadorFiltroGrupoDto[]>([]);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  const [groupCreatorMap, setGroupCreatorMap] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("messageGroupCreators");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Estados para Gestão e Detalhes do Grupo
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [membrosDoGrupoAtivo, setMembrosDoGrupoAtivo] = useState<UtilizadoreResumoDto[]>([]);

  // Estado auxiliar para controlar se o utilizador autenticado é um aluno menor de idade
  const [isLoggedUserAlunoMenor, setIsLoggedUserAlunoMenor] = useState(false);

  // ── Verifica login e token ──
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const payload = getTokenPayload();
    if (!payload) { router.push("/login"); return; }
    
    setCurrentUserHashId(payload.sub);
    const savedName = localStorage.getItem("userName");
    setUserName(savedName || payload.role);

    let userType = 4;
    if (payload.role === "COORDENACAO" || payload.role === "ADMIN") {
      userType = 1;
    } else if (payload.role === "PROFESSOR") {
      userType = 2;
    } else if (payload.role === "ALUNO"){
      userType = 3;
    }
    setCurrentUserType(userType);

    if (userType === 3) {
      api.get<boolean>("/grupos/sou-menor")
        .then((res) => {
          setIsLoggedUserAlunoMenor(res.data);
        })
        .catch((err) => {
          console.error("Erro ao verificar restrição de idade no Java:", err);
          setIsLoggedUserAlunoMenor(false); 
        });
    } else {
      setIsLoggedUserAlunoMenor(false); 
    }
  }, [router]);

  // ── Load previews ──
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

  // ── Load messages ──
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
        const resGeral = await api.get<UtilizadorFiltroGrupoDto[]>("/grupos/disponiveis-grupo");
        const listaFiltrada = resGeral.data.filter(u => u.id !== currentUserHashId);
        setUtilizadoresBusca(listaFiltrada);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do grupo/utilizadores", e);
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

  async function handleRemoverMembro(membroId: string) {
    if (!activeConv) return;
    const grupoId = activeConv.id.replace("GRUPO_", "");
    try {
      await api.delete(`/grupos/${grupoId}/remover/${membroId}`);
      setMembrosDoGrupoAtivo(prev => prev.filter(m => m.id !== membroId));
    } catch (e: any) {
      setError("Não foi possível remover.");
    }
  }

  async function handleAdicionarMembro(membroId: string) {
    if (!activeConv || !membroId) return;
    const grupoId = activeConv.id.replace("GRUPO_", "");
    try {
      await api.put(`/grupos/${grupoId}/adicionar/${membroId}`);
      loadMembrosGrupo(grupoId);
    } catch (e: any) {
      setError("Não foi possível adicionar.");
    }
  }

  function getGroupCreatorId(preview: MensagenPreviewDto | null): string | undefined {
    if (!preview) return undefined;
    const grupoId = preview.id.startsWith("GRUPO_") ? preview.id.replace("GRUPO_", "") : preview.id;
    return preview.criadorId ?? preview.criadoPorId ?? preview.ownerId ?? preview.criador?.id ?? groupCreatorMap[grupoId];
  }

  function canManageActiveGroup(): boolean {
    if (!activeConv?.id.startsWith("GRUPO_")) return false;
    return currentUserType === 1 || getGroupCreatorId(activeConv) === currentUserHashId;
  }

  function canStartDirectMessages(): boolean {
    return !isLoggedUserAlunoMenor;
  }

  async function openDirectModal() {
    if (!canStartDirectMessages()) return;
    setIsDirectModalOpen(true);
    setError(null);
    try {
      const { data } = await api.get<UtilizadorFiltroGrupoDto[]>("/grupos/disponiveis-grupo");
      const listaFiltrada = data.filter(u => u.id !== currentUserHashId);
      setUtilizadoresBusca(listaFiltrada);
    } catch {
      setError("Erro ao carregar lista de utilizadores.");
    }
  }

  function startDirectConversation(user: UtilizadorFiltroGrupoDto) {
    const conversaExistente = previews.find(p => p.id === user.id);
    const preview = conversaExistente ?? {
      id: user.id,
      nome: user.nome,
      conteudo: "Iniciar nova conversa...",
      horas: ""
    };

    setIsDirectModalOpen(false);
    openConversation(preview as MensagenPreviewDto);
  }

  function startDirectConversationFromMember(user: UtilizadoreResumoDto) {
    const conversaExistente = previews.find(p => p.id === user.id);
    const preview = conversaExistente ?? {
      id: user.id,
      nome: user.nome,
      conteudo: "Iniciar nova conversa...",
      horas: ""
    };

    setIsEditGroupModalOpen(false);
    openConversation(preview as MensagenPreviewDto);
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
      const { data } = await api.get<UtilizadorFiltroGrupoDto[]>("/grupos/disponiveis-grupo");
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
      if (currentUserHashId) {
        const nextMap = { ...groupCreatorMap, [grupoId]: currentUserHashId };
        setGroupCreatorMap(nextMap);
        localStorage.setItem("messageGroupCreators", JSON.stringify(nextMap));
      }

      const novoGrupoPreview = {
        id: `GRUPO_${grupoId}`, 
        nome: nomeNovoGrupo,
        conteudo: "Grupo criado com sucesso!",
        horas: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        criadorId: currentUserHashId ?? undefined
      };

      setPreviews(prev => [novoGrupoPreview, ...prev]);
      setIsModalOpen(false);
      setNomeNovoGrupo("");
      setMembrosSelecionados([]);
      loadPreviews();
    } catch (e: any) {
      setError("Erro ao criar grupo.");
    }
  }
  function renderConversationIcon(nome: string, isGroup: boolean, size = 44) {
    const fontSize = size >= 42 ? ".82rem" : ".68rem";

    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size >= 42 ? 14 : 12,
          flexShrink: 0,
          background: "linear-gradient(135deg, #FFFDF8 0%, #F8EEDC 100%)",
          border: "1px solid rgba(212,175,55,0.48)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--menu-dark)",
          fontFamily: "'Playfair Display', serif",
          fontWeight: 800,
          fontSize,
          boxShadow: "0 10px 22px rgba(44,37,30,0.08)",
        }}
      >
        {isGroup ? (
          <svg width={size >= 42 ? "20" : "16"} height={size >= 42 ? "20" : "16"} viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ) : (
          getInitials(nome)
        )}
      </div>
    );
  }

  function formatPreviewHour(value: string): string {
    if (!value) return "";
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return formatTime(value);
    return value.length > 5 ? value.slice(0, 5) : value;
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100% { transform:scale(.6); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
        @keyframes overlayShow { from { opacity: 0; } to { opacity: 1; } }
        @keyframes contentShow { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .custom-chat-scroll::-webkit-scrollbar { width: 5px; }
        .custom-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-chat-scroll::-webkit-scrollbar-thumb { background: rgba(44, 37, 30, 0.14); border-radius: 10px; }

        .messages-sidebar-search:focus {
          border-color: rgba(212,175,55,0.75) !important;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.12) !important;
          background: #FFFFFF !important;
        }

        .conversation-list-item {
          transition: background .18s ease, box-shadow .18s ease, transform .18s ease, border-color .18s ease;
        }

        .conversation-list-item:hover {
          background: rgba(255,255,255,0.56) !important;
          border-color: rgba(212,175,55,0.22) !important;
          box-shadow: 0 12px 28px rgba(44,37,30,0.055);
          transform: translateY(-1px);
        }

        .create-group-button:hover,
        .start-direct-button:hover,
        .send-message-button:hover,
        .modal-icon-button:hover,
        .modal-primary-button:hover,
        .modal-secondary-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.02);
        }

        .composer-textarea:focus {
          border-color: rgba(212,175,55,0.82) !important;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.12), 0 10px 22px rgba(44,37,30,0.06) !important;
          background: #FFFFFF !important;
        }

        .modal-members-list::-webkit-scrollbar { width: 4px; }
        .modal-members-list::-webkit-scrollbar-track { background: transparent; }
        .modal-members-list::-webkit-scrollbar-thumb { background: rgba(44, 37, 30, 0.16); border-radius: 10px; }

        .modal-user-row:hover {
          background: #FFFFFF !important;
          border-color: rgba(212,175,55,0.34) !important;
        }

        .message-panel-shell {
          background:
            radial-gradient(circle at top left, rgba(212,175,55,0.12), transparent 34%),
            linear-gradient(180deg, #FBFAF7 0%, #F4EEE5 100%);
        }
      `}</style>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>

        {/* ═══ SIDEBAR DE CONVERSAS ═══ */}
        <aside
          style={{
            width: 350,
            minWidth: 350,
            background: "linear-gradient(180deg, var(--panel-light) 0%, #F2EDE4 100%)",
            borderRight: "1px solid rgba(44,37,30,0.14)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "24px 22px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.52rem", fontWeight: 700, color: "var(--menu-dark)", letterSpacing: "-.01em", margin: 0 }}>
                Mensa<span style={{ color: "var(--accent-gold)" }}>gens</span>
              </h1>
              <p style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: 3, fontWeight: 500 }}>Conversas e grupos</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {canStartDirectMessages() && (
                <button
                  type="button"
                  onClick={openDirectModal}
                  className="start-direct-button"
                  title="Nova conversa direta"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(44,37,30,0.12)",
                    borderRadius: 14,
                    width: 42,
                    height: 42,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2C251E",
                    boxShadow: "0 8px 18px rgba(44,37,30,0.05)",
                    transition: "all 0.18s ease",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                    <path d="M8 9h8" />
                    <path d="M8 13h5" />
                  </svg>
                </button>
              )}

              {!isLoggedUserAlunoMenor && (
              <button
                type="button"
                onClick={openCreateGroup}
                className="create-group-button"
                title="Criar novo grupo"
                style={{
                  background: "#FFFDF8",
                  border: "1px solid rgba(212,175,55,0.65)",
                  borderRadius: 14,
                  width: 42,
                  height: 42,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#D4AF37",
                  boxShadow: "0 8px 18px rgba(44,37,30,0.06)",
                  transition: "all 0.18s ease",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              )}
            </div>
          </div>

          {/* Input Pesquisa */}
          <div style={{ padding: "0 20px 16px", position: "relative" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(44,37,30,0.55)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 34, top: 12, pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar conversa..."
              className="messages-sidebar-search"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(44,37,30,0.12)",
                borderRadius: 13,
                padding: "12px 14px 12px 38px",
                color: "var(--text-dark)",
                fontFamily: "'Lato', sans-serif",
                fontSize: ".86rem",
                outline: "none",
                boxShadow: "0 8px 20px rgba(44,37,30,0.035)",
                transition: "all .18s ease",
              }}
            />
          </div>

          {/* Lista de Conversas Laterais */}
          <div className="custom-chat-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 10px 14px" }}>
            {loadingPrev ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-gold)", display: "block", animation: `bounce .9s ease ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            ) : filteredPreviews.length === 0 ? (
              <p style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: ".84rem", fontStyle: "italic" }}>Nenhuma conversa encontrada.</p>
            ) : filteredPreviews.map((p) => {
              const isActive = activeConv?.id === p.id;
              const isGroup = p.id.startsWith("GRUPO_");

              return (
                <div
                  key={p.id}
                  onClick={() => openConversation(p)}
                  className="conversation-list-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 12px",
                    cursor: "pointer",
                    borderRadius: 16,
                    background: isActive ? "rgba(255,255,255,0.70)" : "transparent",
                    border: isActive ? "1px solid rgba(212,175,55,0.45)" : "1px solid transparent",
                    boxShadow: isActive ? "0 12px 26px rgba(44,37,30,0.07)" : "none",
                    marginBottom: 6,
                  }}
                >
                  {renderConversationIcon(p.nome, isGroup, 42)}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontSize: ".88rem", fontWeight: 800, color: "var(--text-dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div>
                      <div style={{ fontSize: ".68rem", color: isActive ? "var(--accent-gold)" : "var(--menu-dark)", fontWeight: 800, flexShrink: 0 }}>{formatPreviewHour(p.horas)}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, minWidth: 0 }}>
                      {isGroup && (
                        <span style={{ fontSize: ".62rem", fontWeight: 800, color: "var(--accent-gold)", background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.28)", borderRadius: 999, padding: "2px 6px", flexShrink: 0 }}>
                          GRUPO
                        </span>
                      )}
                      <span style={{ fontSize: ".78rem", color: "var(--text-dark)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: 0.9 }}>{p.conteudo}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <main style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "#FBFAF7",
        }}>
          {!activeConv ? (
            <div className="message-panel-shell" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "var(--text-muted)" }}>
              <div style={{ width: 82, height: 82, borderRadius: 24, background: "#FFFDF8", border: "1px solid rgba(212,175,55,0.38)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 38px rgba(44,37,30,0.09)" }}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p style={{ fontSize: ".96rem", fontFamily: "'Playfair Display', serif", fontStyle: "italic", margin: 0 }}>Seleciona uma conversa para começar a interagir</p>
            </div>
          ) : (
            <>
              {/* Header do Chat Ativo */}
              <header
                onClick={() => {
                  if (activeConv.id.startsWith("GRUPO_")) {
                    const grupoId = activeConv.id.replace("GRUPO_", "");
                    loadMembrosGrupo(grupoId);
                    setIsEditGroupModalOpen(true);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "15px 24px",
                  borderBottom: "1px solid rgba(44,37,30,0.10)",
                  background: "#F9F9FA",
                  boxShadow: "0 8px 22px rgba(44,37,30,0.025)",
                  cursor: activeConv.id.startsWith("GRUPO_") ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {renderConversationIcon(activeConv.nome, activeConv.id.startsWith("GRUPO_"), 42)}

                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.08rem", fontWeight: 800, color: "var(--menu-dark)" }}>{activeConv.nome}</div>
                    <div style={{ fontSize: ".74rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: activeConv.id.startsWith("GRUPO_") ? "var(--accent-gold)" : "#52B788", boxShadow: activeConv.id.startsWith("GRUPO_") ? "0 0 0 3px rgba(212,175,55,0.12)" : "0 0 0 3px rgba(82,183,136,0.12)" }} />
                      {activeConv.id.startsWith("GRUPO_") ? "Ver participantes do grupo" : "Conversa direta"}
                    </div>
                  </div>
                </div>

                {activeConv.id.startsWith("GRUPO_") && (
                  <div style={{ fontSize: "0.78rem", color: "var(--accent-gold)", fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>Detalhes</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                )}
              </header>

              {/* Feed de Mensagens Históricas */}
              <div
                className="custom-chat-scroll"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "26px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  background: "linear-gradient(180deg, #FBFAF7 0%, #F5EFE6 100%)",
                }}
              >
                {loadingMsgs ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 14px" }}>
                          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(44,37,30,0.14), transparent)" }} />
                          <div style={{ padding: "7px 14px", borderRadius: 999, background: "#FFFDF8", border: "1px solid rgba(212,175,55,0.36)", color: "var(--menu-dark)", fontSize: ".7rem", fontWeight: 900, letterSpacing: ".03em", textTransform: "uppercase", boxShadow: "0 8px 22px rgba(44,37,30,0.06)", whiteSpace: "nowrap" }}>
                            {date}
                          </div>
                          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(44,37,30,0.14), transparent)" }} />
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-end",
                          gap: 10,
                          flexDirection: isSent ? "row-reverse" : "row",
                          animation: "fadeUp .22s ease-out",
                          marginBottom: 5,
                          width: "100%",
                        }}
                      >
                        {!isSent && renderConversationIcon(m.remetente.nome, false, 34)}

                        <div style={{ display: "flex", flexDirection: "column", maxWidth: "58%", alignItems: isSent ? "flex-end" : "flex-start" }}>
                          {!isSent && activeConv.id.startsWith("GRUPO_") && (
                            <span style={{ fontSize: ".72rem", fontWeight: 800, color: "var(--menu-dark)", background: "rgba(255,255,255,0.78)", border: "1px solid rgba(212,175,55,0.22)", borderRadius: 999, padding: "4px 9px", marginBottom: 5, marginLeft: 3 }}>
                              {m.remetente.nome}
                            </span>
                          )}

                          <div
                            style={{
                              padding: "11px 16px",
                              borderRadius: isSent ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
                              fontSize: ".9rem",
                              lineHeight: 1.5,
                              wordBreak: "break-word",
                              background: isSent ? "linear-gradient(135deg, #2C251E 0%, #4A3A2A 100%)" : "#FFFFFF",
                              color: isSent ? "#FFFFFF" : "var(--text-dark)",
                              border: isSent ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(44,37,30,0.08)",
                              boxShadow: isSent ? "0 12px 28px rgba(44,37,30,0.20)" : "0 10px 24px rgba(44,37,30,0.07)",
                            }}
                          >
                            {m.conteudo}
                          </div>

                          <div style={{ fontSize: ".66rem", color: "rgba(44,37,30,0.50)", marginTop: 5, padding: "0 6px", fontWeight: 700 }}>
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
              <div style={{
                padding: "14px 24px 18px",
                borderTop: "1px solid rgba(44,37,30,0.10)",
                background: "var(--panel-light)",
                boxShadow: "0 -10px 28px rgba(44,37,30,0.045)",
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", width: "100%" }}>
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={autoResize}
                    onKeyDown={handleKey}
                    rows={1}
                    placeholder="Escreve uma mensagem..."
                    className="composer-textarea"
                    style={{
                      flex: 1,
                      background: "#FFFFFF",
                      border: "1px solid rgba(212,175,55,0.45)",
                      borderRadius: 14,
                      padding: "12px 15px",
                      color: "var(--text-dark)",
                      fontFamily: "'Lato', sans-serif",
                      fontSize: ".9rem",
                      resize: "none",
                      maxHeight: 120,
                      outline: "none",
                      lineHeight: 1.45,
                      boxShadow: "0 8px 20px rgba(44,37,30,0.05)",
                      transition: "all .18s ease",
                    }}
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    className="send-message-button"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "linear-gradient(135deg, var(--accent-gold), #B8912E)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 10px 22px rgba(212,175,55,0.28)",
                      transition: "all 0.2s",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFF"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ═══ MODAL: CRIAR GRUPO ═══ */}
      {isDirectModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44, 37, 30, 0.48)", backdropFilter: "blur(5px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayShow 0.2s ease", padding: 18 }}>
          <div style={{ background: "#FFFDF8", border: "1px solid rgba(212,175,55,0.34)", borderRadius: 18, width: "90%", maxWidth: 480, padding: 28, position: "relative", animation: "contentShow 0.25s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 22px 60px rgba(0,0,0,0.22)" }}>
            <button
              type="button"
              onClick={() => setIsDirectModalOpen(false)}
              className="modal-icon-button"
              aria-label="Fechar"
              style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 10, background: "#FFFFFF", border: "1px solid rgba(44,37,30,0.12)", color: "var(--menu-dark)", cursor: "pointer", fontWeight: 900, boxShadow: "0 6px 14px rgba(44,37,30,0.06)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s ease" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.45rem", fontWeight: 800, color: "var(--menu-dark)", marginBottom: 8, marginTop: 0 }}>
              Nova <span style={{ color: "var(--accent-gold)" }}>Conversa</span>
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: ".84rem", margin: "0 0 20px" }}>Escolhe uma pessoa e começa uma mensagem direta.</p>

            <div className="modal-members-list" style={{ maxHeight: 320, overflowY: "auto", border: "1px solid rgba(44,37,30,0.12)", borderRadius: 14, padding: 8, background: "#F7F1E7" }}>
              {utilizadoresBusca.length === 0 && (
                <p style={{ padding: 14, fontSize: "0.84rem", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>Sem utilizadores disponíveis.</p>
              )}
              {utilizadoresBusca.map(u => {
                const roleInfo = formatUserBadge(u.nome);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => startDirectConversation(u)}
                    className="modal-user-row"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "transparent", border: "1px solid transparent", marginBottom: 4, transition: "all 0.15s", textAlign: "left" }}
                  >
                    {renderConversationIcon(u.nome, false, 30)}
                    <span style={{ flex: 1, fontSize: "0.88rem", color: "var(--text-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 800 }}>{u.nome}</span>
                    <span style={{ fontSize: "0.66rem", fontWeight: 900, color: roleInfo.color, border: `1px solid ${roleInfo.color}`, padding: "2px 6px", borderRadius: 999, textTransform: "uppercase", flexShrink: 0, background: "rgba(255,255,255,0.7)" }}>
                      {roleInfo.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44, 37, 30, 0.48)", backdropFilter: "blur(5px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayShow 0.2s ease", padding: 18 }}>
          <div style={{
            background: "#FFFDF8",
            border: "1px solid rgba(212,175,55,0.34)",
            borderRadius: 20,
            width: "90%",
            maxWidth: 500,
            padding: 30,
            position: "relative",
            animation: "contentShow 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 22px 60px rgba(0,0,0,0.22)",
          }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="modal-icon-button"
              aria-label="Fechar"
              style={{ position: "absolute", top: 18, right: 18, width: 34, height: 34, borderRadius: 10, background: "#FFFFFF", border: "1px solid rgba(44,37,30,0.12)", color: "var(--menu-dark)", cursor: "pointer", fontWeight: 900, boxShadow: "0 6px 14px rgba(44,37,30,0.06)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s ease" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.55rem", fontWeight: 800, color: "var(--menu-dark)", marginBottom: 8, marginTop: 0 }}>
              Criar Novo <span style={{ color: "var(--accent-gold)" }}>Grupo</span>
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: ".84rem", margin: "0 0 22px" }}>Define o nome do grupo e escolhe os membros da academia.</p>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: "0.74rem", color: "var(--menu-dark)", textTransform: "uppercase", fontWeight: 900, display: "block", marginBottom: 7, letterSpacing: ".04em" }}>Nome do Grupo</label>
              <input
                value={nomeNovoGrupo}
                onChange={e => setNomeNovoGrupo(e.target.value)}
                placeholder="Ex: Companhia de Dança Contemporânea"
                style={{ width: "100%", background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.45)", borderRadius: 12, padding: 13, color: "var(--text-dark)", outline: "none", fontSize: "0.9rem", boxShadow: "0 8px 18px rgba(44,37,30,0.04)" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: "0.74rem", color: "var(--menu-dark)", textTransform: "uppercase", fontWeight: 900, display: "block", marginBottom: 7, letterSpacing: ".04em" }}>Selecionar Membros da Academia</label>
              <div className="modal-members-list" style={{ maxHeight: 210, overflowY: "auto", border: "1px solid rgba(44,37,30,0.12)", borderRadius: 14, padding: 8, background: "#F7F1E7" }}>
                {utilizadoresBusca.map(u => {
                  const isSelected = membrosSelecionados.includes(u.id);
                  const roleInfo = formatUserBadge(u.nome);
                  return (
                    <div
                      key={u.id}
                      onClick={() => setMembrosSelecionados(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        background: isSelected ? "#FFFFFF" : "transparent",
                        border: isSelected ? "1px solid rgba(212,175,55,0.48)" : "1px solid transparent",
                        marginBottom: 4,
                        transition: "all 0.15s",
                      }}
                    >
                      {renderConversationIcon(u.nome, false, 30)}
                      <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: "0.88rem", color: "var(--text-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{u.nome}</span>
                        <span style={{ fontSize: "0.66rem", fontWeight: 900, color: roleInfo.color, border: `1px solid ${roleInfo.color}`, padding: "2px 6px", borderRadius: 999, textTransform: "uppercase", flexShrink: 0, marginLeft: 6, background: "rgba(255,255,255,0.7)" }}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="modal-secondary-button"
                style={{ flex: 1, padding: 13, borderRadius: 12, background: "#FFFFFF", border: "1px solid rgba(44,37,30,0.18)", color: "var(--menu-dark)", cursor: "pointer", fontWeight: 900, boxShadow: "0 8px 18px rgba(44,37,30,0.05)", transition: "all .18s ease" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarGrupo}
                disabled={!nomeNovoGrupo || membrosSelecionados.length === 0}
                className="modal-primary-button"
                style={{
                  flex: 1.6,
                  padding: 13,
                  borderRadius: 12,
                  background: (!nomeNovoGrupo || membrosSelecionados.length === 0) ? "#B9AEA0" : "linear-gradient(135deg, #2C251E, #4A3A2A)",
                  border: "none",
                  color: "#FFF",
                  cursor: (!nomeNovoGrupo || membrosSelecionados.length === 0) ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  boxShadow: (!nomeNovoGrupo || membrosSelecionados.length === 0) ? "none" : "0 12px 24px rgba(44,37,30,0.22)",
                  transition: "all 0.18s ease",
                }}
              >
                Criar Grupo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL DETALHES DO GRUPO ═══ */}
      {isEditGroupModalOpen && activeConv && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(44, 37, 30, 0.48)", backdropFilter: "blur(5px)", zIndex: 101, display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayShow 0.2s ease", padding: 18 }}>
          <div style={{ background: "#FFFDF8", border: "1px solid rgba(212,175,55,0.34)", borderRadius: 22, width: "90%", maxWidth: 500, padding: 30, position: "relative", animation: "contentShow 0.25s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 22px 60px rgba(0,0,0,0.22)" }}>

            <button
              type="button"
              onClick={() => setIsEditGroupModalOpen(false)}
              className="modal-icon-button"
              aria-label="Fechar"
              style={{ position: "absolute", top: 18, right: 18, width: 34, height: 34, borderRadius: 10, background: "#FFFFFF", border: "1px solid rgba(44,37,30,0.12)", color: "var(--menu-dark)", cursor: "pointer", fontWeight: 900, boxShadow: "0 6px 14px rgba(44,37,30,0.06)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s ease" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
              {renderConversationIcon(activeConv.nome, true, 46)}
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.35rem", fontWeight: 800, color: "var(--menu-dark)", margin: 0 }}>
                  {activeConv?.nome}
                </h2>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "2px 0 0", fontWeight: 600 }}>Painel informativo do grupo</p>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: "0.74rem", color: "var(--menu-dark)", textTransform: "uppercase", fontWeight: 900, marginBottom: 8, letterSpacing: "0.5px" }}>
                Utilizadores Ativos ({membrosDoGrupoAtivo.length})
              </p>
              <div className="modal-members-list" style={{ maxHeight: 175, overflowY: "auto", border: "1px solid rgba(44,37,30,0.12)", borderRadius: 14, background: "#F7F1E7", padding: 6 }}>
                {membrosDoGrupoAtivo.length === 0 && <p style={{ padding: 15, fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>A carregar lista de membros...</p>}
                {membrosDoGrupoAtivo.map(m => {
                  const roleInfo = formatUserBadge(m.nome);
                  const canManage = canManageActiveGroup();
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 10px", borderRadius: 12, background: "rgba(255,255,255,0.58)", marginBottom: 5, gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
                        {renderConversationIcon(m.nome, false, 30)}
                        <span style={{ fontSize: "0.86rem", color: "var(--text-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{m.nome}</span>
                        <span style={{ fontSize: "0.62rem", fontWeight: 900, color: roleInfo.color, padding: "2px 6px", borderRadius: 999, background: "rgba(255,255,255,0.85)", border: `1px solid ${roleInfo.color}`, textTransform: "uppercase", flexShrink: 0 }}>
                          {roleInfo.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {canStartDirectMessages() && m.id !== currentUserHashId && (
                          <button
                            type="button"
                            onClick={() => startDirectConversationFromMember(m)}
                            style={{ background: "#FFFFFF", border: "1px solid rgba(44,37,30,0.14)", color: "var(--menu-dark)", cursor: "pointer", fontSize: "0.74rem", fontWeight: 900, padding: "6px 9px", borderRadius: 9 }}
                          >
                            Mensagem
                          </button>
                        )}
                        {canManage && m.id !== currentUserHashId && (
                          <button
                            type="button"
                            onClick={() => handleRemoverMembro(m.id)}
                            style={{ background: "#FFF1F1", border: "1px solid #ECAAAA", color: "#C94B4B", cursor: "pointer", fontSize: "0.74rem", fontWeight: 900, padding: "6px 9px", borderRadius: 9 }}
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canManageActiveGroup() && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: "0.74rem", color: "var(--menu-dark)", textTransform: "uppercase", fontWeight: 900, marginBottom: 8, letterSpacing: "0.5px" }}>Convidar Membro para o Grupo</p>
                <select
                  onChange={(e) => { if(e.target.value) handleAdicionarMembro(e.target.value); e.target.value = ""; }}
                  style={{ width: "100%", background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.45)", borderRadius: 12, padding: 12, color: "var(--text-dark)", outline: "none", fontSize: "0.88rem", cursor: "pointer", boxShadow: "0 8px 18px rgba(44,37,30,0.04)" }}
                >
                  <option value="">Escolher utilizador da lista...</option>
                  {utilizadoresBusca.filter(u => !membrosDoGrupoAtivo.find(m => m.id === u.id)).map(u => {
                    const r = formatUserBadge(u.nome);
                    return (
                      <option key={u.id} value={u.id}>
                        {u.nome} ({r.label})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsEditGroupModalOpen(false)}
              className="modal-primary-button"
              style={{ width: "100%", padding: 13, borderRadius: 12, background: "linear-gradient(135deg, #2C251E, #4A3A2A)", border: "none", color: "#FFF", cursor: "pointer", fontWeight: 900, fontSize: "0.9rem", transition: "all 0.18s ease", boxShadow: "0 12px 24px rgba(44,37,30,0.22)" }}
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}

      {/* Alerta de erro Toast */}
      {error && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#FFF5F5", border: "1px solid #ECAAAA", color: "#C94B4B", borderRadius: 10, padding: "12px 20px", fontSize: ".85rem", zIndex: 1000, boxShadow: "0 12px 28px rgba(0,0,0,0.12)" }}>
          {error} <button type="button" onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", color: "#C94B4B", cursor: "pointer", fontWeight: 900 }}>✕</button>
        </div>
      )}
    </>
  );
}
