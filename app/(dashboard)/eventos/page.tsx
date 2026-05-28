"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface Participante {
  nome: string;
  email?: string;
  pago: boolean;
  cancelado: boolean;
}

interface Evento {
  id: string; 
  nome: string;
  descricao: string;
  dataEvento: string;
  horaInicio: string;
  horaFim: string;
  local: string;
  numInscritos: string;      // Mapeado do campo numInscritos do EventoDto (backend)
  maxParticipantes: string;  // Lotação máxima vinda do backend
  preco?: number;            // Preço de inscrição (adicionar ao EventoDto no backend)
  estadoId?: number;         // ⚠️ REQUER: adicionar estadoId ao EventoDto no backend (ver instrução abaixo)
}

export default function EventosPage() {
    const router = useRouter();

    // ── ESTADOS DOS EVENTOS E INSCRIÇÕES ──
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [meusEventosIds, setMeusEventosIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroMeus, setFiltroMeus] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
    const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

    // ── ESTADOS DE CONTROLO DE ACESSO E GESTÃO ──
    const [role, setRole] = useState<Role | null>(null);
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Controlo do modal de visualização de participantes por evento
    const [participantesModal, setParticipantesModal] = useState<{ aberto: boolean; lista: Participante[]; nomeEvento: string }>({
        aberto: false,
        lista: [],
        nomeEvento: ""
    });
    
    const [novoEvento, setNovoEvento] = useState({
        nome: '',
        descricao: '',
        dataEvento: '',
        horaInicio: '',
        horaFim: '',
        local: '',
        preco: 0,
        maxParticipantes: 0
    });

    // Sincronização e Leitura do utilizador do localStorage para validação de Role
    useEffect(() => {
        const raw = localStorage.getItem("user");
        if (!raw) {
            router.push('/');
            return;
        }
        try {
            const parsed = JSON.parse(raw);

            // Normaliza o role: aceita string direta em "role" ou "tipoUtilizadorId"
            const rolesValidas: Role[] = ["ALUNO", "COORDENACAO", "PROFESSOR", "ENCARREGADO"];
            const rawRole = parsed.role || parsed.tipoUtilizadorId;
            const userRole: Role | null = rolesValidas.includes(rawRole) ? rawRole as Role : null;

            setRole(userRole);
            if (parsed.nome) {
                setUsuarioLogado((prev: any) => ({ ...prev, nome: parsed.nome }));
            }
        } catch {
            router.push('/');
            return;
        }
        setCheckingAccess(false);
    }, [router]);

    // Identificar o utilizador logado através do token
    useEffect(() => {
        const carregarPerfil = () => {
            try {
                const token = localStorage.getItem("token");
                if (token) {
                    if (token === "mocked_jwt_token_for_testing") {
                        setUsuarioLogado((prev: any) => ({ ...prev, id: "1" }));
                        return;
                    }
                    const payload = JSON.parse(atob(token.split(".")[1]));
                    setUsuarioLogado((prev: any) => ({ ...prev, id: payload.sub }));
                }
            } catch (err) {
                console.error("Erro ao identificar utilizador", err);
                setUsuarioLogado((prev: any) => ({ ...prev, id: "1" }));
            }
        };
        carregarPerfil();
    }, []);

    // Carregar todos os eventos do sistema
    const carregarEventos = async () => {
        setLoading(true);
        try {
            const response = await api.get<Evento[]>("/eventos");
            setEventos(response.data);
        } catch (error) {
            console.error("Erro ao carregar eventos:", error);
            setEventos([
                { id: "1", nome: "Gala de Ballet Clássico", descricao: "O espetáculo anual da escola EntArtes com coreografias exclusivas.", dataEvento: "2026-06-15", horaInicio: "19:30:00", horaFim: "21:30:00", local: "Grande Auditório", maxParticipantes: "50", numInscritos: "12", estadoId: 3 },
                { id: "2", nome: "Workshop de Contemporâneo", descricao: "Sessão intensiva focada em expressão corporal e técnicas modernas.", dataEvento: "2026-07-02", horaInicio: "14:00:00", horaFim: "17:00:00", local: "Estúdio Principal", maxParticipantes: "30", numInscritos: "5", estadoId: 3 }
            ]);
        } finally {
            setLoading(false);
        }
    };

    // Carregar as inscrições do utilizador logado (Alunos)
    const carregarInscricoes = async () => {
        if (!usuarioLogado?.id || role === "COORDENACAO") return;
        try {
            const response = await api.get<Evento[]>(`/eventos/utilizador/${usuarioLogado.id}`);
            setMeusEventosIds(response.data.map(e => e.id));
        } catch (error) {
            console.error("Erro ao carregar inscrições:", error);
        }
    };

    useEffect(() => {
        carregarEventos();
    }, []);

    useEffect(() => {
        if (usuarioLogado?.id && role) carregarInscricoes();
    }, [usuarioLogado, role]);

    // ── LÓGICA DE UTILIZADOR: Inscrição e Cancelamento ──
    const handleInscrever = async (eventoId: string) => {
        try {
            // Ajustado para o teu endpoint correto: POST /api/eventos/{eventoId}/inscrever?utilizadorId={id}
            await api.post(`/eventos/${eventoId}/inscrever?utilizadorId=${usuarioLogado.id}`); 
            toast.success("Inscrição realizada com sucesso!");
            
            // Incrementa o contador visualmente sem precisar dar reload total
            setEventos(prev => prev.map(ev => {
                if (ev.id === eventoId) {
                    return { ...ev, numInscritos: String(Number(ev.numInscritos) + 1) };
                }
                return ev;
            }));

            carregarInscricoes();
        } catch (err: any) {
            toast.error("Erro ao processar inscrição.");
        }
    };

    const handleCancelar = async (eventoId: string) => {
        if (!confirm("Tem a certeza que deseja cancelar a sua inscrição?")) return;
        try {
            // Conetado ao teu @PatchMapping("/{id}/participantes/{utilizadorId}/cancelar")
            await api.patch(`/eventos/${eventoId}/participantes/${usuarioLogado.id}/cancelar`);
            toast.success("Inscrição cancelada com sucesso.");
            
            // Decrementa o contador visualmente
            setEventos(prev => prev.map(ev => {
                if (ev.id === eventoId) {
                    return { ...ev, numInscritos: String(Math.max(0, Number(ev.numInscritos) - 1)) };
                }
                return ev;
            }));

            carregarInscricoes();
        } catch (err) {
            toast.error("Erro ao cancelar inscrição.");
        }
    };

    // ── LÓGICA DE ADMINISTRAÇÃO ──
    const handleCriar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/eventos', novoEvento);
            toast.success("Evento registado com sucesso.");
            setShowModal(false);
            carregarEventos();
        } catch (err) {
            toast.error("Erro ao criar o evento.");
        }
    };

    const handleEliminar = async (id: string) => {
        if (!confirm("Confirmar a eliminação permanente deste evento?")) return;
        try {
            // Conetado ao teu @DeleteMapping("/{id}")
            await api.delete(`/eventos/${id}`);
            toast.success("Evento removido com sucesso.");
            setEventos(prev => prev.filter((ev) => ev.id !== id));
        } catch (err) {
            toast.error("Erro ao eliminar o registo na base de dados.");
        }
    };

    const handleAlterarEstado = async (id: string, estadoId: number) => {
        try {
            // Conetado ao teu @PatchMapping("/{id}/estado/{novoEstadoId}")
            await api.patch(`/eventos/${id}/estado/${estadoId}`);
            toast.success("Estado do evento atualizado.");
            setEventos(prev => prev.map(ev => ev.id === id ? { ...ev, estadoId } : ev));
        } catch (err) {
            toast.error("Não foi possível alterar o estado do evento.");
        }
    };

    const handleVerParticipantes = async (evento: Evento) => {
        try {
            // Conetado ao teu @GetMapping("/{id}/participantes")
            const response = await api.get<Participante[]>(`/eventos/${evento.id}/participantes`);
            
            // Filtra os participantes para não exibir na lista os que já foram cancelados
            const ativos = response.data.filter(p => !p.cancelado);

            setParticipantesModal({
                aberto: true,
                lista: response.data, // Mantém todos ou ativos conforme preferires exibir
                nomeEvento: evento.nome
            });

            // Aproveita e atualiza a contagem na tabela com o dado fresquinho da BD
            setEventos(prev => prev.map(ev => 
                ev.id === evento.id ? { ...ev, numInscritos: String(ativos.length) } : ev
            ));

        } catch (err) {
            toast.error("Não foi possível carregar a lista de participantes.");
        }
    };

    if (checkingAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-2 border-[#4a3f35] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const ehAdministrador = role === "COORDENACAO";
    const eventosExibidos = filtroMeus 
        ? eventos.filter(e => meusEventosIds.includes(e.id))
        : eventos;

    return (
        <main className="flex-1 overflow-y-auto p-6 text-[#2d2722] selection:bg-[#4a3f35] selection:text-white">
            <div className="max-w-7xl mx-auto">
                
                {/* Header Dinâmico */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b-2 border-[#e6e1d6]">
                    <div>
                        <span className="text-[11px] uppercase tracking-widest text-[#8c8275] font-semibold block mb-1">
                            {ehAdministrador ? "Gestão Interna" : "Comunidade"}
                        </span>
                        <h1 className="text-3xl font-serif text-[#2d2722]">
                            {ehAdministrador ? "Administração de Eventos" : "Eventos"}
                        </h1>
                        <p className="text-[#6b6155] text-sm mt-1">
                            {ehAdministrador 
                                ? "Crie, edite, elimine e monitorize a adesão aos eventos da escola." 
                                : "Descobre os nossos workshops, exposições e datas especiais."}
                        </p>
                    </div>
                    
                    <div className="flex gap-2">
                        {ehAdministrador ? (
                            <button 
                                onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#2d2722] text-[#d4b288] hover:bg-[#3d332a] rounded-xl text-xs font-bold transition-all shadow-xs"
                            >
                                <i className="ti ti-plus" /> Criar Novo Evento
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={() => setFiltroMeus(false)}
                                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${
                                        !filtroMeus 
                                            ? "bg-[#4a3f35] text-[#f4f1ea] border-[#4a3f35]" 
                                            : "bg-white text-[#6b6155] border-[#e6e1d6] hover:bg-[#faf9f6]"
                                    }`}
                                >
                                    Todos os Eventos
                                </button>
                                <button 
                                    onClick={() => setFiltroMeus(true)}
                                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${
                                        filtroMeus 
                                            ? "bg-[#4a3f35] text-[#f4f1ea] border-[#4a3f35]" 
                                            : "bg-white text-[#6b6155] border-[#e6e1d6] hover:bg-[#faf9f6]"
                                    }`}
                                >
                                    Inscrições Ativas
                                </button>
                            </>
                        )}
                    </div>
                </header>

                {/* Listagem Geral */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-3">
                        <div className="w-8 h-8 border-2 border-[#4a3f35] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[#8c8275] text-xs font-medium italic">A carregar dados do sistema...</span>
                    </div>
                ) : eventosExibidos.length === 0 ? (
                    <div className="bg-white border border-[#e6e1d6] rounded-2xl p-12 text-center text-[#8c8275] text-sm">
                        Nenhum evento agendado ou registado no sistema.
                    </div>
                ) : ehAdministrador ? (
                    
                    /* ═══════════════════════════════════════
                       VISTA DE ADMINISTRAÇÃO (TABELA DE GESTÃO)
                       ═══════════════════════════════════════ */
                    <div className="bg-white border border-[#e6e1d6] rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <span className="text-xs font-bold text-[#2d2722] uppercase tracking-wider">Eventos Ativos no Sistema</span>
                            <div className="text-[11px] text-[#8c8275]">
                                Total: <span className="font-bold text-[#2d2722]">{eventos.length} registos</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="bg-[#FBF7F2] border-b border-[#e6e1d6] text-[#2d2722] font-semibold uppercase tracking-wider text-[10px]">
                                        <th className="p-4 w-1/3">Evento / Localização</th>
                                        <th className="p-4 w-1/4">Data e Horário</th>
                                        <th className="p-4 w-32 text-center">Lotação</th>
                                        <th className="p-4 w-40 text-center">Estado</th>
                                        <th className="p-4 w-48 text-right">Ações de Gestão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e6e1d6]/40 text-[#2d2722]">
                                    {eventosExibidos.map((ev) => {
                                        return (
                                            <tr key={ev.id} className="hover:bg-[#FFFCF8] transition-colors">
                                                <td className="p-4">
                                                    <div className="font-semibold text-[13px]">{ev.nome}</div>
                                                    <div className="text-[#8c8275] text-[11px] font-light mt-0.5">📍 {ev.local}</div>
                                                </td>
                                                <td className="p-4 font-light text-[#6b6155]">
                                                    <div className="font-medium text-[#2d2722]">{ev.dataEvento}</div>
                                                    <div className="text-[11px] mt-0.5 text-[#8c8275]">
                                                        {ev.horaInicio?.slice(0, 5)} - {ev.horaFim?.slice(0, 5)}
                                                    </div>
                                                </td>
                                                {/* LOTAÇÃO REAL MAPEADA DIRETAMENTE DA PROPRIEDADE DO BACKEND */}
                                                <td className="p-4 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 bg-[#f4f1ea] border border-[#e6e1d6] px-2.5 py-1 rounded-md text-xs font-medium">
                                                        <span className="text-[#2d2722] font-bold">{ev.numInscritos || "0"}</span>
                                                        <span className="text-[#8c8275] font-light">/</span>
                                                        <span className="text-[#8c8275] font-light">{ev.maxParticipantes || "—"}</span>
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <select 
                                                        className="bg-[#FFFCF8] border border-[#e6e1d6] rounded-md px-2 py-1.5 text-[11px] font-medium text-[#2d2722] outline-none focus:border-[#8c8275] transition-all cursor-pointer shadow-xs"
                                                        onChange={(e) => handleAlterarEstado(ev.id, Number(e.target.value))}
                                                        value={ev.estadoId ?? 3} // Por padrão o vosso service cria no ID 3 (pelo estadoAulaRepository.findById(3))
                                                    >
                                                        <option value="1">⏳ Agendado</option>
                                                        <option value="2">✓ Concluído</option>
                                                        <option value="3">✕ Cancelado / Criado</option>
                                                    </select>
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-right">
                                                    <div className="inline-flex gap-1.5">
                                                        <button 
                                                            onClick={() => handleVerParticipantes(ev)}
                                                            className="px-3 py-1.5 text-[11px] font-medium border border-[#e6e1d6] bg-white text-[#2d2722] hover:bg-[#2d2722] hover:text-[#d4b288] rounded-md transition-colors shadow-xs"
                                                        >
                                                            Participantes
                                                        </button>
                                                        <button 
                                                            onClick={() => handleEliminar(ev.id)}
                                                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-md border border-red-100 transition-colors shadow-xs"
                                                            title="Eliminar Evento"
                                                        >
                                                            <i className="ti ti-trash text-sm" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (

                    /* ═══════════════════════════════════════
                       VISTA DE UTILIZADOR COMUM (CARDS)
                       ═══════════════════════════════════════ */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {eventosExibidos.map((evento) => {
                            const estaInscrito = meusEventosIds.includes(evento.id);
                            const data = new Date(evento.dataEvento);
                            
                            return (
                                <div key={evento.id} className="bg-white border border-[#e6e1d6] rounded-2xl p-6 flex flex-col hover:shadow-sm transition-all duration-300">
                                    
                                    <div className="flex items-start gap-4 mb-5">
                                        <div className="bg-[#4a3f35] text-[#f4f1ea] w-12 h-14 rounded-xl flex flex-col items-center justify-center shrink-0">
                                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                                                {isNaN(data.getTime()) ? "EVE" : data.toLocaleDateString("pt", { month: "short" }).replace(".", "")}
                                            </span>
                                            <span className="text-lg font-serif font-bold leading-none mt-0.5">
                                                {isNaN(data.getTime()) ? "•" : data.getDate()}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-serif font-bold text-base text-[#2d2722] leading-snug line-clamp-1">{evento.nome}</h3>
                                            <span className="text-xs text-[#8c8275] mt-1 block">📍 {evento.local}</span>
                                            <span className="text-xs text-[#8c8275] mt-0.5 block">
                                                {evento.preco != null ? (evento.preco === 0 ? "🎟 Entrada gratuita" : `🎟 ${evento.preco.toFixed(2)} €`) : ""}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-[#6b6155] text-xs leading-relaxed line-clamp-3 mb-6 min-h-[54px]">
                                        {evento.descricao}
                                    </p>

                                    <div className="flex gap-2 mt-auto pt-2 border-t border-[#f4f1ea]">
                                        <button 
                                            onClick={() => setEventoSelecionado(evento)}
                                            className="flex-1 bg-[#faf9f6] border border-[#e6e1d6] text-[#2d2722] hover:bg-[#f4f1ea] py-2.5 rounded-xl text-xs font-bold transition"
                                        >
                                            Ver Detalhes
                                        </button>

                                        {estaInscrito ? (
                                            <button 
                                                onClick={() => handleCancelar(evento.id)}
                                                className="flex-1 bg-[#fff5f5] text-red-600 border border-red-200 hover:bg-red-600 hover:text-white py-2.5 rounded-xl text-xs font-bold transition"
                                            >
                                                Cancelar
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleInscrever(evento.id)}
                                                className="flex-1 bg-[#4a3f35] hover:bg-[#382f27] text-white py-2.5 rounded-xl text-xs font-bold transition"
                                            >
                                                Inscrever
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── MODAL DE DETALHES (Utilizador Comum) ─── */}
            {eventoSelecionado && !ehAdministrador && (
                <div className="fixed inset-0 bg-[#2d2722]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-[#e6e1d6] w-full max-w-lg rounded-2xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="inline-block px-2.5 py-0.5 bg-[#f4f1ea] border border-[#e6e1d6] text-[#6b6155] rounded-full text-[9px] font-bold tracking-wider uppercase mb-2">
                                        Evento Cultural
                                    </div>
                                    <h2 className="text-2xl font-serif font-bold text-[#2d2722]">{eventoSelecionado.nome}</h2>
                                </div>
                                <button 
                                    onClick={() => setEventoSelecionado(null)}
                                    className="bg-[#faf9f6] border border-[#e6e1d6] hover:bg-[#f4f1ea] w-8 h-8 rounded-full flex items-center justify-center transition text-xs text-[#6b6155]"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-5 mb-8">
                                <p className="text-[#6b6155] leading-relaxed text-xs">
                                    {eventoSelecionado.descricao}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-[#faf9f6] border border-[#e6e1d6] p-3 rounded-xl">
                                        <span className="text-[#8c8275] text-[9px] font-bold uppercase tracking-wider block mb-0.5">Localização</span>
                                        <span className="text-xs font-semibold text-[#2d2722]">{eventoSelecionado.local}</span>
                                    </div>
                                    <div className="bg-[#faf9f6] border border-[#e6e1d6] p-3 rounded-xl">
                                        <span className="text-[#8c8275] text-[9px] font-bold uppercase tracking-wider block mb-0.5">Horário</span>
                                        <span className="text-xs font-semibold text-[#2d2722]">{eventoSelecionado.horaInicio} - {eventoSelecionado.horaFim}</span>
                                    </div>
                                </div>
                            </div>

                            {!meusEventosIds.includes(eventoSelecionado.id) ? (
                                <button 
                                    onClick={() => { handleInscrever(eventoSelecionado.id); setEventoSelecionado(null); }}
                                    className="w-full bg-[#4a3f35] hover:bg-[#382f27] py-3 rounded-xl font-bold text-white text-xs transition"
                                >
                                    Confirmar Inscrição
                                </button>
                            ) : (
                                <div className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-center font-bold text-xs">
                                    ✓ Já estás inscrito neste evento
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL DE LISTAGEM DE PARTICIPANTES (Apenas Admin) ─── */}
            {participantesModal.aberto && ehAdministrador && (
                <div className="fixed inset-0 bg-[#2d2722]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-[#e6e1d6] w-full max-w-md rounded-2xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <div>
                                <h2 className="text-sm font-serif font-bold text-[#2d2722]">Alunos Inscritos</h2>
                                <p className="text-[11px] text-[#8c8275] line-clamp-1 mt-0.5">{participantesModal.nomeEvento}</p>
                            </div>
                            <button 
                                onClick={() => setParticipantesModal({ aberto: false, lista: [], nomeEvento: "" })} 
                                className="bg-[#faf9f6] border border-[#e6e1d6] hover:bg-[#f4f1ea] w-7 h-7 rounded-full flex items-center justify-center transition text-xs text-[#6b6155]"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 max-h-72 overflow-y-auto divide-y divide-[#e6e1d6]/30">
                            {participantesModal.lista.length === 0 ? (
                                <p className="text-center text-xs text-[#8c8275] italic py-8">Nenhum aluno inscrito até ao momento.</p>
                            ) : (
                                participantesModal.lista.map((aluno, idx) => (
                                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 bg-[#f4f1ea] text-[#4a3f35] font-bold rounded-full flex items-center justify-center text-[10px]">
                                                {aluno.nome ? aluno.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "??"}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[#2d2722]">
                                                    {aluno.nome} 
                                                    {aluno.cancelado && <span className="text-red-500 font-normal text-[10px] ml-1.5">(Cancelado)</span>}
                                                </div>
                                                {aluno.email && <div className="text-[10px] text-[#8c8275]">{aluno.email}</div>}
                                            </div>
                                        </div>
                                        {/* Tag Visual mostrando se já efetuou o pagamento */}
                                        <div>
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${aluno.pago ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                {aluno.pago ? "Pago" : "Pendente"}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-3 bg-[#FBF7F2] border-t border-[#e6e1d6] text-right">
                            <button 
                                onClick={() => setParticipantesModal({ aberto: false, lista: [], nomeEvento: "" })}
                                className="px-4 py-2 bg-[#2d2722] text-white text-[11px] font-bold rounded-lg hover:bg-[#382f27] transition"
                            >
                                Fechar Lista
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL DE CONFIGURAÇÃO DE NOVO EVENTO (Apenas Admin) ─── */}
            {showModal && ehAdministrador && (
                <div className="fixed inset-0 bg-[#2d2722]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-[#e6e1d6] w-full max-w-xl rounded-2xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <h2 className="text-lg font-serif font-bold text-[#2d2722]">Configuração de Novo Evento</h2>
                            <button onClick={() => setShowModal(false)} className="bg-[#faf9f6] border border-[#e6e1d6] hover:bg-[#f4f1ea] w-8 h-8 rounded-full flex items-center justify-center transition text-xs text-[#6b6155]">✕</button>
                        </div>

                        <form onSubmit={handleCriar} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Nome do Evento</label>
                                <input type="text" placeholder="Ex: Gala de Ballet Clássico" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl focus:border-[#8c8275] outline-none text-xs text-[#2d2722]" 
                                       onChange={(e) => setNovoEvento({...novoEvento, nome: e.target.value})} required />
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Descrição do Evento</label>
                                <textarea placeholder="Insira os detalhes e objetivos do evento..." className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl h-24 focus:border-[#8c8275] outline-none text-xs text-[#2d2722] resize-none"
                                          onChange={(e) => setNovoEvento({...novoEvento, descricao: e.target.value})} required />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Data do Evento</label>
                                    <input type="date" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl focus:border-[#8c8275] outline-none text-xs text-[#6b6155]"
                                           onChange={(e) => setNovoEvento({...novoEvento, dataEvento: e.target.value})} required />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Horário (Início / Fim)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="time" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl focus:border-[#8c8275] outline-none text-xs text-[#6b6155]"
                                               onChange={(e) => setNovoEvento({...novoEvento, horaInicio: e.target.value + ":00"})} required />
                                        <input type="time" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl focus:border-[#8c8275] outline-none text-xs text-[#6b6155]"
                                               onChange={(e) => setNovoEvento({...novoEvento, horaFim: e.target.value + ":00"})} required />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Localização dentro da Escola</label>
                                <input type="text" placeholder="Ex: Grande Auditório / Estúdio Principal" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl focus:border-[#8c8275] outline-none text-xs text-[#2d2722]"
                                       onChange={(e) => setNovoEvento({...novoEvento, local: e.target.value})} required />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Preço de Inscrição (€)</label>
                                    <input type="number" placeholder="0.00" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl focus:border-[#8c8275] outline-none text-xs text-[#2d2722]"
                                           onChange={(e) => setNovoEvento({...novoEvento, preco: Number(e.target.value)})} required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Lotação Máxima (Alunos)</label>
                                    <input type="number" placeholder="Ex: 30" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-xl focus:border-[#8c8275] outline-none text-xs text-[#2d2722]"
                                           onChange={(e) => setNovoEvento({...novoEvento, maxParticipantes: Number(e.target.value)})} required />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-[#e6e1d6]/60">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#e6e1d6] text-[#6b6155] p-2.5 rounded-xl text-xs font-bold hover:bg-[#faf9f6] transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 bg-[#4a3f35] text-white p-2.5 rounded-xl text-xs font-bold hover:bg-[#382f27] transition-colors shadow-xs">Gravar Evento</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}