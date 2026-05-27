'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface EventoDto {
    id: string;
    nome: string;
    descricao: string;
    dataEvento: string;
    horaInicio: string;
    horaFim: string;
    local: string;
    preco: number;
    maxParticipantes: number;
    numInscritos: number;
    estadoId: number;
}

interface NovoEventoForm {
    nome: string;
    descricao: string;
    dataEvento: string;
    horaInicio: string;
    horaFim: string;
    local: string;
    preco: number;
    maxParticipantes: number;
}

const ESTADO_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: 'Agendado',  color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    2: { label: 'Concluído', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
    3: { label: 'Cancelado', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

const FORM_INICIAL: NovoEventoForm = {
    nome: '',
    descricao: '',
    dataEvento: '',
    horaInicio: '',
    horaFim: '',
    local: '',
    preco: 0,
    maxParticipantes: 0,
};

export default function AdminEventosPage() {
    const [eventos, setEventos] = useState<EventoDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [submetendo, setSubmetendo] = useState(false);
    const [novoEvento, setNovoEvento] = useState<NovoEventoForm>(FORM_INICIAL);
    interface ParticipanteDto {
        utilizadorNome: string;
        utilizadorEmail: string;
        pago: boolean;
        cancelado: boolean;
    }
    
    // Dentro do componente:
    const [modalParticipantes, setModalParticipantes] = useState<{aberto: boolean, eventoNome: string}>({ aberto: false, eventoNome: '' });
    const [participantes, setParticipantes] = useState<ParticipanteDto[]>([]);
    const [loadingParticipantes, setLoadingParticipantes] = useState(false);
    useEffect(() => {
        carregarEventos();
    }, []);

    const carregarEventos = async () => {
        try {
            setLoading(true);
            setErro(null);
            const res = await api.get('/eventos');
            setEventos(res.data);
        } catch {
            setErro('Não foi possível carregar os eventos. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleCriar = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmetendo(true);

        // Payload alinhado com o backend — criadoPor é extraído pelo Spring do JWT
        const payload = {
            nome: novoEvento.nome,
            descricao: novoEvento.descricao,
            dataEvento: novoEvento.dataEvento,
            horaInicio: novoEvento.horaInicio + ':00',
            horaFim: novoEvento.horaFim + ':00',
            local: novoEvento.local,
            preco: Number(novoEvento.preco),
            maxParticipantes: Number(novoEvento.maxParticipantes),
        };

        try {
            await api.post('/eventos', payload);
            setShowModal(false);
            setNovoEvento(FORM_INICIAL);
            carregarEventos();
        } catch {
            setErro('Erro ao criar o evento. Verifique os dados e tente novamente.');
        } finally {
            setSubmetendo(false);
        }
    };

    const handleEliminar = async (id: string) => {
        if (!confirm('Confirmar a eliminação permanente deste evento?')) return;
        try {
            await api.delete(`/eventos/${id}`);
            setEventos((prev) => prev.filter((ev) => ev.id !== id));
        } catch {
            setErro('Erro ao eliminar o evento.');
        }
    };

    const handleAlterarEstado = async (id: string, estadoId: number) => {
        try {
            await api.patch(`/eventos/${id}/estado/${estadoId}`);
            setEventos((prev) =>
                prev.map((ev) => (ev.id === id ? { ...ev, estadoId } : ev))
            );
        } catch {
            setErro('Não foi possível alterar o estado do evento.');
        }
    };

    const fecharModal = () => {
        setShowModal(false);
        setNovoEvento(FORM_INICIAL);
    };
    const carregarParticipantes = async (eventoId: string, nome: string) => {
        try {
            setLoadingParticipantes(true);
            setModalParticipantes({ aberto: true, eventoNome: nome });
            
            // Endpoint sugerido: GET /eventos/{id}/participantes
            const res = await api.get(`/eventos/${eventoId}/participantes`);
            setParticipantes(res.data);
        } catch (err) {
            setErro("Erro ao carregar lista de participantes.");
        } finally {
            setLoadingParticipantes(false);
        }
    };
    return (
        <main className="min-h-screen bg-[#050505] text-white p-8 font-sans">

            {/* CABEÇALHO */}
            <div className="flex justify-between items-center mb-12 border-b border-white/10 pb-8">
                <div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter text-blue-500">
                        Painel de Administração
                    </h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-2">
                        Gestão de Eventos e Participantes
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                >
                    Novo Evento
                </button>
            </div>

            {/* BANNER DE ERRO */}
            {erro && (
                <div className="mb-6 bg-red-900/20 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl text-xs font-bold flex justify-between items-center">
                    {erro}
                    <button onClick={() => setErro(null)} className="ml-4 text-red-300 hover:text-white transition-colors">✕</button>
                </div>
            )}

            {/* TABELA */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="p-20 text-center text-gray-700 font-black tracking-widest uppercase">
                        Sincronizando com Base de Dados...
                    </div>
                ) : eventos.length === 0 ? (
                    <div className="p-20 text-center text-gray-600 font-black tracking-widest uppercase text-sm">
                        Nenhum evento encontrado.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-[10px] uppercase tracking-[0.2em] font-black text-gray-400">
                                <th className="p-6">Evento / Localização</th>
                                <th className="p-6">Data e Horário</th>
                                <th className="p-6">Inscritos</th>
                                <th className="p-6">Estado</th>
                                <th className="p-6 text-right">Gestão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {eventos.map((ev) => (
                                <tr key={ev.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="p-6">
                                        <div className="font-black uppercase italic text-sm">{ev.nome}</div>
                                        <div className="text-[10px] text-gray-500 mt-1 uppercase">{ev.local}</div>
                                    </td>
                                    <td className="p-6">
                                        <div className="text-sm font-bold text-gray-300">{ev.dataEvento}</div>
                                        <div className="text-[10px] text-blue-500 font-black uppercase">
                                            {ev.horaInicio.slice(0, 5)} — {ev.horaFim.slice(0, 5)}
                                        </div>
                                    </td>
                                    <td className="p-6 font-mono text-sm">
                                        <span className={`font-bold ${ev.numInscritos >= ev.maxParticipantes ? 'text-red-400' : 'text-blue-500'}`}>
                                            {ev.numInscritos}
                                        </span>
                                        <span className="text-gray-600"> / {ev.maxParticipantes}</span>
                                    </td>
                                    <td className="p-6">
                                        <select
                                            value={ev.estadoId}
                                            onChange={(e) => handleAlterarEstado(ev.id, Number(e.target.value))}
                                            className={`bg-[#050505] border rounded-lg p-2 text-[10px] font-black uppercase outline-none focus:border-blue-500 transition-colors ${ESTADO_LABELS[ev.estadoId]?.color ?? ''}`}
                                        >
                                            <option value={1}>Agendado</option>
                                            <option value={2}>Concluído</option>
                                            <option value={3}>Cancelado</option>
                                        </select>
                                    </td>
                                    <td className="p-6 text-right space-x-2">
                                    <button 
                                        onClick={() => carregarParticipantes(ev.id, ev.nome)}
                                        className="bg-white/5 hover:bg-white hover:text-black px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all"
                                    >
                                        Participantes
                                    </button>
                                        <button
                                            onClick={() => handleEliminar(ev.id)}
                                            className="bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all"
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-6 backdrop-blur-md">
                    <div className="bg-[#0f0f0f] border border-white/10 p-12 rounded-[3rem] w-full max-w-2xl">
                        <h2 className="text-2xl font-black italic uppercase mb-8 text-blue-500">
                            Configuração de Novo Evento
                        </h2>
                        <form onSubmit={handleCriar} className="grid grid-cols-2 gap-6">

                            <input
                                type="text"
                                placeholder="Nome do Evento"
                                value={novoEvento.nome}
                                className="col-span-2 bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none uppercase text-xs"
                                onChange={(e) => setNovoEvento({ ...novoEvento, nome: e.target.value })}
                                required
                            />

                            <textarea
                                placeholder="Descritivo do Evento"
                                value={novoEvento.descricao}
                                className="col-span-2 bg-white/5 border border-white/10 p-5 rounded-2xl h-32 focus:border-blue-500 outline-none text-xs resize-none"
                                onChange={(e) => setNovoEvento({ ...novoEvento, descricao: e.target.value })}
                                required
                            />

                            <input
                                type="date"
                                value={novoEvento.dataEvento}
                                className="bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none text-xs text-gray-400"
                                onChange={(e) => setNovoEvento({ ...novoEvento, dataEvento: e.target.value })}
                                required
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="time"
                                    value={novoEvento.horaInicio}
                                    className="bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none text-xs text-gray-400"
                                    onChange={(e) => setNovoEvento({ ...novoEvento, horaInicio: e.target.value })}
                                    required
                                />
                                <input
                                    type="time"
                                    value={novoEvento.horaFim}
                                    className="bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none text-xs text-gray-400"
                                    onChange={(e) => setNovoEvento({ ...novoEvento, horaFim: e.target.value })}
                                    required
                                />
                            </div>

                            <input
                                type="text"
                                placeholder="Localização"
                                value={novoEvento.local}
                                className="bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none text-xs"
                                onChange={(e) => setNovoEvento({ ...novoEvento, local: e.target.value })}
                                required
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="number"
                                    placeholder="Preço (EUR)"
                                    min={0}
                                    value={novoEvento.preco || ''}
                                    className="bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none text-xs"
                                    onChange={(e) => setNovoEvento({ ...novoEvento, preco: Number(e.target.value) })}
                                    required
                                />
                                <input
                                    type="number"
                                    placeholder="Lotação Máxima"
                                    min={1}
                                    value={novoEvento.maxParticipantes || ''}
                                    className="bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none text-xs"
                                    onChange={(e) => setNovoEvento({ ...novoEvento, maxParticipantes: Number(e.target.value) })}
                                    required
                                />
                            </div>

                            <div className="col-span-2 flex gap-4 mt-8">
                                <button
                                    type="button"
                                    onClick={fecharModal}
                                    className="flex-1 border border-white/10 p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submetendo}
                                    className="flex-1 bg-blue-600 p-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submetendo ? 'A gravar...' : 'Gravar Evento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {modalParticipantes.aberto && (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-6 backdrop-blur-md">
        <div className="bg-[#0f0f0f] border border-white/10 p-10 rounded-[2rem] w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-xl font-black italic uppercase text-blue-500">Inscritos</h2>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">{modalParticipantes.eventoNome}</p>
                </div>
                <button onClick={() => setModalParticipantes({aberto: false, eventoNome: ''})} className="text-gray-500 hover:text-white">✕</button>
            </div>

            <div className="max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                {loadingParticipantes ? (
                    <p className="text-center py-10 text-xs font-bold animate-pulse text-gray-600">A CARREGAR LISTA...</p>
                ) : participantes.length === 0 ? (
                    <p className="text-center py-10 text-xs font-bold text-gray-600">NENHUM PARTICIPANTE INSCRITO.</p>
                ) : (
                    <table className="w-full text-left">
                        <thead className="text-[9px] text-gray-500 uppercase border-b border-white/5">
                            <tr>
                                <th className="pb-4">Nome</th>
                                <th className="pb-4">Estado</th>
                                <th className="pb-4 text-right">Pagamento</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {participantes.map((p, idx) => (
                                <tr key={idx} className={p.cancelado ? 'opacity-40' : ''}>
                                    <td className="py-4">
                                        <div className="text-xs font-bold uppercase">{p.utilizadorNome}</div>
                                        <div className="text-[9px] text-gray-500">{p.utilizadorEmail}</div>
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[9px] font-black uppercase ${p.cancelado ? 'text-red-500' : 'text-green-500'}`}>
                                            {p.cancelado ? 'Cancelado' : 'Ativo'}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${p.pago ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                            {p.pago ? 'Pago' : 'Pendente'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
            <button 
                onClick={() => setModalParticipantes({aberto: false, eventoNome: ''})}
                className="w-full mt-8 bg-white/5 hover:bg-white/10 p-4 rounded-xl font-black uppercase text-[10px] transition-all"
            >
                Fechar Lista
            </button>
        </div>
    </div>
)}
        </main>
    );
}