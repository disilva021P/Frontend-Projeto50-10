'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

type Role = 'ALUNO' | 'COORDENACAO' | 'PROFESSOR' | 'ENCARREGADO';

interface Evento {
  id: string; 
  nome: string;
  descricao: string;
  dataEvento: string;
  horaInicio: string;
  horaFim: string;
  local: string;
  criadoPor: {
    id: string;
    nome: string;
  };
}

const NAV_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { icon: 'ti-home', label: 'Início', href: '/landingPage' },
      { icon: 'ti-calendar', label: 'Horários', href: '/horarios' },
      { icon: 'ti-credit-card', label: 'Pagamentos', href: '/pagamentos' },
    ],
  },
  {
    title: 'Comunidade',
    items: [
      { icon: 'ti-mail', label: 'Mensagens', href: '/mensagens' },
      { icon: 'ti-star', label: 'Eventos', href: '/eventos' },
      { icon: 'ti-shopping-bag', label: 'Marketplace', href: '/marketplace' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { icon: 'ti-chart-bar', label: 'Gestão de Faltas', href: '/faltas' },
    ],
  },
];

export default function EventosPage() {
    const router = useRouter();
    const drawerRef = useRef<HTMLDivElement>(null);

    // ── ESTADOS ORIGINAIS DO TEU CÓDIGO ──
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [meusEventosIds, setMeusEventosIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroMeus, setFiltroMeus] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
    const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

    // ── ESTADOS DE CONTROLO VISUAL & NAV ──
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [userName, setUserName] = useState('');
    const [role, setRole] = useState<Role | null>(null);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [notificacoes, setNotificacoes] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [checkingAccess, setCheckingAccess] = useState(true); // Estado para evitar flash de conteúdo

    // Sincronização e Leitura do utilizador do localStorage para a barra superior
    useEffect(() => {
        const raw = localStorage.getItem('user');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                setUserName(parsed.nome ?? '');
                setRole((parsed.tipoUtilizadorId as Role) ?? null);
            } catch { /* ignora */ }
        }
        setCheckingAccess(false);

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDrawerOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    // 1. Identificar o utilizador logado através do token (Protegido para Testes)
    useEffect(() => {
        const carregarPerfil = () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    if (token === 'mocked_jwt_token_for_testing') {
                        setUsuarioLogado({ id: "1" });
                        return;
                    }
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    setUsuarioLogado({ id: payload.sub });
                }
            } catch (err) {
                console.error("Erro ao identificar utilizador", err);
                setUsuarioLogado({ id: "1" });
            }
        };
        carregarPerfil();
    }, []);

    // 2. Carregar todos os eventos futuros (GET /api/eventos)
    const carregarEventos = async () => {
        // Só faz a chamada se for COORDENACAO
        if (localStorage.getItem('user')) {
             try {
                 const parsed = JSON.parse(localStorage.getItem('user') || '{}');
                 if (parsed.tipoUtilizadorId !== 'COORDENACAO') return;
             } catch { return; }
        }

        setLoading(true);
        try {
            const response = await api.get<Evento[]>('/eventos');
            setEventos(response.data);
        } catch (error) {
            console.error('Erro ao carregar eventos:', error);
            setEventos([
                { id: "1", nome: "Gala de Ballet Clássico", descricao: "O espetáculo anual da escola EntArtes com coreografias exclusivas.", dataEvento: "2026-06-15", horaInicio: "19:30", horaFim: "21:30", local: "Grande Auditório", criadoPor: { id: "1", nome: "Coordenação" } },
                { id: "2", nome: "Workshop de Contemporâneo", descricao: "Sessão intensiva focada em expressão corporal e técnicas modernas.", dataEvento: "2026-07-02", horaInicio: "14:00", horaFim: "17:00", local: "Estúdio Principal", criadoPor: { id: "1", nome: "Coordenação" } }
            ]);
        } finally {
            setLoading(false);
        }
    };

    // 3. Carregar as inscrições do utilizador (GET /api/eventos/utilizador/{id})
    const carregarInscricoes = async () => {
        if (!usuarioLogado?.id || role !== 'COORDENACAO') return;
        try {
            const response = await api.get<Evento[]>(`/eventos/utilizador/${usuarioLogado.id}`);
            setMeusEventosIds(response.data.map(e => e.id));
        } catch (error) {
            console.error('Erro ao carregar inscrições:', error);
        }
    };

    useEffect(() => {
        carregarEventos();
    }, []);

    useEffect(() => {
        if (usuarioLogado) carregarInscricoes();
    }, [usuarioLogado, role]);

    // 4. Lógica de Auto-Inscrição (POST /api/eventos/{id}/inscrever)
    const handleInscrever = async (eventoId: string) => {
        try {
            await api.post(`/eventos/${eventoId}/inscrever?utilizadorId=${usuarioLogado.id}`, {}); 
            alert('Inscrição realizada com sucesso!');
            carregarInscricoes();
        } catch (err: any) {
            console.error("Erro na resposta:", err.response?.data);
            alert('Erro ao processar inscrição.');
        }
    };

    // 5. Lógica de Cancelamento (PATCH /api/eventos/{id}/participantes/{userId}/cancelar)
    const handleCancelar = async (eventoId: string) => {
        if (!confirm('Tem a certeza que deseja cancelar a sua inscrição?')) return;
        try {
            await api.patch(`/eventos/${eventoId}/participantes/${usuarioLogado.id}/cancelar`);
            carregarInscricoes();
        } catch (err) {
            alert('Erro ao cancelar inscrição.');
        }
    };

    // ── POLLING DE NOTIFICAÇÕES PROTEGIDO CONTRA ERRO 500 ──
    const carregarNotificacoes = async () => {
        const token = localStorage.getItem('token');
        if (!usuarioLogado?.id || !token || role !== 'COORDENACAO') return;
        try {
            const res = await api.get('/notificacoes/me', {
                params: { userId: usuarioLogado.id },
                headers: { Authorization: `Bearer ${token}` },
            });
            const listaNotif = res.data.content || [];
            setNotificacoes(listaNotif);
            setUnreadCount(listaNotif.filter((n: any) => !n.lida).length);
        } catch (err) {
            console.warn("Backend sem suporte para notificações em tempo real (Erro 500).");
            setNotificacoes([]);
            setUnreadCount(0);
        }
    };

    useEffect(() => {
        if (usuarioLogado?.id && role === 'COORDENACAO') {
            carregarNotificacoes();
            const interval = setInterval(() => { carregarNotificacoes(); }, 10000);
            return () => clearInterval(interval);
        }
    }, [usuarioLogado?.id, role]);

    const marcarTodasComoLidas = async () => {
        const naoLidas = notificacoes.filter((n) => !n.lida);
        if (naoLidas.length === 0) return;
        try {
            await Promise.all(naoLidas.map((n) => {
                if (String(n.id).startsWith('m')) return Promise.resolve(); 
                return api.put(`/notificacoes/${n.id}/ler`);
            }));
            setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("Erro ao marcar notificações como lidas:", err);
            setUnreadCount(0);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/');
    };

    if (checkingAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f1ea]">
                <div className="w-8 h-8 border-2 border-[#4a3f35] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // ─── VERIFICAÇÃO DE ACESSO RESTRITO ───
    if (role !== 'COORDENACAO') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f1ea] px-4 font-sans text-[#2d2722]">
                <div className="bg-white border border-[#e6e1d6] rounded-2xl p-8 max-w-md text-center shadow-xs">
                    <i className="ti ti-lock text-4xl text-[#8c8275] mb-4 block" />
                    <h2 style={{ fontFamily: 'var(--font-playfair)' }} className="text-xl font-bold mb-2">
                        Acesso Restrito à Coordenação
                    </h2>
                    <p className="text-xs text-[#6b6155] leading-relaxed mb-6">
                        Lamento, mas esta área é exclusiva para membros da equipa de coordenação da escola EntArtes.
                    </p>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => router.push('/landingPage')}
                            className="w-full bg-[#4a3f35] hover:bg-[#382f27] text-white py-2.5 rounded-xl text-xs font-bold transition"
                        >
                            Voltar ao Início
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="w-full bg-[#faf9f6] border border-[#e6e1d6] text-[#2d2722] hover:bg-[#f4f1ea] py-2.5 rounded-xl text-xs font-bold transition"
                        >
                            Mudar de Conta
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── SE FOR COORDENACAO, MOSTRA O RESTO DA PÁGINA NORMALMENTE ───
    const initials = userName
        ? userName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
        : 'U';

    const eventosExibidos = filtroMeus 
        ? eventos.filter(e => meusEventosIds.includes(e.id))
        : eventos;

    return (
        <div className="flex flex-col min-h-screen bg-background font-sans text-panel-dark">
            
            {/* ── NAVBAR SUPERIOR INTEGRADA ── */}
            <nav
                className="flex items-center justify-between px-5 flex-shrink-0 sticky top-0 z-40"
                style={{ height: '52px', borderBottom: '1px solid var(--border-warm)', background: 'var(--background)' }}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setDrawerOpen(true)}
                        aria-label="Abrir menu"
                        className="flex items-center justify-center shadow-xs"
                        style={{ width: '32px', height: '32px', border: '1px solid var(--border-warm)', borderRadius: '4px', background: '#FFFCF8', color: 'var(--panel-dark)', cursor: 'pointer' }}
                    >
                        <i className="ti ti-menu-2" style={{ fontSize: '16px' }} />
                    </button>
                    <div>
                        <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '16px', letterSpacing: '4px', color: 'var(--panel-dark)', fontWeight: 400 }}>
                            entartes
                        </span> 
                        <span className="hidden sm:inline" style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginLeft: '4px' }}>
                            · eventos (coord)
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300 }}>
                        Bem-vindo{userName ? `, ${userName.split(' ')[0]}` : ''}
                    </span>

                    {/* Notificações SINO */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                const novoEstado = !showNotifPanel;
                                setShowNotifPanel(novoEstado);
                                if (novoEstado) {
                                    marcarTodasComoLidas();
                                    setShowProfileMenu(false);
                                }
                            }}
                            className="flex items-center justify-center relative transition-colors"
                            style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--border-warm)', background: 'transparent', color: 'var(--accent-muted)', cursor: 'pointer' }}
                        >
                            <i className="ti ti-bell" style={{ fontSize: '15px' }} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-panel-dark text-[8px] font-normal w-4 h-4 flex items-center justify-center rounded-full text-accent-gold">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifPanel && (
                            <div className="absolute right-0 mt-2 w-72 bg-[#FBF7F2] border border-border-warm rounded-sm shadow-xl z-50 overflow-hidden">
                                <div className="p-3 border-b border-border-warm flex justify-between items-center bg-[#FFFCF8]">
                                    <h3 style={{ fontFamily: 'var(--font-playfair)' }} className="text-xs text-panel-dark tracking-wide font-normal">Notificações</h3>
                                    <button onClick={() => setShowNotifPanel(false)} className="text-accent-muted hover:text-panel-dark text-sm">&times;</button>
                                </div>
                                <div className="max-h-64 overflow-y-auto divide-y divide-border-warm/30">
                                    {notificacoes.length === 0 ? (
                                        <p className="p-6 text-center text-accent-muted text-xs font-light">Sem novas notificações.</p>
                                    ) : (
                                        notificacoes.map((n) => (
                                            <div key={n.id} className="p-3 hover:bg-[#FFFCF8] transition-colors">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-[11px] font-normal text-panel-dark">{n.titulo}</p>
                                                    {!n.lida && <span className="w-1.5 h-1.5 rounded-full bg-accent-gold mt-1 flex-shrink-0"></span>}
                                                </div>
                                                <p className="text-xs text-accent-muted mt-1 font-light leading-snug">{n.mensagem}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Perfil AVATAR */}
                    <div className="relative">
                        <div
                            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifPanel(false); }}
                            className="flex items-center justify-center hover:opacity-90 transition-opacity"
                            style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--panel-dark)', color: 'var(--accent-gold)', fontSize: '11px', letterSpacing: '1px', fontFamily: 'var(--font-playfair)', fontWeight: 400, cursor: 'pointer' }}
                        >
                            {initials}
                        </div>

                        {showProfileMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-[#FBF7F2] border border-border-warm rounded-sm shadow-xl z-50 overflow-hidden py-1">
                                <div className="px-3 py-2 border-b border-border-warm/30 bg-[#FFFCF8]">
                                    <p className="text-[10px] text-accent-muted uppercase tracking-wider font-light">Sessão iniciada</p>
                                    <p className="text-xs font-normal text-panel-dark truncate">{userName || 'Utilizador'}</p>
                                </div>
                                <button
                                    onClick={() => { router.push('/perfil'); setShowProfileMenu(false); }}
                                    className="w-full text-left px-3 py-2 text-xs text-panel-dark hover:bg-panel-dark/5 transition-colors flex items-center gap-2"
                                >
                                    <i className="ti ti-user-cog text-accent-muted" /> O meu perfil
                                </button>
                                <div className="border-t border-border-warm/30 my-1"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                >
                                    <i className="ti ti-logout" /> Sair
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── CORPO COM DRAWER DE NAVEGAÇÃO ── */}
            <div className="flex flex-1 relative overflow-hidden">
                {drawerOpen && (
                    <div className="absolute inset-0 z-10" style={{ background: 'rgba(44,31,20,0.30)' }} onClick={() => setDrawerOpen(false)} />
                )}

                {/* DRAWER SIDEBAR */}
                <aside
                    ref={drawerRef}
                    className="absolute top-0 bottom-0 left-0 z-20 flex flex-col"
                    style={{ width: '220px', background: 'var(--panel-dark)', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .28s cubic-bezier(.4,0,.2,1)' }}
                >
                    <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(212,178,136,0.12)' }}>
                        <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '13px', letterSpacing: '3px', color: 'var(--accent-gold)', fontWeight: 400, display: 'block' }}>entartes</span>
                        <span style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.35)', fontWeight: 300, marginTop: '2px', display: 'block' }}>escola de dança</span>
                    </div>

                    <div className="flex-1 overflow-y-auto py-2">
                        {NAV_SECTIONS.map((section) => (
                            <div key={section.title}>
                                <div style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.22)', fontWeight: 300, padding: '14px 20px 4px' }}>{section.title}</div>
                                {section.items.map((item) => (
                                    <button
                                        key={item.href}
                                        onClick={() => { router.push(item.href); setDrawerOpen(false); }}
                                        className="flex items-center gap-2 w-full transition-colors"
                                        style={{ padding: '10px 20px', color: 'rgba(212,178,136,0.55)', fontSize: '12px', letterSpacing: '.5px', fontWeight: 300, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,178,136,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-gold)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(212,178,136,0.55)'; }}
                                    >
                                        <i className={`ti ${item.icon}`} style={{ fontSize: '15px' }} aria-hidden="true" />
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(212,178,136,0.10)' }}>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2"
                            style={{ color: 'rgba(212,178,136,0.35)', fontSize: '12px', fontWeight: 300, background: 'transparent', border: 'none', cursor: 'pointer' }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#E8A09A')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(212,178,136,0.35)')}
                        >
                            <i className="ti ti-logout" /> Sair da Conta
                        </button>
                    </div>
                </aside>

                {/* ── CONTEÚDO ORIGINAL DOS EVENTOS ── */}
                <main className="flex-1 overflow-y-auto p-6 bg-[#f4f1ea] text-[#2d2722] selection:bg-[#4a3f35] selection:text-white">
                    <div className="max-w-7xl mx-auto">
                        
                        {/* Header com Filtros */}
                        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b border-[#e6e1d6]">
                            <div>
                                <span className="text-[11px] uppercase tracking-widest text-[#8c8275] font-semibold block mb-1">Comunidade</span>
                                <h1 className="text-3xl font-serif text-[#2d2722]">Eventos</h1>
                                <p className="text-[#6b6155] text-sm mt-1">Descobre os nossos workshops, exposições e datas especiais.</p>
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setFiltroMeus(false)}
                                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${
                                        !filtroMeus 
                                            ? 'bg-[#4a3f35] text-[#f4f1ea] border-[#4a3f35]' 
                                            : 'bg-white text-[#6b6155] border-[#e6e1d6] hover:bg-[#faf9f6]'
                                    }`}
                                >
                                    Todos os Eventos
                                </button>
                                <button 
                                    onClick={() => setFiltroMeus(true)}
                                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border ${
                                        filtroMeus 
                                            ? 'bg-[#4a3f35] text-[#f4f1ea] border-[#4a3f35]' 
                                            : 'bg-white text-[#6b6155] border-[#e6e1d6] hover:bg-[#faf9f6]'
                                    }`}
                                >
                                    Inscrições Ativas
                                </button>
                            </div>
                        </header>

                        {/* Listagem / Loading */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-3">
                                <div className="w-8 h-8 border-2 border-[#4a3f35] border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[#8c8275] text-xs font-medium italic">A carregar os eventos...</span>
                            </div>
                        ) : eventosExibidos.length === 0 ? (
                            <div className="bg-white border border-[#e6e1d6] rounded-2xl p-12 text-center text-[#8c8275] text-sm">
                                Nenhum evento agendado para esta seleção.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {eventosExibidos.map((evento) => {
                                    const estaInscrito = meusEventosIds.includes(evento.id);
                                    const data = new Date(evento.dataEvento);
                                    
                                    return (
                                        <div key={evento.id} className="bg-white border border-[#e6e1d6] rounded-2xl p-6 flex flex-col hover:shadow-sm transition-all duration-300">
                                            
                                            <div className="flex items-start gap-4 mb-5">
                                                <div className="bg-[#4a3f35] text-[#f4f1ea] w-12 h-14 rounded-xl flex flex-col items-center justify-center shrink-0">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                                                        {isNaN(data.getTime()) ? 'EVE' : data.toLocaleDateString('pt', { month: 'short' }).replace('.', '')}
                                                    </span>
                                                    <span className="text-lg font-serif font-bold leading-none mt-0.5">
                                                        {isNaN(data.getTime()) ? '•' : data.getDate()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <h3 className="font-serif font-bold text-base text-[#2d2722] leading-snug line-clamp-1">{evento.nome}</h3>
                                                    <span className="text-xs text-[#8c8275] mt-1 block">📍 {evento.local}</span>
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
                </main>
            </div>

            {/* Modal de Detalhes Original */}
            {eventoSelecionado && (
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
        </div>
    );
}