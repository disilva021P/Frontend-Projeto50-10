"use client";

import { useDashboard } from "../context/DashboardContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Tipos e DTOs necessários para o Horário ───
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

const BASE_URL = "http://localhost:8080";
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

const CARD_THEMES: Record<
  string,
  { localImage: string; tint: string; accent: string; pill: string }
> = {
  "/horarios": {
    localImage: "/images/cardHorarios.jpg",
    tint: "#402F1D",
    accent: "#F5D9A8",
    pill: "rgba(245,217,168,0.15)",
  },
  "/pagamentos": {
    localImage: "/images/cardPagamentos.jpg",
    tint: "#4E3923",
    accent: "#E8C97A",
    pill: "rgba(232,201,122,0.15)",
  },
  "/mensagens": {
    localImage: "/images/cardMensagens.jpg",
    tint: "#5C442A",
    accent: "#F0D4A4",
    pill: "rgba(240,212,164,0.15)",
  },
  "/eventos": {
    localImage: "/images/cardEventos.jpg",
    tint: "#6A4F31",
    accent: "#ECC68A",
    pill: "rgba(236,198,138,0.15)",
  },
  "/marketplace": {
    localImage: "/images/cardMarketplace.jpg",
    tint: "#775937",
    accent: "#F2D09E",
    pill: "rgba(242,208,158,0.15)",
  },
  "/faltas": {
    localImage: "/images/cardFaltas.jpg",
    tint: "#82613D",
    accent: "#EDCA90",
    pill: "rgba(237,202,144,0.15)",
  },
};
const DEFAULT_THEME = {
  localImage: "",
  tint: "#402F1D",
  accent: "#F0D0A0",
  pill: "rgba(240,208,160,0.15)",
};

// Componente do Horário Resumido obtendo dados da API
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

  if (loading) {
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
  }

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
          {[0, 1, 2, 3, 4, 5].map((idx) => (
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
        >
          Ver horário completo →
        </button>
      </div>
    </div>
  );
}

// Componente do Card Individual Afixado
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
        transition:
          "transform .3s cubic-bezier(.25,.8,.25,1), box-shadow .3s cubic-bezier(.25,.8,.25,1)",
        border: `1px solid ${hovered ? "rgba(245,217,168,0.25)" : "rgba(180,140,80,0.12)"}`,
        background: theme.tint,
      }}
      onClick={() => router.push(item.href)}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "70%",
          opacity: imgLoaded ? (hovered ? 1 : 0.8) : 0,
          transition: "opacity .3s ease",
          pointerEvents: "none",
          maskImage:
            "linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
        }}
      >
        <img
          src={theme.localImage}
          alt=""
          aria-hidden="true"
          onLoad={() => setImgLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.75) saturate(0.9)",
            transform: hovered ? "scale(1.06)" : "scale(1.01)",
            transition: "transform .4s ease",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to right, ${theme.tint} 35%, ${theme.tint}10 100%)`,
          pointerEvents: "none",
        }}
      />
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
            <i className={`ti ${item.icon}`} style={{ fontSize: "17px" }} />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDesafixar();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.accent,
              padding: "4px",
              opacity: 0.75,
            }}
          >
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
                style={{ fontSize: "15px", fontWeight: "bold" }}
              />
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
        <div style={{ marginTop: "auto" }}>
          <div
            style={{
              fontSize: "15px",
              color: "#FFF8EE",
              fontWeight: 500,
              letterSpacing: ".2px",
              marginBottom: "4px",
              textShadow: "0 1px 4px rgba(0,0,0,0.3)",
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

// ─── COMPONENTE PRINCIPAL DA ROTA ───
export default function LandingPage() {
  const { userName, role, pinnedHrefs, togglePin, setDrawerOpen } =
    useDashboard();

  const todosItens = [
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
    {
      icon: "ti-chart-bar",
      label: "Gestão de Faltas",
      href: "/faltas",
      sub: "Presenças e justificações",
    },
  ];

  const itensPinned = todosItens.filter((i) => pinnedHrefs.includes(i.href));

  return (
    <>
      {/* Título da Página */}
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

      {/* Horário Semanal do utilizador logado */}
      {role && <HorarioResumo role={role} />}

      {/* Atalhos Dinâmicos Afixados do Contexto */}
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
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              maxWidth: "100%",
              gap: "10px",
            }}
            className="grid-atalhos"
          >
            <style>{`@media (min-width: 1024px) { .grid-atalhos { grid-template-columns: repeat(3, 1fr) !important; } }`}</style>
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
            <i className="ti ti-pin" style={{ fontSize: "12px" }} /> ao lado de
            qualquer secção para a afixar aqui como atalho rápido.
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
            }}
          >
            Abrir menu
          </button>
        </div>
        
      )}
    </>
  );
}
