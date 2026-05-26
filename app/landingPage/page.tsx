"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

interface ResumoDto {
  id: string;
  nome: string;
}
interface TurmaDto {
  id: string;
  nome: string;
  modalidade?: ResumoDto;
}
interface EstudioDto {
  id: string;
  nome: string;
}
interface AulaDto {
  id: string;
  titulo?: string;
  dataAula?: string;
  horaInicio?: string;
  horaFim?: string;
  turma?: TurmaDto;
  estudio?: EstudioDto;
  professor?: ResumoDto;
  diaSemana?: string;
}

// Interface criada para suportar o novo painel de notificações
interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
}

const BASE_URL = "http://localhost:8080";

// Seg → Sáb (6 dias)
const DIAS_ABREV = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function diaParaIdx(dia: string | undefined): number {
  if (!dia) return -1;
  const mapa: Record<string, number> = {
    SEGUNDA: 0,
    "SEGUNDA-FEIRA": 0,
    TERÇA: 1,
    TERCA: 1,
    "TERÇA-FEIRA": 1,
    QUARTA: 2,
    "QUARTA-FEIRA": 2,
    QUINTA: 3,
    "QUINTA-FEIRA": 3,
    SEXTA: 4,
    "SEXTA-FEIRA": 4,
    SÁBADO: 5,
    SABADO: 5,
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
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const diaSeg = segunda.getDate();
  const diaSab = sabado.getDate();
  const mesSeg = meses[segunda.getMonth()];
  const mesSab = meses[sabado.getMonth()];
  if (mesSeg !== mesSab)
    return `${diaSeg} de ${mesSeg} a ${diaSab} de ${mesSab}`;
  return `${diaSeg} a ${diaSab} de ${mesSab}`;
}

// ─── Itens da sidebar ──────────────────────────────────────────────────────────
const NAV_SECTIONS: {
  title: string;
  items: { icon: string; label: string; href: string; sub: string }[];
}[] = [
  {
    title: "Principal",
    items: [
      {
        icon: "ti-home",
        label: "Início",
        href: "/landingPage",
        sub: "Painel geral",
      },
      {
        icon: "ti-calendar",
        label: "Horários",
        href: "/horarios",
        sub: "Aulas e sessões",
      },
      {
        icon: "ti-credit-card",
        label: "Pagamentos",
        href: "/pagamentos",
        sub: "Recibos e mensalidades",
      },
    ],
  },
  {
    title: "Comunidade",
    items: [
      {
        icon: "ti-mail",
        label: "Mensagens",
        href: "/mensagens",
        sub: "Conversas entre utilizadores",
      },
      {
        icon: "ti-star",
        label: "Eventos",
        href: "/eventos",
        sub: "Espetáculos e datas especiais",
      },
      {
        icon: "ti-shopping-bag",
        label: "Marketplace",
        href: "/marketplace",
        sub: "Compra, venda e aluguer de artigos",
      },
    ],
  },
  {
    title: "Gestão ",
    items: [
      {
        icon: "ti-chart-bar",
        label: "Gestão de Faltas",
        href: "/faltas",
        sub: "Presenças e justificações",
      },
    ],
  },
];

// ─── Horário semanal ──────────────────────────────────────────────────────────
function HorarioResumo({ role }: { role: Role }) {
  const [aulas, setAulas] = useState<AulaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [intervaloTexto, setIntervaloTexto] = useState("");
  const router = useRouter();

  useEffect(() => {
    setIntervaloTexto(getIntervaloSemana());
    const token = localStorage.getItem("token") ?? "";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const endpoint =
      role === "PROFESSOR"
        ? `${BASE_URL}/api/horario/professor/horario?offset=0`
        : `${BASE_URL}/api/horario/semana?offset=0`;
    fetch(endpoint, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("Erro");
        return res.json();
      })
      .then((data: AulaDto[]) => setAulas(data ?? []))
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [role]);

  const aulasPorDia: AulaDto[][] = Array.from({ length: 6 }, () => []);
  aulas.forEach((a) => {
    const idx = diaParaIdx(a.diaSemana);
    if (idx >= 0 && idx < 6) aulasPorDia[idx].push(a);
  });

  const colunas = [0, 1, 2, 3, 4, 5];

  if (loading)
    return (
      <div
        style={{
          background: "#FBF7F2",
          border: "1px solid var(--border-warm)",
          borderRadius: "8px",
          padding: "22px",
          marginBottom: "20px",
          minHeight: "120px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: "2px solid var(--border-warm)",
            borderTopColor: "var(--accent-gold)",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );

  return (
    <div
      style={{
        background: "#FBF7F2",
        border: "1px solid var(--border-warm)",
        borderRadius: "8px",
        padding: "22px",
        marginBottom: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: "3px",
          background: "#402F1D",
          borderRadius: "8px 0 0 8px",
        }}
      />

      <p
        style={{
          fontSize: "9px",
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "var(--accent-muted)",
          fontWeight: 300,
          marginBottom: "4px",
        }}
      >
        Esta semana {intervaloTexto ? `· ${intervaloTexto}` : ""}
      </p>
      <h2
        style={{
          fontFamily: "var(--font-playfair)",
          fontSize: "18px",
          color: "var(--panel-dark)",
          fontWeight: 400,
          marginBottom: "18px",
        }}
      >
        Os teus horários
      </h2>

      {erro ? (
        <p
          style={{
            fontSize: "12px",
            color: "var(--accent-muted)",
            fontWeight: 300,
          }}
        >
          Não foi possível carregar os horários.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "8px",
          }}
        >
          {colunas.map((idx) => (
            <div key={idx}>
              <div
                style={{
                  fontSize: "9px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "var(--accent-muted)",
                  fontWeight: 400,
                  marginBottom: "6px",
                  paddingBottom: "5px",
                  borderBottom: "1px solid var(--border-warm)",
                }}
              >
                {DIAS_ABREV[idx]}
              </div>
              {aulasPorDia[idx].length === 0 ? (
                <div
                  style={{
                    background: "rgba(160,133,96,0.05)",
                    border: "1px dashed var(--border-warm)",
                    borderRadius: "6px",
                    padding: "10px",
                    opacity: 0.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "56px",
                  }}
                >
                  <div
                    style={{ fontSize: "14px", color: "var(--border-warm)" }}
                  >
                    —
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {aulasPorDia[idx].map((a) => (
                    <div
                      key={a.id}
                      style={{
                        background: "#fff",
                        border: "1px solid var(--border-warm)",
                        borderLeft: "3px solid var(--accent-gold)",
                        borderRadius: "6px",
                        padding: "8px 10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--accent-gold)",
                          fontWeight: 400,
                          letterSpacing: "0.3px",
                          marginBottom: "3px",
                        }}
                      >
                        {a.horaInicio}
                        {a.horaFim ? ` – ${a.horaFim}` : ""}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--panel-dark)",
                          fontWeight: 400,
                          lineHeight: 1.3,
                        }}
                      >
                        {a.turma?.nome ?? a.titulo ?? "Aula"}
                      </div>
                      {a.professor && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "var(--accent-muted)",
                            marginTop: "3px",
                            fontWeight: 300,
                          }}
                        >
                          {a.professor.nome}
                        </div>
                      )}
                      {a.estudio && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "var(--accent-muted)",
                            marginTop: "1px",
                            fontWeight: 300,
                          }}
                        >
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

      <div
        style={{
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: "1px solid var(--border-warm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "var(--accent-muted)",
            fontWeight: 300,
          }}
        >
          {aulas.length} {aulas.length === 1 ? "aula" : "aulas"} esta semana
        </span>
        <button
          onClick={() => router.push("/horarios")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "11px",
            color: "var(--accent-muted)",
            letterSpacing: ".5px",
            fontWeight: 400,
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.color = "var(--panel-dark)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.color =
              "var(--accent-muted)")
          }
        >
          Ver horário completo →
        </button>
      </div>
    </div>
  );
}

// ─── Tema dos cards ───────────────────────────────────────────────────────────
const CARD_THEMES: Record<
  string,
  {
    imageQuery: string;
    localImage: string; // ── ADICIONADO: Propriedade para o caminho em public/images/
    overlay: string;
    tint: string;
    accent: string;
    pill: string;
  }
> = {
  "/horarios": {
    imageQuery: "clock schedule calendar minimal",
    localImage: "/images/cardHorarios.jpg", 
    overlay:
      "linear-gradient(160deg, rgba(64,47,29,0.70) 0%, rgba(64,47,29,0.82) 100%)",
    tint: "#402F1D",
    accent: "#F5D9A8",
    pill: "rgba(245,217,168,0.15)",
  },
  "/pagamentos": {
    imageQuery: "gold coins finance minimal",
    localImage: "/images/cardPagamentos.jpg", 
    overlay:
      "linear-gradient(160deg, rgba(78,57,35,0.64) 0%, rgba(78,57,35,0.75) 100%)",
    tint: "#4E3923",
    accent: "#E8C97A",
    pill: "rgba(232,201,122,0.15)",
  },
  "/mensagens": {
    imageQuery: "letter envelope handwritten paper",
    localImage: "/images/cardMensagens.jpg",
    overlay:
      "linear-gradient(160deg, rgba(92,68,42,0.58) 0%, rgba(92,68,42,0.68) 100%)",
    tint: "#5C442A",
    accent: "#F0D4A4",
    pill: "rgba(240,212,164,0.15)",
  },
  "/eventos": {
    imageQuery: "stage spotlight performance dance theatre",
    localImage: "/images/cardEventos.jpg",
    overlay:
      "linear-gradient(160deg, rgba(106,79,49,0.52) 0%, rgba(106,79,49,0.61) 100%)",
    tint: "#6A4F31",
    accent: "#ECC68A",
    pill: "rgba(236,198,138,0.15)",
  },
  "/marketplace": {
    imageQuery: "ballet shoes pointe shoe dance accessories",
    localImage: "/images/cardMarketplace.jpg",
    overlay:
      "linear-gradient(160deg, rgba(119,89,55,0.46) 0%, rgba(119,89,55,0.54) 100%)",
    tint: "#775937",
    accent: "#F2D09E",
    pill: "rgba(242,208,158,0.15)",
  },
  "/faltas": {
    imageQuery: "notebook attendance list pen paper",
    localImage: "/images/cardFaltas.jpg", 
    overlay:
      "linear-gradient(160deg, rgba(130,97,61,0.40) 0%, rgba(130,97,61,0.48) 100%)",
    tint: "#82613D",
    accent: "#EDCA90",
    pill: "rgba(237,202,144,0.15)",
  },
};

const DEFAULT_THEME = {
  imageQuery: "elegant minimal texture",
  overlay:
    "linear-gradient(160deg, rgba(64,47,29,0.65) 0%, rgba(106,79,49,0.78) 100%)",
  tint: "#402F1D",
  accent: "#F0D0A0",
  pill: "rgba(240,208,160,0.15)",
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

  const imgSrc = theme.localImage;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
        height: "180px",
        cursor: "pointer",
        boxShadow: hovered
          ? `0 12px 28px ${theme.tint}40, 0 4px 12px rgba(0,0,0,0.1)`
          : "0 2px 10px rgba(44,28,10,0.10)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "transform .3s cubic-bezier(.25,.8,.25,1), box-shadow .3s cubic-bezier(.25,.8,.25,1)",
        border: `1px solid ${hovered ? "rgba(245,217,168,0.25)" : "rgba(180,140,80,0.12)"}`,
        background: theme.tint, // Cor sólida de fundo do card
      }}
      onClick={() => router.push(item.href)}
    >
      {/* ── CONTENTOR DA IMAGEM ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "70%", 
          opacity: imgLoaded ? (hovered ? 1 : 0.80) : 0,
          transition: "opacity .3s ease",
          pointerEvents: "none",
          maskImage: "linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
        }}
      >
        <img
          src={imgSrc}
          alt=""
          aria-hidden="true"
          onLoad={() => setImgLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.75) saturate(0.9)", // Ajuste opcional de tons
            transform: hovered ? "scale(1.06)" : "scale(1.01)",
            transition: "transform .4s ease",
          }}
        />
      </div>

      {/* ── OVERLAY DE DEGRADÉ ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to right, ${theme.tint} 35%, ${theme.tint}10 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* ── CONTEÚDO DO CARD ── */}
      <div
        style={{
          position: "relative",
          inset: 0,
          height: "100%",
          padding: "18px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: theme.pill,
              backdropFilter: "blur(6px)",
              border: `1px solid ${theme.accent}28`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.accent,
            }}
          >
            <i
              className={`ti ${item.icon}`}
              style={{ fontSize: "17px" }}
              aria-hidden="true"
            />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDesafixar();
            }}
            title="Desafixar"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.accent,
              padding: "4px",
              transition: "opacity .2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.75,
            }}
            onMouseEnter={(e) => {
              e.stopPropagation();
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.75";
            }}
          >
            <div style={{ position: "relative", width: "16px", height: "16px", display: "flex", alignItems: "center" }}>
              <i className="ti ti-pin" style={{ fontSize: "15px", fontWeight: "bold" }} />
              <div
                style={{
                  position: "absolute",
                  top: "45%",
                  left: "1px",
                  right: "1px",
                  height: "2px",
                  background: theme.accent,
                  transform: "translateY(-50%) rotate(45deg)",
                  borderRadius: "2px",
                }}
              />
            </div>
          </button>
        </div>

        <div>
          <div
            style={{
              fontSize: "15px",
              color: "#FFF8EE",
              fontWeight: 500,
              letterSpacing: ".2px",
              marginBottom: "4px",
              textShadow: "0 1px 4px rgba(0,0,0,0.3)", // Sombra leve no texto para destacar contra qualquer imagem
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: theme.accent,
              fontWeight: 300,
              lineHeight: 1.4,
              opacity: 0.9,
              letterSpacing: ".2px",
            }}
          >
            {item.sub}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);
  const drawerRef = useRef<HTMLDivElement>(null);

  // ──Navbar Notificações ──
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  useEffect(() => {
    const carregarDadosLocais = () => {
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
    };

    // Executa imediatamente ao montar a página
    carregarDadosLocais();

    // Escuta quando o utilizador volta atrás ou muda o foco para reidratar a página sem precisar de F5
    window.addEventListener('pageshow', carregarDadosLocais);
    window.addEventListener('focus', carregarDadosLocais);

    return () => {
      window.removeEventListener('pageshow', carregarDadosLocais);
      window.removeEventListener('focus', carregarDadosLocais);
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // ── NOVO: Função para limpar as notificações não lidas ao abrir o painel ──
  const marcarTodasComoLidas = () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    setUnreadCount(0);
  };

  const togglePin = (href: string) => {
    setPinnedHrefs((prev) => {
      const next = prev.includes(href)
        ? prev.filter((h) => h !== href)
        : [...prev, href];
      localStorage.setItem("pinnedItems", JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const todosItens = NAV_SECTIONS.flatMap((s) => s.items).filter(
    (i) => i.href !== "/landingPage",
  );
  const itensPinned = todosItens.filter((i) => pinnedHrefs.includes(i.href));

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pin-btn { opacity: 0; transition: opacity .15s, color .15s; }
        .nav-item:hover .pin-btn { opacity: 1; }
        .pin-btn.is-pinned { opacity: 1 !important; }
      `}</style>
      <div
        className="flex flex-col min-h-screen"
        style={{
          background: "var(--background)",
          fontFamily: "var(--font-lato)",
        }}
      >
        {/* ── NAVBAR ── */}
        <nav
          className="flex items-center justify-between px-5 flex-shrink-0 sticky top-0 z-40"
          style={{
            height: "52px",
            borderBottom: "1px solid var(--border-warm)",
            background: "var(--background)",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu"
              className="flex items-center justify-center shadow-xs"
              style={{
                width: "32px",
                height: "32px",
                border: "1px solid var(--border-warm)",
                borderRadius: "4px",
                background: "#FFFCF8",
                color: "var(--panel-dark)",
                cursor: "pointer",
              }}
            >
              <i className="ti ti-menu-2" style={{ fontSize: "16px" }} />
            </button>
            <div>
              <span
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "16px",
                  letterSpacing: "4px",
                  color: "var(--panel-dark)",
                  fontWeight: 400,
                }}
              >
                entartes
              </span>
              <span
                className="hidden sm:inline"
                style={{
                  fontSize: "9px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--accent-muted)",
                  fontWeight: 300,
                  marginLeft: "4px",
                }}
              >
                · início
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              style={{
                fontSize: "12px",
                color: "var(--accent-muted)",
                fontWeight: 300,
              }}
            >
              Bem-vindo{userName ? `, ${userName.split(" ")[0]}` : ""}
            </span>

            {/* SINO DE NOTIFICAÇÕES NO TOPO DIREITO */}
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
                aria-label="Notificações"
                className="flex items-center justify-center relative transition-colors"
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: "1px solid var(--border-warm)",
                  background: "transparent",
                  color: "var(--accent-muted)",
                  cursor: "pointer",
                }}
              >
                <i className="ti ti-bell" style={{ fontSize: "15px" }} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-panel-dark text-[8px] font-normal w-4 h-4 flex items-center justify-center rounded-full text-accent-gold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifPanel && (
                <div className="absolute right-0 mt-2 w-72 bg-[#FBF7F2] border border-border-warm rounded-sm shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-border-warm flex justify-between items-center bg-[#FFFCF8]">
                    <h3
                      style={{ fontFamily: "var(--font-playfair)" }}
                      className="text-xs text-panel-dark tracking-wide font-normal"
                    >
                      Notificações
                    </h3>
                    <button
                      onClick={() => setShowNotifPanel(false)}
                      className="text-accent-muted hover:text-panel-dark text-sm"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-border-warm/30">
                    {notificacoes.length === 0 ? (
                      <p className="p-6 text-center text-accent-muted text-xs font-light">
                        Sem novas notificações.
                      </p>
                    ) : (
                      notificacoes.map((n) => (
                        <div
                          key={n.id}
                          className="p-3 hover:bg-[#FFFCF8] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] font-normal text-panel-dark">
                              {n.titulo}
                            </p>
                            {!n.lida && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold mt-1 flex-shrink-0"></span>
                            )}
                          </div>
                          <p className="text-xs text-accent-muted mt-1 font-light leading-snug">
                            {n.mensagem}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* BOLINHA DO PERFIL IDÊNTICA (Com Menu Dropdown) */}
            <div className="relative">
              <div
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifPanel(false);
                }}
                className="flex items-center justify-center hover:opacity-90 transition-opacity"
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: "var(--panel-dark)",
                  color: "var(--accent-gold)",
                  fontSize: "11px",
                  letterSpacing: "1px",
                  fontFamily: "var(--font-playfair)",
                  fontWeight: 400,
                  cursor: "pointer",
                }}
              >
                {initials}
              </div>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#FBF7F2] border border-border-warm rounded-sm shadow-xl z-50 overflow-hidden py-1">
                  <div className="px-3 py-2 border-b border-border-warm/30 bg-[#FFFCF8]">
                    <p className="text-[10px] text-accent-muted uppercase tracking-wider font-light">
                      Sessão iniciada
                    </p>
                    <p className="text-xs font-normal text-panel-dark truncate">
                      {userName || "Utilizador"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      router.push("/utilizadores/verPerfil");
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-panel-dark hover:bg-panel-dark/5 transition-colors flex items-center gap-2"
                  >
                    <i className="ti ti-user-cog text-accent-muted" /> O meu
                    perfil
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

        {/* ── BODY ── */}
        <div className="flex flex-1 relative overflow-hidden">
          {/* Overlay */}
          {drawerOpen && (
            <div
              className="absolute inset-0 z-10"
              style={{ background: "rgba(44,31,20,0.30)" }}
              onClick={() => setDrawerOpen(false)}
            />
          )}

          {/* ── DRAWER (Mantendo o tom #775937 / terra médio pedido anteriormente) ── */}
          <aside
            ref={drawerRef}
            className="absolute top-0 bottom-0 left-0 z-20 flex flex-col"
            style={{
              width: "240px",
              background: "#503c25",
              boxShadow: "4px 0 24px rgba(44,28,10,0.30)",
              transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
              transition: "transform .28s cubic-bezier(.4,0,.2,1)",
              borderRight: "1px solid rgba(245,217,168,0.12)",
            }}
          >
            {/* Topo do Drawer */}
            <div
              className="px-5 py-5"
              style={{ borderBottom: "1px solid rgba(245,217,168,0.12)" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "14px",
                  letterSpacing: "3px",
                  color: "#FFF8EE",
                  fontWeight: 500,
                  display: "block",
                }}
              >
                entartes
              </span>
              <span
                style={{
                  fontSize: "10px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: "rgba(245,217,168,0.65)",
                  fontWeight: 400,
                  marginTop: "4px",
                  display: "block",
                }}
              >
                escola de dança
              </span>
            </div>

            {/* Conteúdo / Itens de Navegação */}
            <div className="flex-1 overflow-y-auto py-2">
              {NAV_SECTIONS.map((section) => {
                const cleanTitle = section.title.replace(/─/g, "").trim();

                return (
                  <div key={section.title} style={{ marginBottom: "14px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "14px 20px 8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          letterSpacing: "2px",
                          textTransform: "uppercase",
                          color: "rgba(245,217,168,0.75)",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cleanTitle}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          borderBottom: "1px solid rgba(245,217,168,0.18)",
                          marginTop: "2px",
                        }}
                      />
                    </div>

                    {section.items.map((item) => {
                      const isPinned = pinnedHrefs.includes(item.href);
                      const canPin = item.href !== "/landingPage";
                      const theme = CARD_THEMES[item.href] ?? DEFAULT_THEME;

                      return (
                        <div
                          key={item.href}
                          className="nav-item"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "2px",
                          }}
                        >
                          <button
                            onClick={() => {
                              router.push(item.href);
                              setDrawerOpen(false);
                            }}
                            className="flex items-center gap-2"
                            style={{
                              flex: 1,
                              padding: "10px 20px",
                              color: "rgba(255,248,238,0.75)",
                              fontSize: "13px",
                              letterSpacing: ".4px",
                              fontWeight: 300,
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "background .2s, color .2s",
                            }}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLElement
                              ).style.background = "rgba(255,255,255,0.08)";
                              (e.currentTarget as HTMLElement).style.color =
                                "var(--accent-gold)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLElement
                              ).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color =
                                "rgba(255,248,238,0.75)";
                            }}
                          >
                            <i
                              className={`ti ${item.icon}`}
                              style={{ fontSize: "15px", opacity: 0.85 }}
                              aria-hidden="true"
                            />
                            {item.label}
                          </button>

                          {canPin && (
                            <button
                              onClick={() => togglePin(item.href)}
                              title={
                                isPinned ? "Desafixar" : "Afixar no painel"
                              }
                              className={`pin-btn${isPinned ? " is-pinned" : ""}`}
                              style={{
                                padding: "10px 20px 10px 0",
                                background: "none",
                                backdropFilter: "none",
                                border: "none",
                                cursor: "pointer",
                                color: isPinned
                                  ? theme.accent
                                  : "rgba(245,217,168,0.30)",
                                transition: "opacity .2s, color .2s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isPinned ? 0.75 : undefined,
                              }}
                              onMouseEnter={(e) => {
                                const el = e.currentTarget as HTMLElement;
                                if (isPinned) {
                                  el.style.opacity = "1";
                                } else {
                                  el.style.color = "var(--accent-gold)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                const el = e.currentTarget as HTMLElement;
                                if (isPinned) {
                                  el.style.opacity = "0.75";
                                } else {
                                  el.style.color = "rgba(245,217,168,0.30)";
                                }
                              }}
                            >
                              {isPinned ? (
                                <div
                                  style={{
                                    position: "relative",
                                    width: "16px",
                                    height: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <i
                                    className="ti ti-pin"
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: "bold",
                                      display: "block",
                                      transformOrigin: "center",
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "45%",
                                      left: "1px",
                                      right: "1px",
                                      height: "2px",
                                      background: theme.accent,
                                      transform:
                                        "translateY(-50%) rotate(45deg)",
                                      transformOrigin: "center",
                                      boxShadow: "0 0 2px rgba(0,0,0,0.4)",
                                      borderRadius: "2px",
                                      pointerEvents: "none",
                                    }}
                                  />
                                </div>
                              ) : (
                                <i
                                  className="ti ti-pin"
                                  style={{ fontSize: "13px" }}
                                />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Botão Sair / Rodapé */}
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid rgba(245,217,168,0.12)",
              }}
            >
              <button
                onClick={handleLogout}
                className="flex items-center gap-2"
                style={{
                  color: "rgba(245,217,168,0.45)",
                  fontSize: "13px",
                  fontWeight: 300,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "#F3AEAE")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "rgba(245,217,168,0.45)")
                }
              >
                <i
                  className="ti ti-logout"
                  style={{ fontSize: "15px" }}
                  aria-hidden="true"
                />
                Sair
              </button>
            </div>
          </aside>

          {/* ── CONTEÚDO PRINCIPAL ── */}
          <main
            className="flex-1 overflow-y-auto"
            style={{ padding: "28px 28px 40px" }}
          >
            {/* Cabeçalho */}
            <div style={{ marginBottom: "24px" }}>
              <p
                style={{
                  fontSize: "10px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  color: "var(--accent-muted)",
                  fontWeight: 300,
                  marginBottom: "4px",
                }}
              >
                Painel geral
              </p>
              <h1
                style={{
                  fontFamily: "var(--font-playfair)",
                  fontSize: "24px",
                  color: "var(--panel-dark)",
                  fontWeight: 400,
                }}
              >
                Olá{userName ? `, ${userName.split(" ")[0]}` : ""}
              </h1>
            </div>

            {/* ── HORÁRIO DA SEMANA ── */}
            {role && <HorarioResumo role={role} />}

            {/* ── ATALHOS AFIXADOS ── */}
            {itensPinned.length > 0 ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "12px",
                  }}
                >
                  <i
                    className="ti ti-pin"
                    style={{
                      fontSize: "12px",
                      color: "var(--accent-muted)",
                      display: "inline-block",
                      transform: "rotate(45deg)",
                    }}
                  />
                  <p
                    style={{
                      fontSize: "10px",
                      letterSpacing: "3px",
                      textTransform: "uppercase",
                      color: "var(--accent-muted)",
                      fontWeight: 300,
                    }}
                  >
                    Os teus atalhos
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                    maxWidth: "100%",
                    gap: "10px",
                  }}
                  className="grid-atalhos"
                >
                  <style>{`
                    @media (min-width: 1024px) {
                      .grid-atalhos {
                        grid-template-columns: repeat(3, 1fr) !important;
                      }
                    }
                  `}</style>

                  {itensPinned.map((item) => (
                    <AtalhoAfixado
                      key={item.href}
                      item={item}
                      onDesafixar={() => togglePin(item.href)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "36px 24px",
                  textAlign: "center",
                  border: "1px dashed var(--border-warm)",
                  borderRadius: "8px",
                  background: "rgba(160,133,96,0.03)",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "rgba(160,133,96,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <i
                    className="ti ti-pin"
                    style={{ fontSize: "20px", color: "var(--accent-muted)" }}
                  />
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--panel-dark)",
                    fontWeight: 400,
                    fontFamily: "var(--font-playfair)",
                    marginBottom: "8px",
                  }}
                >
                  O teu espaço, à tua medida
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--accent-muted)",
                    fontWeight: 300,
                    lineHeight: 1.7,
                    maxWidth: "320px",
                  }}
                >
                  Abre o menu lateral e clica no{" "}
                  <i className="ti ti-pin" style={{ fontSize: "12px" }} /> ao
                  lado de qualquer secção para a afixar aqui como atalho rápido.
                </p>
                <button
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    marginTop: "18px",
                    padding: "8px 18px",
                    background: "transparent",
                    border: "1px solid var(--border-warm)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "11px",
                    color: "var(--panel-dark)",
                    letterSpacing: ".5px",
                    fontWeight: 300,
                    transition: "border-color .15s, color .15s",
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "var(--accent-muted)";
                    el.style.color = "var(--accent-muted)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = "var(--border-warm)";
                    el.style.color = "var(--panel-dark)";
                  }}
                >
                  Abrir menu
                </button>
              </div>
            )}
          </main>
        </div>

        {/* ── FOOTER ── */}
        <footer
          className="flex items-center justify-between flex-shrink-0"
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border-warm)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "12px",
              letterSpacing: "3px",
              color: "var(--accent-muted)",
              fontWeight: 400,
            }}
          >
            entartes
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "var(--accent-muted)",
              fontWeight: 300,
            }}
          >
            © 2026 Entartes — Escola de Dança
          </span>
        </footer>
      </div>
    </>
  );
}
