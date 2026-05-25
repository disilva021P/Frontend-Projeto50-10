'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ─── Tipos ────────────────────────────────────────────────────────────────────
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

// Seg → Sáb (6 dias)
const DIAS_ABREV = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function diaParaIdx(dia: string | undefined): number {
  if (!dia) return -1;
  const mapa: Record<string, number> = {
    SEGUNDA: 0, 'SEGUNDA-FEIRA': 0,
    'TERÇA': 1, TERCA: 1, 'TERÇA-FEIRA': 1,
    QUARTA: 2, 'QUARTA-FEIRA': 2,
    QUINTA: 3, 'QUINTA-FEIRA': 3,
    SEXTA: 4, 'SEXTA-FEIRA': 4,
    'SÁBADO': 5, SABADO: 5,
  };
  return mapa[dia.toUpperCase()] ?? -1;
}

function getIntervaloSemana(): string {
  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const distanciaParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + distanciaParaSegunda);
  const sabado = new Date(segunda);
  sabado.setDate(segunda.getDate() + 5);
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const diaSeg = segunda.getDate();
  const diaSab = sabado.getDate();
  const mesSeg = meses[segunda.getMonth()];
  const mesSab = meses[sabado.getMonth()];
  if (mesSeg !== mesSab) return `${diaSeg} de ${mesSeg} a ${diaSab} de ${mesSab}`;
  return `${diaSeg} a ${diaSab} de ${mesSab}`;
}

// ─── Itens da sidebar (com ícone e label para os cards afixados) ──────────────
const NAV_SECTIONS: {
  title: string;
  items: { icon: string; label: string; href: string; sub: string }[];
}[] = [
  {
    title: 'Principal',
    items: [
      { icon: 'ti-home',         label: 'Início',      href: '/landingPage', sub: 'Painel geral' },
      { icon: 'ti-calendar',     label: 'Horários',    href: '/horarios',    sub: 'Aulas e sessões' },
      { icon: 'ti-credit-card',  label: 'Pagamentos',  href: '/pagamentos',  sub: 'Recibos e mensalidades' },
    ],
  },
  {
    title: 'Comunidade',
    items: [
      { icon: 'ti-mail',         label: 'Mensagens',   href: '/mensagens',   sub: 'Comunicação com a escola' },
      { icon: 'ti-star',         label: 'Eventos',     href: '/eventos',     sub: 'Espetáculos e datas especiais' },
      { icon: 'ti-shopping-bag', label: 'Marketplace', href: '/marketplace', sub: 'Material e equipamentos' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { icon: 'ti-chart-bar', label: 'Gestão de Faltas', href: '/faltas', sub: 'Presenças e justificações' },
    ],
  },
];

// ─── Horário semanal ──────────────────────────────────────────────────────────
function HorarioResumo({ role }: { role: Role }) {
  const [aulas, setAulas] = useState<AulaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [intervaloTexto, setIntervaloTexto] = useState('');
  const router = useRouter();

  useEffect(() => {
    setIntervaloTexto(getIntervaloSemana());
    const token = localStorage.getItem('token') ?? '';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const endpoint =
      role === 'PROFESSOR'
        ? `${BASE_URL}/api/horario/professor/horario?offset=0`
        : `${BASE_URL}/api/horario/semana?offset=0`;
    fetch(endpoint, { headers })
      .then(res => { if (!res.ok) throw new Error('Erro'); return res.json(); })
      .then((data: AulaDto[]) => setAulas(data ?? []))
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false));
  }, [role]);

  // Agrupa por dia (0=Seg … 5=Sáb)
  const aulasPorDia: AulaDto[][] = Array.from({ length: 6 }, () => []);
  aulas.forEach(a => {
    const idx = diaParaIdx(a.diaSemana);
    if (idx >= 0 && idx < 6) aulasPorDia[idx].push(a);
  });

  const colunas = [0, 1, 2, 3, 4, 5]; // sempre Seg→Sáb

  if (loading) return (
    <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderRadius: '8px', padding: '22px', marginBottom: '20px', minHeight: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-warm)', borderTopColor: 'var(--accent-gold)', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderRadius: '8px', padding: '22px', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px', background: 'var(--panel-dark)', borderRadius: '8px 0 0 8px' }} />
      <p style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>
        Esta semana {intervaloTexto ? `· ${intervaloTexto}` : ''}
      </p>
      <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '18px' }}>
        Os teus horários
      </h2>

      {erro ? (
        <p style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300 }}>Não foi possível carregar os horários.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
          {colunas.map(idx => (
            <div key={idx}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 400, marginBottom: '6px', paddingBottom: '5px', borderBottom: '1px solid var(--border-warm)' }}>
                {DIAS_ABREV[idx]}
              </div>
              {aulasPorDia[idx].length === 0 ? (
                <div style={{ background: 'rgba(160,133,96,0.05)', border: '1px dashed var(--border-warm)', borderRadius: '6px', padding: '10px', opacity: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '56px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--border-warm)' }}>—</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {aulasPorDia[idx].map(a => (
                    <div key={a.id} style={{ background: '#fff', border: '1px solid var(--border-warm)', borderLeft: '3px solid var(--accent-gold)', borderRadius: '6px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--accent-gold)', fontWeight: 400, letterSpacing: '0.3px', marginBottom: '3px' }}>
                        {a.horaInicio}{a.horaFim ? ` – ${a.horaFim}` : ''}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--panel-dark)', fontWeight: 400, lineHeight: 1.3 }}>
                        {a.turma?.nome ?? a.titulo ?? 'Aula'}
                      </div>
                      {a.professor && <div style={{ fontSize: '10px', color: 'var(--accent-muted)', marginTop: '3px', fontWeight: 300 }}>{a.professor.nome}</div>}
                      {a.estudio && <div style={{ fontSize: '10px', color: 'var(--accent-muted)', marginTop: '1px', fontWeight: 300 }}>{a.estudio.nome}</div>}
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
        <button onClick={() => router.push('/horarios')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--accent-muted)', letterSpacing: '.5px', fontWeight: 400 }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--panel-dark)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--accent-muted)')}>
          Ver horário completo →
        </button>
      </div>
    </div>
  );
}

// ─── Tema dos cards — paleta harmoniosa quente/terra ─────────────────────────
const CARD_THEMES: Record<string, {
  imageQuery: string;   // keyword para Unsplash
  overlay: string;      // gradiente sobre a imagem
  tint: string;         // cor suave do fundo fallback
  accent: string;       // cor do texto/ícone destaque
  pill: string;         // fundo da pill de label
}> = {
  '/horarios':    {
    imageQuery: 'clock schedule calendar minimal',
    overlay: 'linear-gradient(160deg, rgba(44,28,10,0.55) 0%, rgba(120,80,30,0.72) 100%)',
    tint: '#3D2608', accent: '#F5D9A8', pill: 'rgba(245,217,168,0.15)',
  },
  '/pagamentos':  {
    imageQuery: 'gold coins finance minimal',
    overlay: 'linear-gradient(160deg, rgba(30,22,10,0.58) 0%, rgba(100,72,20,0.75) 100%)',
    tint: '#2E1F06', accent: '#E8C97A', pill: 'rgba(232,201,122,0.15)',
  },
  '/mensagens':   {
    imageQuery: 'letter envelope handwritten paper',
    overlay: 'linear-gradient(160deg, rgba(40,28,15,0.55) 0%, rgba(110,78,32,0.72) 100%)',
    tint: '#372210', accent: '#F0D4A4', pill: 'rgba(240,212,164,0.15)',
  },
  '/eventos':     {
    imageQuery: 'stage spotlight performance dance theatre',
    overlay: 'linear-gradient(160deg, rgba(35,20,8,0.60) 0%, rgba(95,60,20,0.78) 100%)',
    tint: '#2C1A07', accent: '#ECC68A', pill: 'rgba(236,198,138,0.15)',
  },
  '/marketplace': {
    imageQuery: 'ballet shoes pointe shoe dance accessories',
    overlay: 'linear-gradient(160deg, rgba(45,30,12,0.55) 0%, rgba(115,76,28,0.74) 100%)',
    tint: '#3A2208', accent: '#F2D09E', pill: 'rgba(242,208,158,0.15)',
  },
  '/faltas':      {
    imageQuery: 'notebook attendance list pen paper',
    overlay: 'linear-gradient(160deg, rgba(38,25,10,0.58) 0%, rgba(105,68,22,0.75) 100%)',
    tint: '#322010', accent: '#EDCA90', pill: 'rgba(237,202,144,0.15)',
  },
};

const DEFAULT_THEME = {
  imageQuery: 'elegant minimal texture',
  overlay: 'linear-gradient(160deg, rgba(44,31,14,0.55) 0%, rgba(110,75,28,0.72) 100%)',
  tint: '#352210', accent: '#F0D0A0', pill: 'rgba(240,208,160,0.15)',
};

function unsplashUrl(query: string) {
  return `https://source.unsplash.com/400x260/?${encodeURIComponent(query)}`;
}

// ─── Secção de atalhos afixados ───────────────────────────────────────────────
function AtalhoAfixado({
  item,
  onDesafixar,
}: {
  item: { icon: string; label: string; href: string; sub: string };
  onDesafixar: () => void;
}) {
  const router = useRouter();
  const theme = CARD_THEMES[item.href] ?? DEFAULT_THEME;
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const imgSrc = unsplashUrl(theme.imageQuery);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        height: '180px',
        cursor: 'pointer',
        boxShadow: hovered
          ? '0 8px 32px rgba(44,28,10,0.22), 0 2px 8px rgba(44,28,10,0.12)'
          : '0 2px 10px rgba(44,28,10,0.10)',
        transform: hovered ? 'translateY(-3px) scale(1.01)' : 'translateY(0) scale(1)',
        transition: 'transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s cubic-bezier(.4,0,.2,1)',
        border: `1px solid ${hovered ? 'rgba(245,217,168,0.30)' : 'rgba(180,140,80,0.18)'}`,
      }}
      onClick={() => router.push(item.href)}
    >
      {/* Imagem de fundo com blur */}
      <img
        src={imgSrc}
        alt=""
        aria-hidden="true"
        onLoad={() => setImgLoaded(true)}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          filter: `blur(${hovered ? '1px' : '2.5px'}) saturate(0.75) brightness(0.82)`,
          transform: hovered ? 'scale(1.06)' : 'scale(1.02)',
          transition: 'filter .35s ease, transform .35s ease',
          opacity: imgLoaded ? 1 : 0,
          transitionProperty: 'filter, transform, opacity',
        }}
      />

      {/* Fallback tint enquanto imagem carrega */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme.tint,
        opacity: imgLoaded ? 0 : 1,
        transition: 'opacity .4s',
      }} />

      {/* Overlay de cor quente */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme.overlay,
        opacity: hovered ? 0.88 : 0.80,
        transition: 'opacity .3s',
      }} />

      {/* Conteúdo */}
      <div style={{
        position: 'absolute', inset: 0,
        padding: '18px 16px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        {/* Topo: ícone + botão desafixar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: theme.pill,
            backdropFilter: 'blur(6px)',
            border: `1px solid ${theme.accent}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.accent,
          }}>
            <i className={`ti ${item.icon}`} style={{ fontSize: '17px' }} aria-hidden="true" />
          </div>

          {/* Botão desafixar — Estilizado com inclinação e risco diagonal */}
          <button
            onClick={e => { e.stopPropagation(); onDesafixar(); }}
            title="Desafixar"
            style={{
              background: 'rgba(255, 255, 255, 0.16)',
              backdropFilter: 'blur(6px)',
              border: 'none', 
              cursor: 'pointer',
              color: theme.accent,
              padding: '8px 9px',
              borderRadius: '6px',
              transition: 'background .2s, transform .2s',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
            }}
            onMouseEnter={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.28)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.16)'; }}>
            
            <div style={{ position: 'relative', width: '16px', height: '16px', display: 'flex', alignItems: 'center'}}>
              
              {}
              <i className="ti ti-pin" style={{ 
                fontSize: '15px', 
                fontWeight: 'bold', 
                display: 'block',
                transformOrigin: 'center'
              }} />
              
              {/* Linha diagonal oposta que corta explicitamente o pino ao meio (-45 graus) */}
              <div style={{
                position: 'absolute',
                top: '45%',
                left: '1px',
                right: '1px',
                height: '2px',
                background: theme.accent,
                transform: 'translateY(-50%) rotate(45deg)',
                transformOrigin: 'center',
                boxShadow: '0 0 2px rgba(0,0,0,0.4)',
                borderRadius: '2px',
                pointerEvents: 'none'
              }} />
            </div>
          </button>
        </div>

        {/* Baixo: label + sub */}
        <div>
          <div style={{
            fontSize: '15px', color: '#FFF8EE', fontWeight: 500,
            letterSpacing: '.2px', marginBottom: '4px',
            textShadow: '0 1px 4px rgba(0,0,0,0.35)',
          }}>{item.label}</div>
          <div style={{
            fontSize: '11px', color: theme.accent,
            fontWeight: 300, lineHeight: 1.4, opacity: 0.85,
            letterSpacing: '.2px',
          }}>{item.sub}</div>
        </div>
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
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
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
    const pins = localStorage.getItem('pinnedItems');
    if (pins) {
      try { setPinnedHrefs(JSON.parse(pins)); } catch { /* ignora */ }
    }
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const togglePin = (href: string) => {
    setPinnedHrefs(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      localStorage.setItem('pinnedItems', JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const todosItens = NAV_SECTIONS.flatMap(s => s.items).filter(i => i.href !== '/landingPage');
  const itensPinned = todosItens.filter(i => pinnedHrefs.includes(i.href));

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pin-btn { opacity: 0; transition: opacity .15s, color .15s; }
        .nav-item:hover .pin-btn { opacity: 1; }
        .pin-btn.is-pinned { opacity: 1 !important; }
      `}</style>
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
            style={{ width: '240px', background: 'var(--panel-dark)', transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .28s cubic-bezier(.4,0,.2,1)' }}>
            <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(212,178,136,0.12)' }}>
              <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '13px', letterSpacing: '3px', color: 'var(--accent-gold)', fontWeight: 400, display: 'block' }}>entartes</span>
              <span style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.35)', fontWeight: 300, marginTop: '2px', display: 'block' }}>escola de dança</span>
            </div>

            {/* Hint de afixar */}
            <div style={{ margin: '12px 16px 4px', padding: '8px 10px', background: 'rgba(212,178,136,0.06)', borderRadius: '6px', border: '1px solid rgba(212,178,136,0.10)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <i className="ti ti-pin" style={{ fontSize: '12px', color: 'var(--accent-gold)' }} />
                <span style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.55)', fontWeight: 400 }}>Atalhos rápidos</span>
              </div>
              <p style={{ fontSize: '10px', color: 'rgba(212,178,136,0.40)', fontWeight: 300, lineHeight: 1.5, margin: 0 }}>
                Clica no <i className="ti ti-pin" style={{ fontSize: '10px' }} /> para afixar secções no painel de início.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {NAV_SECTIONS.map(section => (
                <div key={section.title}>
                  <div style={{ fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(212,178,136,0.22)', fontWeight: 300, padding: '14px 20px 4px' }}>
                    {section.title}
                  </div>
                  {section.items.map(item => {
                    const isPinned = pinnedHrefs.includes(item.href);
                    const canPin = item.href !== '/landingPage';
                    return (
                      <div key={item.href} className="nav-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                          onClick={() => { router.push(item.href); setDrawerOpen(false); }}
                          className="flex items-center gap-2"
                          style={{ flex: 1, padding: '10px 20px', color: 'rgba(212,178,136,0.55)', fontSize: '12px', letterSpacing: '.5px', fontWeight: 300, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(212,178,136,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-gold)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(212,178,136,0.55)'; }}>
                          <i className={`ti ${item.icon}`} style={{ fontSize: '15px' }} aria-hidden="true" />
                          {item.label}
                        </button>
                        {canPin && (
                          <button
                            onClick={() => togglePin(item.href)}
                            title={isPinned ? 'Desafixar' : 'Afixar no painel'}
                            className={`pin-btn${isPinned ? ' is-pinned' : ''}`}
                            style={{ padding: '10px 12px 10px 0', background: 'transparent', border: 'none', cursor: 'pointer', color: isPinned ? 'var(--accent-gold)' : 'rgba(212,178,136,0.35)', transition: 'color .15s' }}>
                            <i className={isPinned ? 'ti ti-pin' : 'ti ti-pin'} style={{ fontSize: '13px' }} />
                          </button>
                        )}
                      </div>
                    );
                  })}
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

            {/* ── ATALHOS AFIXADOS ── */}
            {itensPinned.length > 0 ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <i className="ti ti-pin" style={{ fontSize: '12px', color: 'var(--accent-muted)', display: 'inline-block', transform: 'rotate(45deg)' }} />
                  <p style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300 }}>
                    Os teus atalhos
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  {itensPinned.map(item => (
                    <AtalhoAfixado
                      key={item.href}
                      item={item}
                      onDesafixar={() => togglePin(item.href)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '36px 24px', textAlign: 'center',
                border: '1px dashed var(--border-warm)', borderRadius: '8px',
                background: 'rgba(160,133,96,0.03)',
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(160,133,96,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <i className="ti ti-pin" style={{ fontSize: '20px', color: 'var(--accent-muted)' }} />
                </div>
                <p style={{ fontSize: '14px', color: 'var(--panel-dark)', fontWeight: 400, fontFamily: 'var(--font-playfair)', marginBottom: '8px' }}>
                  O teu espaço, à tua medida
                </p>
                <p style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300, lineHeight: 1.7, maxWidth: '320px' }}>
                  Abre o menu lateral e clica no <i className="ti ti-pin" style={{ fontSize: '12px' }} /> ao lado de qualquer secção para a afixar aqui como atalho rápido.
                </p>
                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{ marginTop: '18px', padding: '8px 18px', background: 'transparent', border: '1px solid var(--border-warm)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--panel-dark)', letterSpacing: '.5px', fontWeight: 300, transition: 'border-color .15s, color .15s' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--accent-muted)'; el.style.color = 'var(--accent-muted)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-warm)'; el.style.color = 'var(--panel-dark)'; }}>
                  Abrir menu
                </button>
              </div>
            )}

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