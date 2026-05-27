'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

const NAV_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { icon: 'ti-home',         label: 'Início',      href: '/landingPage' },
      { icon: 'ti-calendar',     label: 'Horários',    href: '/horarios' },
      { icon: 'ti-credit-card',  label: 'Pagamentos',  href: '/pagamentos' },
    ],
  },
  {
    title: 'Comunidade',
    items: [
      { icon: 'ti-mail',         label: 'Mensagens',   href: '/mensagens' },
      { icon: 'ti-star',         label: 'Eventos',     href: '/eventos' },
      { icon: 'ti-shopping-bag', label: 'Marketplace', href: '/marketplace' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { icon: 'ti-chart-bar',    label: 'Gestão de Faltas', href: '/faltas' },
    ],
  },
];

export default function AdminEventosPage() {
    const router = useRouter();
    const drawerRef = useRef<HTMLDivElement>(null);
    
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [userName, setUserName] = useState('');
    
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
    carregarEventos();

    const raw = localStorage.getItem('user');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            setUserName(parsed.nome ?? '');
            
            if (parsed.role !== 'ADMIN') {
                toast.error("Acesso negado. Área restrita a administradores.");
            }

        } catch {}
    } else {
        router.push('/');
    }
}, []);
    const carregarEventos = async () => {
        try {
            setLoading(true);
            const res = await api.get('/eventos');
            setEventos(res.data);
        } catch (err) {
            toast.error("Erro ao carregar dados de gestão.");
        } finally {
            setLoading(false);
        }
    };

    const handleCriar = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/eventos', novoEvento);
            toast.success("Evento registado com sucesso.");
            setShowModal(false);
            carregarEventos();
        } catch (err) {
            toast.error("Erro ao comunicar com o servidor.");
        }
    };

    const handleEliminar = async (id: string) => {
        if (!confirm("Confirmar a eliminação permanente deste evento?")) return;
        try {
            await api.delete(`/eventos/${id}`);
            toast.success("Registo eliminado.");
            setEventos(eventos.filter((ev: any) => ev.id !== id));
        } catch (err) {
            toast.error("Erro ao eliminar o registo.");
        }
    };

    const handleAlterarEstado = async (id: string, estadoId: number) => {
        try {
            await api.patch(`/eventos/${id}/estado/${estadoId}`);
            toast.success("Estado do evento updated.");
            carregarEventos();
        } catch (err) {
            toast.error("Não foi possível alterar o estado.");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/');
    };

    const initials = userName
        ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : 'A';

    return (
        <div className="flex flex-col min-h-screen bg-[#faf9f6] font-sans text-[#2d2722]">
            
            {/* ── BARRA SUPERIOR (NAVBAR) ── */}
            <nav className="flex items-center justify-between px-5 flex-shrink-0 sticky top-0 z-40"
                 style={{ height: '52px', borderBottom: '1px solid var(--border-warm)', background: '#faf9f6' }}>
                <div className="flex items-center gap-3">
                    <button onClick={() => setDrawerOpen(true)} aria-label="Abrir menu"
                            className="flex items-center justify-center shadow-xs"
                            style={{ width: '32px', height: '32px', border: '1px solid var(--border-warm)', borderRadius: '4px', background: '#FFFCF8', color: 'var(--panel-dark)', cursor: 'pointer' }}>
                        <i className="ti ti-menu-2" style={{ fontSize: '16px' }} />
                    </button>
                    <div>
                        <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '16px', letterSpacing: '4px', color: 'var(--panel-dark)', fontWeight: 400 }}>
                            entartes
                        </span>
                        <span className="hidden sm:inline" style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginLeft: '4px' }}>
                            · Administração
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300 }}>
                        Painel de Controlo
                    </span>
                    <div className="flex items-center justify-center"
                         style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--panel-dark)', color: 'var(--accent-gold)', fontSize: '11px', letterSpacing: '1px', fontFamily: 'var(--font-playfair)', fontWeight: 400 }}>
                        {initials}
                    </div>
                </div>
            </nav>

            {/* ── CORPO COM DRAWER DE NAVEGAÇÃO ── */}
            <div className="flex flex-1 relative overflow-hidden">
                {drawerOpen && (
                    <div className="absolute inset-0 z-10" style={{ background: 'rgba(44,31,20,0.30)' }} onClick={() => setDrawerOpen(false)} />
                )}

                {/* MENU LATERAL ESCURO (DRAWER) */}
                <aside ref={drawerRef} className="absolute top-0 bottom-0 left-0 z-20 flex flex-col"
                       style={{ width: '220px', background: 'var(--panel-dark)', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .28s cubic-bezier(.4,0,.2,1)' }}>
                    <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(212,178,136,0.12)' }}>
                        <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '13px', letterSpacing: '3px', color: 'var(--accent-gold)', fontWeight: 400, display: 'block' }}>entartes</span>
                        <span style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.35)', fontWeight: 300, marginTop: '2px', display: 'block' }}>escola de dança</span>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2">
                        {NAV_SECTIONS.map((section) => (
                            <div key={section.title}>
                                <div style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.22)', fontWeight: 300, padding: '14px 20px 4px' }}>{section.title}</div>
                                {section.items.map((item) => (
                                    <button key={item.href} onClick={() => { router.push(item.href); setDrawerOpen(false); }}
                                            className="flex items-center gap-2 w-full transition-colors"
                                            style={{ padding: '10px 20px', color: 'rgba(212,178,136,0.55)', fontSize: '12px', letterSpacing: '.5px', fontWeight: 300, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,178,136,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-gold)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(212,178,136,0.55)'; }}>
                                        <i className={`ti ${item.icon}`} style={{ fontSize: '15px' }} aria-hidden="true" />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(212,178,136,0.10)' }}>
                        <button onClick={handleLogout} className="flex items-center gap-2"
                                style={{ color: 'rgba(212,178,136,0.35)', fontSize: '12px', fontWeight: 300, background: 'transparent', border: 'none', cursor: 'pointer' }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#E8A09A')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(212,178,136,0.35)')}>
                            <i className="ti ti-logout" /> Sair da Conta
                        </button>
                    </div>
                </aside>

                {/* ── CONTEÚDO PRINCIPAL DA GESTÃO ── */}
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        
                        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-5 border-b border-[#e6e1d6]">
                            <div>
                                <span className="text-[10px] uppercase tracking-widest text-[#8c8275] font-semibold block mb-1">Gestão Interna</span>
                                <h1 className="text-2xl font-serif text-[#2d2722]">Administração de Eventos</h1>
                                <p className="text-[#6b6155] text-xs mt-0.5">Crie, edite, elimine e monitorize a adesão aos eventos da escola.</p>
                            </div>
                            
                            <button 
                                onClick={() => setShowModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#2d2722] text-[#d4b288] hover:bg-[#3d332a] rounded-md text-xs font-medium tracking-wide transition-all shadow-xs"
                            >
                                <i className="ti ti-plus" style={{ fontSize: '14px' }} />
                                Criar Novo Evento
                            </button>
                        </header>

                        <div className="bg-white border border-[#e6e1d6] rounded-t-md p-4 flex justify-between items-center">
                            <span className="text-xs font-medium text-[#2d2722]">Eventos Ativos no Sistema</span>
                            <div className="text-[11px] text-[#8c8275] font-light">
                                Total: <span className="font-normal text-[#2d2722]">{eventos.length} registos</span>
                            </div>
                        </div>

                        <div className="bg-white border border-[#e6e1d6] border-t-0 rounded-b-md overflow-hidden shadow-xs">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-2">
                                    <div className="w-6 h-6 border-2 border-[#2d2722] border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-[#8c8275] text-xs italic">Sincronizando com a base de dados...</span>
                                </div>
                            ) : eventos.length === 0 ? (
                                <div className="p-12 text-center text-[#8c8275] text-xs font-light">
                                    Nenhum evento registado no sistema de momento.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="bg-[#FBF7F2] border-b border-[#e6e1d6] text-[#2d2722] font-semibold uppercase tracking-wider text-[10px]">
                                                <th className="p-4 w-1/3">Evento / Localização</th>
                                                <th className="p-4 w-1/4">Data e Horário</th>
                                                <th className="p-4 w-32 text-center">Inscritos</th>
                                                <th className="p-4 w-40 text-center">Estado</th>
                                                <th className="p-4 w-48 text-right">Ações de Gestão</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#e6e1d6]/40 text-[#2d2722]">
                                            {eventos.map((ev: any) => (
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
                                                    <td className="p-4 text-center whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 bg-[#f4f1ea] border border-[#e6e1d6] px-2.5 py-1 rounded-md text-xs font-medium">
                                                            <span className="text-[#2d2722]">15</span>
                                                            <span className="text-[#8c8275] font-light">/</span>
                                                            <span className="text-[#8c8275] font-light">{ev.maxParticipantes}</span>
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <select 
                                                            className="bg-[#FFFCF8] border border-[#e6e1d6] rounded-md px-2 py-1.5 text-[11px] font-medium text-[#2d2722] outline-none focus:border-[#8c8275] transition-all cursor-pointer shadow-xs"
                                                            onChange={(e) => handleAlterarEstado(ev.id, Number(e.target.value))}
                                                            defaultValue="1"
                                                        >
                                                            <option value="1">⏳ Agendado</option>
                                                            <option value="2">✓ Concluído</option>
                                                            <option value="3">✕ Cancelado</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-4 whitespace-nowrap text-right">
                                                        <div className="inline-flex gap-1.5">
                                                            <button className="px-3 py-1.5 text-[11px] font-medium border border-[#e6e1d6] bg-white text-[#2d2722] hover:bg-[#2d2722] hover:text-[#d4b288] rounded-md transition-colors shadow-xs">
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
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                    </div>
                </main>
            </div>

            {/* ─── MODAL DE CONFIGURAÇÃO DE NOVO EVENTO ─── */}
            {showModal && (
                <div className="fixed inset-0 bg-[#2d2722]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-[#e6e1d6] w-full max-w-xl rounded-xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
                        
                        <div className="p-6 border-b border-[#e6e1d6] bg-[#FBF7F2] flex justify-between items-center">
                            <h2 className="text-lg font-serif font-semibold text-[#2d2722]">Configuração de Novo Evento</h2>
                            <button onClick={() => setShowModal(false)} className="text-[#8c8275] hover:text-[#2d2722] transition-colors text-lg">✕</button>
                        </div>

                        <form onSubmit={handleCriar} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Nome do Evento</label>
                                <input type="text" placeholder="Ex: Gala de Ballet Clássico" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#2d2722]" 
                                       onChange={(e) => setNovoEvento({...novoEvento, nome: e.target.value})} required />
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Descrição do Evento</label>
                                <textarea placeholder="Insira os detalhes e objetivos do evento..." className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md h-24 focus:border-[#8c8275] outline-none text-xs text-[#2d2722] resize-none"
                                          onChange={(e) => setNovoEvento({...novoEvento, descricao: e.target.value})} required />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Data do Evento</label>
                                    <input type="date" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#6b6155]"
                                           onChange={(e) => setNovoEvento({...novoEvento, dataEvento: e.target.value})} required />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Horário (Início / Fim)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="time" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#6b6155]"
                                               onChange={(e) => setNovoEvento({...novoEvento, horaInicio: e.target.value + ":00"})} required />
                                        <input type="time" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#6b6155]"
                                               onChange={(e) => setNovoEvento({...novoEvento, horaFim: e.target.value + ":00"})} required />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Localização dentro da Escola</label>
                                <input type="text" placeholder="Ex: Grande Auditório / Estúdio Principal" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#2d2722]"
                                       onChange={(e) => setNovoEvento({...novoEvento, local: e.target.value})} required />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Preço de Inscrição (€)</label>
                                    <input type="number" placeholder="0.00" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#2d2722]"
                                           onChange={(e) => setNovoEvento({...novoEvento, preco: Number(e.target.value)})} required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#8c8275] font-semibold">Lotação Máxima (Alunos)</label>
                                    <input type="number" placeholder="Ex: 30" className="w-full bg-[#FFFCF8] border border-[#e6e1d6] p-2.5 rounded-md focus:border-[#8c8275] outline-none text-xs text-[#2d2722]"
                                           onChange={(e) => setNovoEvento({...novoEvento, maxParticipantes: Number(e.target.value)})} required />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-[#e6e1d6]/60">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#e6e1d6] text-[#6b6155] p-2.5 rounded-md text-xs font-medium hover:bg-[#faf9f6] transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 bg-[#2d2722] text-[#d4b288] p-2.5 rounded-md text-xs font-medium hover:bg-[#3d332a] transition-colors shadow-xs">Gravar Evento</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}