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

interface NotificacoeDto {
  id: string;
  destinatario: UtilizadoreResumoDto;
  remetente: UtilizadoreResumoDto | null;
  titulo: string;
  mensagem: string;
  tipo: string;
  referenciaId: string;
  lida: boolean;
  criadaEm: string;
}

interface JwtPayload {
  sub: string;  // hash do id
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

function initials(name: string = ""): string {
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

  const [currentUserHashId, setCurrentUserHashId] = useState<string | null>(null);
  const [currentUserType, setCurrentUserType] = useState<number | null>(null);
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

  // Estados para o Modal de Grupo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nomeNovoGrupo, setNomeNovoGrupo] = useState("");
  const [utilizadoresBusca, setUtilizadoresBusca] = useState<UtilizadoreResumoDto[]>([]);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  
  // Estados para GESTÃO de Grupo (Coordenação)
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [membrosDoGrupoAtivo, setMembrosDoGrupoAtivo] = useState<UtilizadoreResumoDto[]>([]);

  //Send Notificações
  const [notificacoes, setNotificacoes] = useState<NotificacoeDto[]>([]);

  // ── Verifica login e lê payload do token ──
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    const payload = getTokenPayload();
    if (!payload) { router.push("/login"); return; }
    
    setCurrentUserHashId(payload.sub);

    // Exemplo de mapeamento:
    if (payload.role === "COORDENACAO") {
      setCurrentUserType(1);
    } else if (payload.role === "PROFESSOR") {
      setCurrentUserType(2);
    } else if (payload.role === "ALUNO"){
      setCurrentUserType(3);
    } else 
      setCurrentUserType(4); //Encarregado
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
    setLoadingMsgs(false);
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

  // ── Gestão de Membros (Load) ──
  const loadMembrosGrupo = async (grupoIdHash: string) => {
    try {
      // 1. Carrega membros atuais do grupo
      const resMembros = await api.get<UtilizadoreResumoDto[]>(`/grupos/${grupoIdHash}/membros`);
      setMembrosDoGrupoAtivo(resMembros.data);

      // 2. Carrega todos os utilizadores disponíveis (se a lista estiver vazia)
      // Isto garante que o <select> tenha dados
      if (utilizadoresBusca.length === 0) {
        const resGeral = await api.get<UtilizadoreResumoDto[]>("/utilizadores/disponiveis-grupo");
        // Filtra o utilizador atual
        const listaFiltrada = resGeral.data.filter(u => u.id !== currentUserHashId);
        setUtilizadoresBusca(listaFiltrada);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do grupo/utilizadores", e);
      setError("Não foi possível carregar a lista de utilizadores.");
    }
};

  // ── Open conversation ──
  function openConversation(preview: MensagenPreviewDto) {
    setActiveConv(preview);
    setMessages([]);       // limpa mensagens anteriores
    setLoadingMsgs(true);  // mostra spinner só na abertura

    setNotificacoes(prev => prev.filter(n => n.referenciaId !== preview.id));

    loadMessages(preview.id);

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => loadMessages(preview.id), 5000);
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // ── Send message ──
  async function sendMessage() {
    const content = inputText.trim();
    if (!content || !activeConv) return;

    // Guardamos o ID atual para garantir que não perdemos o foco
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
        
        // Em vez de recarregar tudo do zero imediatamente, 
        // carregamos apenas as mensagens da conversa que já está aberta
        await loadMessages(currentId);
        
        // O loadPreviews deve vir depois para atualizar a ordem na lateral
        // mas sem resetar o estado do activeConv
        await loadPreviews(); 
    } catch (e: any) {
        setError(`Erro ao enviar: ${e.message}`);
    }
  }

  const fetchNotificacoes = useCallback(async () => {
    if (!currentUserHashId) return;
    try {
      const { data } = await api.get(`/notificacoes/me?userId=${currentUserHashId}&page=0&size=5`);
      setNotificacoes(data.content || []); 
    } catch (err) {
      console.error("Erro ao carregar notificações", err);
    }
  }, [currentUserHashId]);

  // Polling opcional para notificações (ex: a cada 30 segundos)
  useEffect(() => {
    fetchNotificacoes();
    const interval = setInterval(fetchNotificacoes, 30000);
    return () => clearInterval(interval);
  }, [fetchNotificacoes]);

  const clicarNotificacao = async (n: NotificacoeDto) => {
    try {
      // Como o baseURL já tem /api, aqui começamos logo em /notificacoes
      await api.put(`/notificacoes/${n.id}/ler`);

      // Lógica de navegação...
      const conversaExistente = previews.find(p => p.id === n.referenciaId);
      if (conversaExistente) {
        openConversation(conversaExistente);
      } else {
        setActiveConv({
          id: n.referenciaId,
          nome: n.remetente?.nome || "Utilizador",
          conteudo: n.mensagem,
          horas: formatTime(n.criadaEm)
        });
        loadMessages(n.referenciaId);
      }

      // Remove do estado local
      setNotificacoes(prev => prev.filter(notif => notif.id !== n.id));

    } catch (err) {
      console.error("Erro ao marcar notificação como lida:", err);
    }
  };
    

  // ── Adicionar/Remover Membros (Coordenação) ──
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
      // Opcional: recarregar lista de utilizadores disponíveis
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

  // ── Contactar Vendedor (Lógica que recebe dados do Marketplace) ──
  useEffect(() => {
    const vId = searchParams.get("vendedorId");
    const vNome = searchParams.get("nome");

    // Se temos um ID de vendedor na URL e ainda não definimos a conversa ativa
    if (vId && vNome && !activeConv) { 
      
      // 1. Verificamos se já existe uma conversa com ele nos previews carregados
      const conversaExistente = previews.find(p => p.id === vId);

      if (conversaExistente) {
        // Se já existe, usamos a função padrão que já faz load e liga o polling
        openConversation(conversaExistente);
      } else {
        // Se é a primeira vez que falamos com ele
        const novoContexto = {
          id: vId,
          nome: decodeURIComponent(vNome),
          conteudo: "Iniciar nova conversa...",
          horas: ""
        } as MensagenPreviewDto;

        setActiveConv(novoContexto);
        setMessages([]);
        
        // FORÇAR LOAD IMEDIATO das mensagens (caso existam no histórico mas não no preview)
        loadMessages(vId);

        // LIGAR O POLLING IMEDIATAMENTE para esta nova conversa
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(() => loadMessages(vId), 5000);
      }

      // 2. IMPORTANTE: Limpar a URL para o useEffect não correr em loop
      // Isto remove o ?vendedorId=... da barra de endereços sem recarregar a página
      router.replace('/mensagens', { scroll: false });
    }
  }, [searchParams, previews, activeConv, loadMessages, router, openConversation]);

  // Abrir modal e carregar utilizadores que podemos contactar
  async function openCreateGroup() {
    setIsModalOpen(true);
    setError(null); // Limpa erros anteriores
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
      // 1. Fazemos o pedido e capturamos a resposta (que deve trazer o ID hasheado)
      const response = await api.post("/grupos", {
        nome: nomeNovoGrupo,
        membrosIds: membrosSelecionados 
      });

      // Assumindo que o teu backend retorna o ID no corpo da resposta
      // Se o backend retornar apenas String, ajusta para: const grupoId = response.data;
      const grupoId = response.data.id || response.data; 

      // 2. Criamos o preview com o ID REAL (usando o prefixo que o teu front espera)
      const novoGrupoPreview = {
        id: `GRUPO_${grupoId}`, 
        nome: nomeNovoGrupo,
        conteudo: "Grupo criado com sucesso!",
        horas: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
      };

      // 3. Atualiza a lista lateral
      setPreviews(prev => [novoGrupoPreview, ...prev]);

      // 4. Limpa e fecha
      setIsModalOpen(false);
      setNomeNovoGrupo("");
      setMembrosSelecionados([]);
      
      // 5. Sincroniza com o servidor
      loadPreviews();
      
    } catch (e: any) {
      const errorMsg = e.response?.data || "Erro ao criar grupo";
      setError(typeof errorMsg === 'string' ? errorMsg : "Erro de validação no servidor.");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0e0e12; --surface: #16161d; --panel: #1c1c25;
          --border: #2a2a38; --accent: #c8a96e; --accent2: #6e8dc8;
          --text: #e8e6df; --muted: #7a7889;
          --sent-bg: #c8a96e18; --recv-bg: #1f1f2b;
          --sent-bord: #c8a96e55; --recv-bord: #2e2e42;
        }
        html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100% { transform:scale(.6); opacity:.5; } 40% { transform:scale(1); opacity:1; } }
        @keyframes overlayShow { from { opacity: 0; } to { opacity: 1; } }
        @keyframes contentShow { from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      `}</style>

      <div style={{ display: "flex", height: "100dvh", overflow: "hidden" }}>

        {/* ═══ SIDEBAR ═══ */}
        <aside style={{
          width: 320, minWidth: 320, background: "var(--surface)",
          borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "28px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-.02em" }}>
                Mensa<span style={{ color: "var(--accent)" }}>gens</span>
              </h1>
              <p style={{ fontSize:".78rem", color:"var(--muted)", marginTop:3, fontWeight:300 }}>As minhas conversas</p>
            </div>
            
            {/* ═══ Botão criar grupo ═══ */}
            {currentUserType !== 3 && (
              <button 
                onClick={openCreateGroup}
                style={{ 
                  background: "var(--sent-bg)", border: "1px solid var(--sent-bord)", 
                  borderRadius: "50%", width: 36, height: 36, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--accent)", e.currentTarget.style.color = "var(--bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--sent-bg)", e.currentTarget.style.color = "var(--accent)")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            )}
          </div>

          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar conversa…"
              style={{
                width: "100%", background: "var(--panel)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "9px 14px", color: "var(--text)",
                fontFamily: "'DM Sans',sans-serif", fontSize: ".85rem", outline: "none",
              }}
            />
          </div>

          
          {/* LISTA DE NOTIFICAÇÕES RÁPIDAS */}
          {notificacoes.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest px-2">Novas Mensagens</p>
              {notificacoes.map((n) => (
                <div 
                  key={n.id}
                  onClick={() => clicarNotificacao(n)}
                  className="bg-blue-600/20 border border-blue-500/30 p-3 rounded-xl cursor-pointer hover:bg-blue-600/30 transition group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-blue-100">{n.titulo}</span>
                    <span className="text-[10px] text-blue-400">{formatTime(n.criadaEm)}</span>
                  </div>
                  <p className="text-xs text-blue-200/70 truncate">{n.mensagem}</p>
                  
                  {/* Pequeno detalhe visual de "novo" */}
                  <div className="absolute left-0 top-0 w-1 h-full bg-blue-500"></div>
                </div>
              ))}
            </div>
          )}


          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {loadingPrev ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "block", animation: `bounce .9s ease ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            ) : filteredPreviews.length === 0 ? (
              <p style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: ".85rem" }}>Nenhuma conversa encontrada.</p>
            ) : filteredPreviews.map((p) => (
              <div
                key={p.id}
                onClick={() => openConversation(p)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", cursor: "pointer",
                  borderLeft: activeConv?.id === p.id ? "3px solid var(--accent)" : "3px solid transparent",
                  background: activeConv?.id === p.id ? "var(--panel)" : "transparent",
                  transition: "background .15s, border-color .15s",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: p.id.startsWith("GRUPO_") ? "linear-gradient(135deg, #c8a96e, #8b7344)" : "linear-gradient(135deg, var(--accent2), var(--accent))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: ".9rem", color: "var(--bg)",
                }}>
                  {p.id.startsWith("GRUPO_") ? "👥" : initials(p.nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".88rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div>
                  <div style={{ fontSize: ".78rem", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2, fontWeight: 300 }}>{p.conteudo}</div>
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--muted)", flexShrink: 0, fontWeight: 300 }}>{p.horas}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* ═══ CHAT ═══ */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
          {!activeConv ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--muted)" }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".25">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ fontSize: ".9rem", fontWeight: 300 }}>Seleciona uma conversa para começar</p>
            </div>
          ) : (
            <>
              <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: activeConv.id.startsWith("GRUPO_") ? "linear-gradient(135deg, #c8a96e, #8b7344)" : "linear-gradient(135deg, var(--accent2), var(--accent))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: ".82rem", color: "var(--bg)", flexShrink: 0,
                  }}>
                    {activeConv.id.startsWith("GRUPO_") ? "👥" : initials(activeConv.nome)}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: ".98rem", fontWeight: 700, letterSpacing: "-.01em" }}>{activeConv.nome}</div>
                    <div style={{ fontSize: ".73rem", color: "var(--muted)", fontWeight: 300 }}>
                      {activeConv.id.startsWith("GRUPO_") ? "Chat de Grupo" : "Online agora"}
                    </div>
                  </div>
                </div>

                {/* BOTÃO GERIR MEMBROS */}
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
                      background: "var(--sent-bg)", 
                      border: "1px solid var(--sent-bord)", 
                      padding: "8px 16px", 
                      borderRadius: "10px", 
                      color: "var(--accent)", 
                      fontSize: "0.75rem", 
                      cursor: "pointer", 
                      fontWeight: 700,
                      fontFamily: "'Syne', sans-serif",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.filter = "brightness(1.2)"}
                    onMouseOut={(e) => e.currentTarget.style.filter = "brightness(1)"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    Gerir Membros
                  </button>
                )}
              </header>

              {/* MENSAGENS (Bloco Original) */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {loadingMsgs ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "block", animation: `bounce .9s ease ${i * 0.15}s infinite` }} />
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
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0", color: "var(--muted)", fontSize: ".72rem", fontWeight: 300 }}>
                          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                          {date}
                          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexDirection: isSent ? "row-reverse" : "row", animation: "fadeUp .25s ease" }}>
                        {!isSent && (
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg, var(--accent2), var(--accent))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: ".6rem", color: "var(--bg)",
                          }}>
                            {initials(m.remetente.nome)}
                          </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", maxWidth: "62%", alignItems: isSent ? "flex-end" : "flex-start" }}>
                          {!isSent && activeConv.id.startsWith("GRUPO_") && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', marginBottom: 2, marginLeft: 4 }}>{m.remetente.nome}</span>
                          )}
                          <div style={{
                            padding: "10px 14px",
                            borderRadius: isSent ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            fontSize: ".875rem", lineHeight: 1.5, wordBreak: "break-word",
                            background: isSent ? "var(--sent-bg)" : "var(--recv-bg)",
                            border: `1px solid ${isSent ? "var(--sent-bord)" : "var(--recv-bord)"}`,
                            color: isSent ? "#e8dfc8" : "var(--text)",
                          }}>
                            {m.conteudo}
                          </div>
                          <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 3, padding: "0 4px", fontWeight: 300 }}>
                            {formatTime(m.enviadaEm)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT DE TEXTO (Bloco Original) */}
              <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", background: "var(--surface)", display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={autoResize}
                  onKeyDown={handleKey}
                  rows={1}
                  placeholder="Escreve uma mensagem…"
                  style={{
                    flex: 1, background: "var(--panel)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "10px 14px", color: "var(--text)",
                    fontFamily: "'DM Sans',sans-serif", fontSize: ".875rem",
                    resize: "none", maxHeight: 120, outline: "none", lineHeight: 1.5,
                  }}
                />
                <button onClick={sendMessage} style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--accent)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--bg)"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </button>
              </div>
            </>
          )}
        </main>

        {/* ═══ MODAL CRIAR GRUPO (Original) ═══ */}
        {isModalOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "overlayShow 0.3s ease" }}>
            <div style={{ 
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, 
              width: "90%", maxWidth: 450, padding: 32, position: "relative", animation: "contentShow 0.4s ease" 
            }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.5rem", marginBottom: 24 }}>Criar Novo <span style={{ color: "var(--accent)" }}>Grupo</span></h2>
              
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Nome do Grupo</label>
                <input 
                  value={nomeNovoGrupo} onChange={e => setNomeNovoGrupo(e.target.value)}
                  placeholder="Ex: Alunos de Artes"
                  style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, color: "var(--text)", outline: "none" }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Selecionar Membros</label>
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, padding: 8, background: "var(--panel)" }}>
                  {utilizadoresBusca.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => setMembrosSelecionados(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      style={{ 
                        padding: "10px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                        background: membrosSelecionados.includes(u.id) ? "var(--sent-bg)" : "transparent",
                        border: membrosSelecionados.includes(u.id) ? "1px solid var(--accent)" : "1px solid transparent",
                        marginBottom: 4, transition: "all 0.2s"
                      }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>{initials(u.nome)}</div>
                      <span style={{ fontSize: "0.85rem" }}>{u.nome}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: 14, borderRadius: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                <button 
                  onClick={handleCriarGrupo}
                  disabled={!nomeNovoGrupo || membrosSelecionados.length === 0}
                  style={{ flex: 2, padding: 14, borderRadius: 12, background: "var(--accent)", border: "none", color: "var(--bg)", cursor: "pointer", fontWeight: 800, opacity: (!nomeNovoGrupo || membrosSelecionados.length === 0) ? 0.5 : 1 }}
                >Criar Grupo</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL GERIR GRUPO ═══ */}
        {isEditGroupModalOpen && activeConv && ( // Adicionada verificação de activeConv aqui
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 101, animation: "overlayShow 0.3s ease" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, width: "90%", maxWidth: 450, padding: 32, animation: "contentShow 0.4s ease" }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.3rem", marginBottom: 20 }}>
                Gerir Membros: <span style={{ color: "var(--accent)" }}>{activeConv?.nome}</span> {/* Adicionado o ? aqui */}
              </h2>
              
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", marginBottom: 10 }}>Membros Atuais</p>
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel)" }}>
                  {membrosDoGrupoAtivo.length === 0 && <p style={{ padding: 15, fontSize: "0.8rem", color: "var(--muted)" }}>Nenhum membro carregado.</p>}
                  {membrosDoGrupoAtivo.map(m => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: "0.85rem" }}>{m.nome}</span>
                      <button 
                        onClick={() => handleRemoverMembro(m.id)}
                        style={{ background: "none", border: "none", color: "#e07070", cursor: "pointer", fontSize: "0.75rem" }}
                      >Remover</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", marginBottom: 10 }}>Adicionar Utilizador</p>
                <select 
                  onChange={(e) => { if(e.target.value) handleAdicionarMembro(e.target.value); e.target.value = ""; }}
                  style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, color: "var(--text)", outline: "none" }}
                >
                  <option value="">Selecione para adicionar...</option>
                  {utilizadoresBusca.filter(u => !membrosDoGrupoAtivo.find(m => m.id === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={() => setIsEditGroupModalOpen(false)} 
                style={{ width: "100%", padding: 14, borderRadius: 12, background: "var(--accent)", border: "none", color: "var(--bg)", cursor: "pointer", fontWeight: 800 }}
              >Fechar</button>
            </div>
          </div>
        )}

        {/* Alerta de erro */}
        {error && (
          <div style={{ position: "fixed", bottom: 20, right: 20, background: "#e0707018", border: "1px solid #e0707040", color: "#e07070", borderRadius: 8, padding: "10px 16px", fontSize: ".8rem", zIndex: 1000 }}>
            {error} <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", color: "#e07070", cursor: "pointer" }}>✕</button>
          </div>
        )}
      </div>
    </>
  );
}