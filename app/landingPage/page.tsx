'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// ─── Tipos (extraídos da página de horários) ──────────────────────────────────
type Role = 'ALUNO' | 'COORDENACAO' | 'PROFESSOR' | 'ENCARREGADO';

interface ResumoDto { id: string; nome: string }
interface TurmaDto  { id: string; nome: string; modalidade?: ResumoDto }
interface EstudioDto{ id: string; nome: string }
interface AulaDto   {
  id: string; titulo?: string; dataAula?: string;
  horaInicio?: string; horaFim?: string;
  turma?: TurmaDto; estudio?: EstudioDto;
  professor?: ResumoDto; diaSemana?: string;
}

const BASE_URL = 'http://localhost:8080';

// ─── Dias abreviados para o resumo semanal ────────────────────────────────────
const DIAS_ABREV = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function diaParaIdx(dia: string | undefined): number {
  if (!dia) return -1;
  const mapa: Record<string, number> = {
    SEGUNDA: 0, 'SEGUNDA-FEIRA': 0,
    'TERÇA': 1, TERCA: 1, 'TERÇA-FEIRA': 1,
    QUARTA: 2, 'QUARTA-FEIRA': 2,
    QUINTA: 3, 'QUINTA-FEIRA': 3,
    SEXTA: 4, 'SEXTA-FEIRA': 4,
    'SÁBADO': 5, SABADO: 5,
    DOMINGO: 6,
  };
  return mapa[dia.toUpperCase()] ?? -1;
}

// ─── Função Utilitária para calcular o intervalo da semana dinamicamente ───
function getIntervaloSemana(): string {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0 (Dom) a 6 (Sáb)
  
  // Ajustar para que a semana comece na Segunda-feira (1) e termine no Domingo (7)
  const distanciaParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + distanciaParaSegunda);
  
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const diaSeg = segunda.getDate();
  const diaDom = domingo.getDate();
  const mesSeg = meses[segunda.getMonth()];
  const mesDom = meses[domingo.getMonth()];

  // Se a semana mudar de mês (ex: 28 de abril a 4 de maio)
  if (mesSeg !== mesDom) {
    return `${diaSeg} de ${mesSeg} a ${diaDom} de ${mesDom}`;
  }

  // Se for no mesmo mês (ex: 18 a 24 de maio)
  return `${diaSeg} a ${diaDom} de ${mesDom}`;
}

// ─── Estrutura do menu lateral ────────────────────────────────────────────────
const NAV_SECTIONS: { title: string; items: { icon: string; label: string; href: string }[] }[] = [
  {
    title: 'Principal',
    items: [
      { icon: 'ti-home',         label: 'Início',      href: '/landingPage' },
      { icon: 'ti-calendar',     label: 'Horários',    href: '/horarios' },
      { icon: 'ti-credit-card', label: 'Pagamentos',  href: '/pagamentos' },
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
      { icon: 'ti-chart-bar', label: 'Gestão de Faltas', href: '/faltas' },
    ],
  },
];

const CARDS = [
  { icon: 'ti-credit-card', title: 'Pagamentos',       sub: 'Recibos e mensalidades',      href: '/pagamentos' },
  { icon: 'ti-mail',         title: 'Mensagens',        sub: 'Comunicação com a escola',      href: '/mensagens' },
  { icon: 'ti-chart-bar',    title: 'Gestão de Faltas', sub: 'Presenças e justificações',     href: '/faltas' },
  { icon: 'ti-star',         title: 'Eventos',          sub: 'Espetáculos e datas especiais', href: '/eventos' },
  { icon: 'ti-shopping-bag', title: 'Marketplace',      sub: 'Material e equipamentos',       href: '/marketplace' },
];

// ─── Componente de horário semanal (resumo, sem navegação) ────────────────────
function HorarioResumo({ role }: { role: Role }) {
  const [aulas, setAulas] = useState<AulaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const router = useRouter();
  
  // Guardar o texto do intervalo para evitar problemas de hidratação no SSR
  const [intervaloTexto, setIntervaloTexto] = useState('');

  useEffect(() => {
    setIntervaloTexto(getIntervaloSemana());

    const token = localStorage.getItem('token') ?? '';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const endpoint =
      role === 'PROFESSOR'
        ? `${BASE_URL}/api/horario/professor/horario?offset=0`
        : `${BASE_URL}/api/horario/semana?offset=0`;

    fetch(endpoint, { headers })
      .then(res => {
        if (!res.ok) throw new Error('Erro ao carregar horário');
        return res.json();
      })
      .then((data: AulaDto[]) => setAulas(data ?? []))
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [role]);

  // Agrupar por dia da semana
  const aulasPorDia: AulaDto[][] = Array.from({ length: 7 }, () => []);
  aulas.forEach(a => {
    const idx = diaParaIdx(a.diaSemana);
    if (idx >= 0) aulasPorDia[idx].push(a);
  });

  const diasComAulas = aulasPorDia
    .map((slots, idx) => ({ idx, slots }))
    .filter(d => d.slots.length > 0);

  const diasParaMostrar = diasComAulas.length > 0
    ? diasComAulas.slice(0, 5)
    : [0, 1, 2, 3, 4].map(idx => ({ idx, slots: [] as AulaDto[] }));

  if (loading) {
    return (
      <div
        style={{
          background: '#FBF7F2', border: '1px solid var(--border-warm)', borderRadius: '8px',
          padding: '22px', marginBottom: '20px', minHeight: '120px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-warm)', borderTopColor: 'var(--accent-gold)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#FBF7F2',
        border: '1px solid var(--border-warm)',
        borderRadius: '8px',
        padding: '22px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px', background: 'var(--panel-dark)', borderRadius: '8px 0 0 8px' }} />

      {/* Alterado aqui: Mostra "Esta semana · 18 a 24 de maio" dinamicamente */}
      <p style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>
        Esta semana {intervaloTexto ? `· ${intervaloTexto}` : ''}
      </p>
      <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '18px' }}>
        Os teus horários
      </h2>

      {erro ? (
        <p style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300 }}>
          Não foi possível carregar os horários.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${diasParaMostrar.length}, 1fr)`, gap: '10px' }}>
          {diasParaMostrar.map(({ idx, slots }) => (
            <div key={idx}>
              <div style={{
                fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase',
                color: 'var(--accent-muted)', fontWeight: 400, marginBottom: '6px',
                paddingBottom: '5px', borderBottom: '1px solid var(--border-warm)',
              }}>
                {DIAS_ABREV[idx]}
              </div>

              {slots.length === 0 ? (
                <div style={{
                  background: 'rgba(160,133,96,0.05)', border: '1px dashed var(--border-warm)',
                  borderRadius: '6px', padding: '10px', opacity: 0.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '56px',
                }}>
                  <div style={{ fontSize: '14px', color: 'var(--border-warm)' }}>—</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {slots.map(a => (
                    <div key={a.id} style={{
                      background: '#fff',
                      border: '1px solid var(--border-warm)',
                      borderLeft: '3px solid var(--accent-gold)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                    }}>
                      <div style={{
                        fontSize: '11px', color: 'var(--accent-gold)',
                        fontWeight: 400, letterSpacing: '0.3px', marginBottom: '3px',
                      }}>
                        {a.horaInicio}
                        {a.horaFim ? ` – ${a.horaFim}` : ''}
                      </div>
                      <div style={{
                        fontSize: '12px', color: 'var(--panel-dark)',
                        fontWeight: 400, lineHeight: 1.3,
                      }}>
                        {a.turma?.nome ?? a.titulo ?? 'Aula'}
                      </div>
                      {a.professor && (
                        <div style={{
                          fontSize: '10px', color: 'var(--accent-muted)',
                          marginTop: '3px', fontWeight: 300,
                        }}>
                          {a.professor.nome}
                        </div>
                      )}
                      {a.estudio && (
                        <div style={{
                          fontSize: '10px', color: 'var(--accent-muted)',
                          marginTop: '1px', fontWeight: 300,
                        }}>
                          {a.estudio.nome}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-warm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: 'var(--accent-muted)', fontWeight: 300 }}>
          {aulas.length} {aulas.length === 1 ? 'aula' : 'aulas'} esta semana
        </span>
        <button
          onClick={() => router.push('/horarios')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent-muted)', letterSpacing: '.5px', fontWeight: 400 }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--panel-dark)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--accent-muted)')}
        >
          Ver horário completo →
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUserName(parsed.nome ?? '');
        setRole(parsed.tipoUtilizadorId as Role ?? null);
      } catch { /* ignora */ }
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="flex flex-col min-h-screen" style={{ background: 'var(--background)', fontFamily: 'var(--font-lato)' }}>

        {/* ── NAVBAR ── */}
        <nav className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: '52px', borderBottom: '1px solid var(--border-warm)', background: 'var(--background)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} aria-label="Abrir menu"
              className="flex items-center justify-center"
              style={{ width: '32px', height: '32px', border: '1px solid var(--border-warm)', borderRadius: '4px', background: '#FFFCF8', color: 'var(--panel-dark)', cursor: 'pointer' }}>
              <i className="ti ti-menu-2" style={{ fontSize: '16px' }} />
            </button>
            <div>
              <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '16px', letterSpacing: '4px', color: 'var(--panel-dark)', fontWeight: 400 }}>entartes</span>
              <span style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginLeft: '4px' }}>· escola de dança</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300 }}>
              Bem-vindo{userName ? `, ${userName.split(' ')[0]}` : ''}
            </span>
            <button aria-label="Notificações" className="flex items-center justify-center"
              style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--border-warm)', background: 'transparent', color: 'var(--accent-muted)', cursor: 'pointer' }}>
              <i className="ti ti-bell" style={{ fontSize: '15px' }} />
            </button>
            <div className="flex items-center justify-center"
              style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--panel-dark)', color: 'var(--accent-gold)', fontSize: '11px', letterSpacing: '1px', fontFamily: 'var(--font-playfair)', fontWeight: 400, cursor: 'pointer' }}>
              {initials}
            </div>
          </div>
        </nav>

        {/* ── BODY ── */}
        <div className="flex flex-1 relative overflow-hidden">

          {/* Overlay */}
          {drawerOpen && (
            <div className="absolute inset-0 z-10" style={{ background: 'rgba(44,31,20,0.30)' }} onClick={() => setDrawerOpen(false)} />
          )}

          {/* ── DRAWER ── */}
          <aside ref={drawerRef} className="absolute top-0 bottom-0 left-0 z-20 flex flex-col"
            style={{ width: '220px', background: 'var(--panel-dark)', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .28s cubic-bezier(.4,0,.2,1)' }}>
            <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(212,178,136,0.12)' }}>
              <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '13px', letterSpacing: '3px', color: 'var(--accent-gold)', fontWeight: 400, display: 'block' }}>entartes</span>
              <span style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.35)', fontWeight: 300, marginTop: '2px', display: 'block' }}>escola de dança</span>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {NAV_SECTIONS.map(section => (
                <div key={section.title}>
                  <div style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.22)', fontWeight: 300, padding: '14px 20px 4px' }}>
                    {section.title}
                  </div>
                  {section.items.map(item => (
                    <button key={item.href} onClick={() => { router.push(item.href); setDrawerOpen(false); }}
                      className="flex items-center gap-2 w-full transition-colors"
                      style={{ padding: '10px 20px', color: 'rgba(212,178,136,0.55)', fontSize: '12px', letterSpacing: '.5px', fontWeight: 300, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,178,136,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-gold)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(212,178,136,0.55)'; }}>
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
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#E8A09A')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(212,178,136,0.35)')}>
                <i className="ti ti-logout" style={{ fontSize: '15px' }} aria-hidden="true" />
                Sair
              </button>
            </div>
          </aside>

          {/* ── CONTEÚDO PRINCIPAL ── */}
          <main className="flex-1 overflow-y-auto" style={{ padding: '28px 28px 40px' }}>

            {/* Cabeçalho */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>
                Painel geral
              </p>
              <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', color: 'var(--panel-dark)', fontWeight: 400 }}>
                Olá{userName ? `, ${userName.split(' ')[0]}` : ''}
              </h1>
            </div>

            {/* ── HORÁRIO DA SEMANA ── */}
            {role && <HorarioResumo role={role} />}

            {/* ── CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              {CARDS.map(card => (
                <button key={card.href} onClick={() => router.push(card.href)}
                  style={{ background: '#FFFCF8', border: '1px solid var(--border-warm)', borderRadius: '8px', padding: '16px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-muted)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-warm)')}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(44,31,20,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', color: 'var(--panel-dark)' }}>
                    <i className={`ti ${card.icon}`} style={{ fontSize: '16px' }} aria-hidden="true" />
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '3px' }}>{card.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--accent-muted)', fontWeight: 300, lineHeight: 1.4 }}>{card.sub}</div>
                </button>
              ))}
            </div>

          </main>
        </div>

        {/* ── FOOTER ── */}
        <footer className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '12px 24px', borderTop: '1px solid var(--border-warm)' }}>
          <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '12px', letterSpacing: '3px', color: 'var(--accent-muted)', fontWeight: 400 }}>entartes</span>
          <span style={{ fontSize: '10px', color: 'var(--accent-muted)', fontWeight: 300 }}>© 2025 Entartes — Escola de Dança</span>
        </footer>

      </div>
    </>
  );
}