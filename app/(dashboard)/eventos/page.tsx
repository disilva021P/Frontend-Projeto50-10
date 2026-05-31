"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface Participante {
  utilizadorNome: string;
  utilizadorEmail?: string;
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
  numInscritos: string;
  maxParticipantes: string;
  preco?: number;
  estadoId?: number;
}

export default function EventosPage() {
    const router = useRouter();

    const [eventos, setEventos] = useState<Evento[]>([]);
    const [meusEventosIds, setMeusEventosIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroMeus, setFiltroMeus] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
    const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

    const [role, setRole] = useState<Role | null>(null);
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // ── ESTADO PARA EDIÇÃO ──
    const [showEditModal, setShowEditModal] = useState(false);
    const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);
    const [editForm, setEditForm] = useState({
        nome: '',
        descricao: '',
        dataEvento: '',
        horaInicio: '',
        horaFim: '',
        local: '',
        preco: 0,
        maxParticipantes: 0
    });
    
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

    useEffect(() => {
        const raw = localStorage.getItem("user");
        if (!raw) { router.push('/'); return; }
        try {
            const parsed = JSON.parse(raw);
            const rolesValidas: Role[] = ["ALUNO", "COORDENACAO", "PROFESSOR", "ENCARREGADO"];
            const rawRole = parsed.role || parsed.tipoUtilizadorId;
            const userRole: Role | null = rolesValidas.includes(rawRole) ? rawRole as Role : null;
            setRole(userRole);
            if (parsed.nome) setUsuarioLogado((prev: any) => ({ ...prev, nome: parsed.nome }));
        } catch { router.push('/'); return; }
        setCheckingAccess(false);
    }, [router]);

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
                setUsuarioLogado((prev: any) => ({ ...prev, id: "1" }));
            }
        };
        carregarPerfil();
    }, []);

    const carregarEventos = async () => {
        setLoading(true);
        try {
            const response = await api.get<Evento[]>("/eventos");
            setEventos(response.data);
        } catch (error) {
            setEventos([
                { id: "1", nome: "Gala de Ballet Clássico", descricao: "O espetáculo anual da escola EntArtes.", dataEvento: "2026-06-15", horaInicio: "19:30:00", horaFim: "21:30:00", local: "Grande Auditório", maxParticipantes: "50", numInscritos: "12", estadoId: 1 },
                { id: "2", nome: "Workshop de Contemporâneo", descricao: "Sessão intensiva focada em expressão corporal.", dataEvento: "2026-07-02", horaInicio: "14:00:00", horaFim: "17:00:00", local: "Estúdio Principal", maxParticipantes: "30", numInscritos: "5", estadoId: 1 }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const carregarInscricoes = async () => {
        if (!usuarioLogado?.id || role === "COORDENACAO") return;
        try {
            const response = await api.get<Evento[]>(`/eventos/utilizador/${usuarioLogado.id}`);
            setMeusEventosIds(response.data.map(e => e.id));
        } catch (error) {}
    };

    useEffect(() => { carregarEventos(); }, []);
    useEffect(() => { if (usuarioLogado?.id && role) carregarInscricoes(); }, [usuarioLogado, role]);

    const handleInscrever = async (eventoId: string) => {
        try {
            await api.post(`/eventos/${eventoId}/inscrever?utilizadorId=${usuarioLogado.id}&pago=true`);
            toast.success("Inscreveu-se no evento!");
            setEventos(prev => prev.map(ev =>
                ev.id === eventoId
                    ? { ...ev, numInscritos: String(Number(ev.numInscritos) + 1) }
                    : ev
            ));
            // Fecha o modal de detalhes se o evento ficou cheio
            setEventoSelecionado(null);
            carregarInscricoes();
        } catch (err: any) {
            toast.error("Erro ao processar inscrição.");
        }
    };

    const handleCancelar = async (eventoId: string) => {
        if (!confirm("Tem a certeza que deseja cancelar a sua inscrição?")) return;
        try {
            await api.patch(`/eventos/${eventoId}/participantes/${usuarioLogado.id}/cancelar`);
            toast.success("Inscrição cancelada com sucesso.");
            setEventos(prev => prev.map(ev => ev.id === eventoId ? { ...ev, numInscritos: String(Math.max(0, Number(ev.numInscritos) - 1)) } : ev));
            carregarInscricoes();
        } catch (err) {
            toast.error("Erro ao cancelar inscrição.");
        }
    };

    const handleCriar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/eventos', novoEvento);
            toast.success("Evento registado com sucesso.");
            setShowModal(false);
            setNovoEvento({ nome: '', descricao: '', dataEvento: '', horaInicio: '', horaFim: '', local: '', preco: 0, maxParticipantes: 0 });
            carregarEventos();
        } catch (err) {
            toast.error("Erro ao criar o evento.");
        }
    };

    const handleEliminar = async (id: string) => {
        if (!confirm("Confirmar a eliminação permanente deste evento?")) return;
        try {
            await api.delete(`/eventos/${id}`);
            toast.success("Evento removido com sucesso.");
            setEventos(prev => prev.filter((ev) => ev.id !== id));
        } catch (err) {
            toast.error("Erro ao eliminar o registo na base de dados.");
        }
    };

    const handleAlterarEstado = async (id: string, estadoId: number) => {
        try {
            await api.patch(`/eventos/${id}/estado/${estadoId}`);
            toast.success("Estado do evento atualizado.");
            setEventos(prev => prev.map(ev => ev.id === id ? { ...ev, estadoId } : ev));
        } catch (err) {
            toast.error("Não foi possível alterar o estado do evento.");
        }
    };

    const handleVerParticipantes = async (evento: Evento) => {
        try {
            const response = await api.get<Participante[]>(`/eventos/${evento.id}/participantes`);
            const ativos = response.data.filter(p => !p.cancelado);
            setParticipantesModal({ aberto: true, lista: response.data, nomeEvento: evento.nome });
            setEventos(prev => prev.map(ev => ev.id === evento.id ? { ...ev, numInscritos: String(ativos.length) } : ev));
        } catch (err) {
            toast.error("Não foi possível carregar a lista de participantes.");
        }
    };

    // ── FUNÇÕES DE EDIÇÃO ──
    const handleAbrirEdicao = (ev: Evento) => {
        setEventoEditando(ev);
        setEditForm({
            nome: ev.nome,
            descricao: ev.descricao,
            dataEvento: ev.dataEvento,
            horaInicio: ev.horaInicio?.slice(0, 5) ?? '',
            horaFim: ev.horaFim?.slice(0, 5) ?? '',
            local: ev.local,
            preco: ev.preco ?? 0,
            maxParticipantes: Number(ev.maxParticipantes) ?? 0,
        });
        setShowEditModal(true);
    };

const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoEditando) return;
    try {
        await api.put(`/eventos/${eventoEditando.id}`, {
            ...editForm,
            horaInicio: editForm.horaInicio.length === 5 ? editForm.horaInicio + ':00' : editForm.horaInicio,
            horaFim: editForm.horaFim.length === 5 ? editForm.horaFim + ':00' : editForm.horaFim,
        });
        toast.success("Evento atualizado com sucesso.");
        setShowEditModal(false);
        setEventoEditando(null);
        // Atualiza diretamente o estado local sem precisar de recarregar
        setEventos(prev => prev.map(ev => 
            ev.id === eventoEditando.id 
                ? { 
                    ...ev, 
                    nome: editForm.nome,
                    descricao: editForm.descricao,
                    dataEvento: editForm.dataEvento,
                    horaInicio: editForm.horaInicio + ':00',
                    horaFim: editForm.horaFim + ':00',
                    local: editForm.local,
                    preco: editForm.preco,
                    maxParticipantes: String(editForm.maxParticipantes),
                  } 
                : ev
        ));
    } catch (err) {
        toast.error("Erro ao atualizar o evento.");
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

    const eventoCheio = (ev: Evento) =>
        Number(ev.maxParticipantes) > 0 && Number(ev.numInscritos) >= Number(ev.maxParticipantes);

    const eventosVisiveis = ehAdministrador
        ? eventos
        : eventos.filter(ev => !eventoCheio(ev) || meusEventosIds.includes(ev.id));

    const eventosExibidos = filtroMeus
        ? eventosVisiveis.filter(e => meusEventosIds.includes(e.id))
        : eventosVisiveis;

    const inputClass = "w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#2d2722]";
    const labelClass = "block text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold mb-1";

    return (
        <main className="flex-1 overflow-y-auto p-6 text-[#2d2722] selection:bg-[#4a3f35] selection:text-white">
            <div className="max-w-7xl mx-auto">
                
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b-2 border-[#e6e1d6]">
                    <div>
                        <span className="text-[11px] uppercase tracking-widest text-[#8c8275] font-semibold block mb-1">
                            {ehAdministrador ? "Gestão Interna" : "Comunidade"}
                        </span>
                        <h1 className="text-3xl font-serif text-[#2d2722]">
                            {ehAdministrador ? "Administração de Eventos" : "Eventos"}
                        </h1>
                        <p className="text-[#6b6155] text-sm mt-1">
                            {ehAdministrador ? "Crie, edite, elimine e monitorize a adesão aos eventos da escola." : "Descobre os nossos workshops, exposições e datas especiais."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {ehAdministrador ? (
                            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-[#2d2722] text-[#d4b288] hover:bg-[#3d332a] rounded-xl text-xs font-bold transition-all shadow-xs">
                                Criar Novo Evento
                            </button>
                        ) : (
                            <>
                                <button onClick={() => setFiltroMeus(false)} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${!filtroMeus ? "bg-[#4a3f35] text-[#f4f1ea] border-[#4a3f35]" : "bg-white text-[#6b6155] border-[#e6e1d6] hover:bg-[#faf9f6]"}`}>Todos os Eventos</button>
                                <button onClick={() => setFiltroMeus(true)} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${filtroMeus ? "bg-[#4a3f35] text-[#f4f1ea] border-[#4a3f35]" : "bg-white text-[#6b6155] border-[#e6e1d6] hover:bg-[#faf9f6]"}`}>Inscrições Ativas</button>
                            </>
                        )}
                    </div>
                </header>

                {/* Listagem */}
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
                    
                    /* VISTA DE ADMINISTRAÇÃO */
                    <div className="bg-white border border-[#e6e1d6] rounded-2xl overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <span className="text-xs font-bold text-[#2d2722] uppercase tracking-wider">Eventos Ativos no Sistema</span>
                            <div className="text-[11px] text-[#8c8275]">Total: <span className="font-bold text-[#2d2722]">{eventos.length} registos</span></div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="bg-[#FBF7F2] border-b border-[#e6e1d6] text-[#2d2722] font-semibold uppercase tracking-wider text-[10px]">
                                        <th className="p-4">Evento / Localização</th>
                                        <th className="p-4">Data e Horário</th>
                                        <th className="p-4 text-center">Lotação</th>
                                        <th className="p-4 text-center">Preço</th>
                                        <th className="p-4 text-center">Estado</th>
                                        <th className="p-4 text-right">Ações de Gestão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e6e1d6]/40 text-[#2d2722]">
                                    {eventosExibidos.map((ev) => (
                                        <tr key={ev.id} className="hover:bg-[#FFFCF8] transition-colors">
                                            <td className="p-4">
                                                <div className="font-semibold text-[13px]">{ev.nome}</div>
                                                <div className="text-[#8c8275] text-[11px] font-light mt-0.5">📍 {ev.local}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-[#2d2722]">{ev.dataEvento}</div>
                                                <div className="text-[11px] mt-0.5 text-[#8c8275]">{ev.horaInicio?.slice(0, 5)} - {ev.horaFim?.slice(0, 5)}</div>
                                            </td>
                                            <td className="p-4 text-center whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 bg-[#f4f1ea] border border-[#e6e1d6] px-2.5 py-1 rounded-md text-xs font-medium">
                                                    <span className="text-[#2d2722] font-bold">{ev.numInscritos || "0"}</span>
                                                    <span className="text-[#8c8275] font-light">/</span>
                                                    <span className="text-[#8c8275] font-light">{ev.maxParticipantes || "—"}</span>
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="text-[#2d2722] font-medium">
                                                    {ev.preco != null ? (ev.preco === 0 ? "Gratuito" : `${ev.preco.toFixed(2)} €`) : "—"}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <select
                                                    className="bg-[#FFFCF8] border border-[#e6e1d6] rounded-md px-2 py-1.5 text-[11px] font-medium text-[#2d2722] outline-none focus:border-[#8c8275] transition-all cursor-pointer shadow-xs"
                                                    onChange={(e) => handleAlterarEstado(ev.id, Number(e.target.value))}
                                                    value={ev.estadoId ?? 1}
                                                >
                                                    <option value="1">⏳ Publicado</option>
                                                    <option value="2">✕ Cancelado</option>
                                                    <option value="3">✓ Concluído</option>
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
                                                        onClick={() => handleAbrirEdicao(ev)}
                                                        className="px-3 py-1.5 text-[11px] font-medium border border-[#e6e1d6] bg-white text-[#2d2722] hover:bg-[#4a3f35] hover:text-[#d4b288] rounded-md transition-colors shadow-xs"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleEliminar(ev.id)}
                                                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-md border border-red-100 transition-colors shadow-xs"
                                                        title="Eliminar Evento"
                                                    >
                                                        Apagar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (

                    /* VISTA DE UTILIZADOR COMUM (CARDS) */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eventosExibidos.map((evento) => {
                            const estaInscrito = meusEventosIds.includes(evento.id);
                            const data = new Date(evento.dataEvento + "T00:00:00");
                            const inscritos = Number(evento.numInscritos) || 0;
                            const maximos = Number(evento.maxParticipantes) || 0;
                            const percentagem = maximos > 0 ? Math.min(100, Math.round((inscritos / maximos) * 100)) : 0;
                            const cheio = maximos > 0 && inscritos >= maximos;
                            const estadoLabel = evento.estadoId === 2 ? "Cancelado" : evento.estadoId === 3 ? "Concluído" : estaInscrito ? "Inscrito" : cheio ? "Esgotado" : "Disponível";
                            const estadoCor = evento.estadoId === 2 ? "bg-red-50 text-red-600 border-red-200" : evento.estadoId === 3 ? "bg-[#f4f1ea] text-[#6b6155] border-[#e6e1d6]" : estaInscrito ? "bg-emerald-50 text-emerald-700 border-emerald-200" : cheio ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-[#f4f1ea] text-[#4a3f35] border-[#e6e1d6]";
                            const barCor = cheio ? "bg-amber-400" : percentagem >= 75 ? "bg-amber-400" : "bg-[#4a3f35]";

                            return (
                                <div
                                    key={evento.id}
                                    className="group bg-[#FFFCF8] rounded-sm border border-border-warm overflow-hidden flex gap-4 items-start p-5 hover:border-accent-muted hover:shadow-xs transition-all duration-200"
                                >
                                    {/* Bloco de data */}
                                    <div className="bg-[#4a3f35] text-[#f4f1ea] w-14 h-16 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]">
                                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-70 leading-none">
                                            {isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt", { month: "short" }).replace(".", "").toUpperCase()}
                                        </span>
                                        <span className="text-2xl font-serif font-bold leading-tight">
                                            {isNaN(data.getTime()) ? "•" : String(data.getDate()).padStart(2, "0")}
                                        </span>
                                    </div>

                                    {/* Conteúdo principal */}
                                    <div className="flex-1 min-w-0">
                                        {/* Linha 1: nome + badge estado */}
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className="font-serif font-bold text-sm text-[#2d2722] leading-snug line-clamp-1">{evento.nome}</h3>
                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${estadoCor}`}>
                                                {estadoLabel}
                                            </span>
                                        </div>

                                        {/* Linha 2: local · hora · preço */}
                                        <p className="text-[11px] text-[#8c8275] mb-2.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                            <span>{evento.local}</span>
                                            <span className="text-[#d4c5b5]">·</span>
                                            <span>{evento.horaInicio?.slice(0, 5)} – {evento.horaFim?.slice(0, 5)}</span>
                                            <span className="text-[#d4c5b5]">·</span>
                                            <span className={`font-semibold ${evento.preco ? "text-[#4a3f35]" : "text-emerald-600"}`}>
                                                {evento.preco != null ? (evento.preco === 0 ? "Entrada gratuita" : `€\u00A0${evento.preco.toFixed(2)}`) : "Entrada gratuita"}
                                            </span>
                                        </p>

                                        {/* Barra de lotação */}
                                        {maximos > 0 && (
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="flex-1 h-1 bg-[#ede8e0] rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all duration-500 ${barCor}`} style={{ width: `${percentagem}%` }} />
                                                </div>
                                                <span className="text-[10px] text-[#8c8275] whitespace-nowrap">
                                                    {cheio ? "Esgotado" : `${inscritos} / ${maximos}`}
                                                </span>
                                            </div>
                                        )}

                                        {/* Botões */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEventoSelecionado(evento)}
                                                className="px-3 py-1.5 bg-white border border-[#e6e1d6] text-[#2d2722] hover:bg-[#f4f1ea] rounded-md text-[11px] font-bold transition"
                                            >
                                                Ver Detalhes
                                            </button>
                                            {estaInscrito ? (
                                                <button
                                                    onClick={() => handleCancelar(evento.id)}
                                                    className="px-3 py-1.5 bg-[#fff5f5] text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded-md text-[11px] font-bold transition"
                                                >
                                                    Cancelar
                                                </button>
                                            ) : evento.estadoId !== 2 && evento.estadoId !== 3 && !cheio ? (
                                                <button
                                                    onClick={() => handleInscrever(evento.id)}
                                                    className="px-3 py-1.5 bg-[#4a3f35] hover:bg-[#382f27] text-white rounded-md text-[11px] font-bold transition"
                                                >
                                                    Comprar Bilhete
                                                </button>
                                            ) : cheio && !estaInscrito ? (
                                                <span className="px-3 py-1.5 bg-[#f4f1ea] text-[#8c8275] rounded-md text-[11px] font-bold border border-[#e6e1d6] cursor-not-allowed">
                                                    Esgotado
                                                </span>
                                            ) : null}
                                        </div>
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
                    <div className="bg-[#FBF7F2] border border-[#e6e1d6] w-full max-w-lg rounded-2xl overflow-hidden shadow-xl relative">
                        
                        {/* Barra lateral decorativa igual às outras */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2d2722]" />
                        
                        <div className="p-8 pl-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-serif font-bold text-[#2d2722]">{eventoSelecionado.nome}</h2>
                                </div>
                                <button onClick={() => setEventoSelecionado(null)} className="bg-[#faf9f6] border border-[#e6e1d6] hover:bg-[#f4f1ea] w-8 h-8 rounded-full flex items-center justify-center transition text-xs text-[#6b6155]">✕</button>
                            </div>
                            <div className="space-y-5 mb-8">
                                <p className="text-[#6b6155] leading-relaxed text-xs">{eventoSelecionado.descricao}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white border border-[#e6e1d6] p-3 rounded-xl">
                                        <span className="text-[#8c8275] text-[9px] font-bold uppercase tracking-wider block mb-0.5">Localização</span>
                                        <span className="text-xs font-semibold text-[#2d2722]">{eventoSelecionado.local}</span>
                                    </div>
                                    <div className="bg-white border border-[#e6e1d6] p-3 rounded-xl">
                                        <span className="text-[#8c8275] text-[9px] font-bold uppercase tracking-wider block mb-0.5">Horário</span>
                                        {/* CORREÇÃO: Remove os segundos exibindo apenas HH:mm */}
                                        <span className="text-xs font-semibold text-[#2d2722]">
                                            {eventoSelecionado.horaInicio?.substring(0, 5)} - {eventoSelecionado.horaFim?.substring(0, 5)}
                                        </span>
                                    </div>
                                    <div className="bg-white border border-[#e6e1d6] p-3 rounded-xl col-span-2">
                                        <span className="text-[#8c8275] text-[9px] font-bold uppercase tracking-wider block mb-0.5">Preço</span>
                                        <span className={`text-xs font-semibold ${eventoSelecionado.preco ? "text-[#2d2722]" : "text-emerald-600"}`}>
                                            {eventoSelecionado.preco != null ? (eventoSelecionado.preco === 0 ? "Entrada gratuita" : `${eventoSelecionado.preco.toFixed(2)} €`) : "Entrada gratuita"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {!meusEventosIds.includes(eventoSelecionado.id) ? (
                                Number(eventoSelecionado.maxParticipantes) === 1 ? (
                                    <div className="w-full py-3 rounded-xl bg-[#f4f1ea] text-[#8c8275] border border-[#e6e1d6] text-center font-bold text-xs cursor-not-allowed">Sem vagas disponíveis</div>
                                ) : (
                                    <button onClick={() => handleInscrever(eventoSelecionado.id)} className="w-full bg-[#4a3f35] hover:bg-[#382f27] py-3 rounded-xl font-bold text-white text-xs transition">Comprar Bilhete</button>
                                )
                            ) : (
                                <div className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-center font-bold text-xs">✓ Já estás inscrito neste evento</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL DE PARTICIPANTES ─── */}
            {participantesModal.aberto && ehAdministrador && (
                <div className="fixed inset-0 bg-[#2d2722]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-[#e6e1d6] w-full max-w-md rounded-2xl overflow-hidden shadow-xl relative">
                        
                        {/* BARRA SUAVIZADA COM #4a3f35 */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4a3f35]" />
                        
                        <div className="p-5 pl-7 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <div>
                                <h2 className="text-sm font-serif font-bold text-[#2d2722]">Alunos Inscritos</h2>
                                <p className="text-[11px] text-[#8c8275] line-clamp-1 mt-0.5">{participantesModal.nomeEvento}</p>
                            </div>
                            <button onClick={() => setParticipantesModal({ aberto: false, lista: [], nomeEvento: "" })} className="bg-[#faf9f6] border border-[#e6e1d6] hover:bg-[#f4f1ea] w-7 h-7 rounded-full flex items-center justify-center transition text-xs text-[#6b6155]">✕</button>
                        </div>
                        <div className="p-4 pl-7 max-h-72 overflow-y-auto divide-y divide-[#e6e1d6]/30">
                            {participantesModal.lista.length === 0 ? (
                                <p className="text-center text-xs text-[#8c8275] italic py-8">Nenhum aluno inscrito até ao momento.</p>
                            ) : (
                                participantesModal.lista.map((aluno, idx) => (
                                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 bg-[#f4f1ea] text-[#4a3f35] font-bold rounded-full flex items-center justify-center text-[10px]">
                                                {aluno.utilizadorNome ? aluno.utilizadorNome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() : "?"}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-[#2d2722]">
                                                    {aluno.utilizadorNome || "Nome não disponível"}
                                                    {aluno.cancelado && <span className="text-red-500 font-normal text-[10px] ml-1.5">(Cancelado)</span>}
                                                </div>
                                                {aluno.utilizadorEmail && <div className="text-[10px] text-[#8c8275]">{aluno.utilizadorEmail}</div>}
                                            </div>
                                        </div>
                                        <div>
                                            {aluno.pago && !aluno.cancelado && <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] rounded border border-green-100">Pago</span>}
                                            {!aluno.pago && !aluno.cancelado && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] rounded border border-amber-100">Pendente</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── MODAL DE EDIÇÃO DE EVENTO ─── */}
            {showEditModal && eventoEditando && ehAdministrador && (
                <div className="fixed inset-0 bg-[#2d2722]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-[#FBF7F2] border border-[#e6e1d6] w-full max-w-lg rounded-2xl overflow-hidden shadow-xl relative">
                        
                        {/* BARRA SUAVIZADA COM #4a3f35 */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4a3f35]" />
                        
                        <div className="p-5 pl-7 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <div>
                                <h2 className="text-sm font-serif font-bold text-[#2d2722]">Editar Evento</h2>
                                <p className="text-[11px] text-[#8c8275] mt-0.5 line-clamp-1">{eventoEditando.nome}</p>
                            </div>
                            <button onClick={() => { setShowEditModal(false); setEventoEditando(null); }} className="text-xs text-[#6b6155] bg-[#faf9f6] border border-[#e6e1d6] hover:bg-[#f4f1ea] w-7 h-7 rounded-full flex items-center justify-center transition">✕</button>
                        </div>
                        <form onSubmit={handleEditar} className="p-5 pl-7 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className={labelClass}>Nome do Evento</label>
                                <input type="text" required className={inputClass} value={editForm.nome} onChange={e => setEditForm({...editForm, nome: e.target.value})} />
                            </div>
                            <div>
                                <label className={labelClass}>Descrição</label>
                                <textarea required className={`${inputClass} h-20 resize-none`} value={editForm.descricao} onChange={e => setEditForm({...editForm, descricao: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Data</label>
                                    <input type="date" required className={inputClass} value={editForm.dataEvento} onChange={e => setEditForm({...editForm, dataEvento: e.target.value})} />
                                </div>
                                <div>
                                    <label className={labelClass}>Local</label>
                                    <input type="text" required className={inputClass} value={editForm.local} onChange={e => setEditForm({...editForm, local: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Hora Início</label>
                                    <input type="time" required className={inputClass} value={editForm.horaInicio} onChange={e => setEditForm({...editForm, horaInicio: e.target.value})} />
                                </div>
                                <div>
                                    <label className={labelClass}>Hora Fim</label>
                                    <input type="time" required className={inputClass} value={editForm.horaFim} onChange={e => setEditForm({...editForm, horaFim: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Preço (€)</label>
                                    <input type="number" min="0" step="0.01" className={inputClass} value={editForm.preco} onChange={e => setEditForm({...editForm, preco: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className={labelClass}>Lotação Máxima</label>
                                    <input type="number" min="1" required className={inputClass} value={editForm.maxParticipantes} onChange={e => setEditForm({...editForm, maxParticipantes: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2 border-t border-[#e6e1d6]">
                                <button type="button" onClick={() => { setShowEditModal(false); setEventoEditando(null); }} className="flex-1 border border-[#e6e1d6] text-[#6b6155] p-2.5 rounded-md text-xs font-medium hover:bg-[#faf9f6] transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 bg-[#2d2722] text-[#d4b288] p-2.5 rounded-md text-xs font-medium hover:bg-[#3d332a] transition-colors">Guardar Alterações</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL DE CRIAÇÃO DE EVENTO ─── */}
            {showModal && ehAdministrador && (
                <div className="fixed inset-0 bg-[#2d2722]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-[#e6e1d6] w-full max-w-md rounded-2xl overflow-hidden shadow-xl relative">
                        
                        {/* BARRA SUAVIZADA COM #4a3f35 */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4a3f35]" />
                        
                        <div className="p-5 pl-7 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <h2 className="text-sm font-serif font-bold text-[#2d2722]">Criar Novo Evento</h2>
                            <button onClick={() => setShowModal(false)} className="text-xs text-[#6b6155] bg-[#faf9f6] border border-[#e6e1d6] hover:bg-[#f4f1ea] w-7 h-7 rounded-full flex items-center justify-center transition">✕</button>
                        </div>
                        <form onSubmit={handleCriar} className="p-5 pl-7 space-y-3 text-xs">
                            <div>
                                <label className={labelClass}>Nome do Evento</label>
                                <input type="text" required className={inputClass} value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} />
                            </div>
                            <div>
                                <label className={labelClass}>Descrição</label>
                                <textarea required className={`${inputClass} h-20 resize-none`} value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}>Data</label>
                                    <input type="date" required className={inputClass} value={novoEvento.dataEvento} onChange={e => setNovoEvento({...novoEvento, dataEvento: e.target.value})} />
                                </div>
                                <div>
                                    <label className={labelClass}>Local</label>
                                    <input type="text" required className={inputClass} value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}>Hora Início</label>
                                    <input type="time" required className={inputClass} value={novoEvento.horaInicio} onChange={e => setNovoEvento({...novoEvento, horaInicio: e.target.value})} />
                                </div>
                                <div>
                                    <label className={labelClass}>Hora Fim</label>
                                    <input type="time" required className={inputClass} value={novoEvento.horaFim} onChange={e => setNovoEvento({...novoEvento, horaFim: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelClass}>Preço (€)</label>
                                    <input type="number" min="0" step="0.01" className={inputClass} value={novoEvento.preco} onChange={e => setNovoEvento({...novoEvento, preco: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className={labelClass}>Lotação Máxima</label>
                                    <input type="number" min="1" required className={inputClass} value={novoEvento.maxParticipantes} onChange={e => setNovoEvento({...novoEvento, maxParticipantes: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2 border-t border-[#e6e1d6]">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#e6e1d6] text-[#6b6155] p-2.5 rounded-md text-xs font-medium hover:bg-[#faf9f6] transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 bg-[#2d2722] text-[#d4b288] p-2.5 rounded-md text-xs font-medium hover:bg-[#3d332a] transition-colors">Guardar Evento</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}