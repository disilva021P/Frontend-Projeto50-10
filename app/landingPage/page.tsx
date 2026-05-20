"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Tipos ───────────────────────────────────────────────
interface NavItem {
  icon: string; // classe Tabler (ex: 'ti-calendar')
  label: string;
  href: string;
}

// ─── Estrutura do menu lateral ────────────────────────────
const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Principal",
    items: [
      { icon: "ti-home", label: "Início", href: "/landingPage" },
      { icon: "ti-calendar", label: "Horários", href: "/horarios" },
      { icon: "ti-credit-card", label: "Pagamentos", href: "/pagamentos" },
    ],
  },
  {
    title: "Comunidade",
    items: [
      { icon: "ti-mail", label: "Mensagens", href: "/mensagens" },
      { icon: "ti-star", label: "Eventos", href: "/eventos" },
      { icon: "ti-shopping-bag", label: "Marketplace", href: "/marketplace" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { icon: "ti-chart-bar", label: "Gestão de Faltas", href: "/faltas" },
    ],
  },
];

// ─── Cards placeholder ────────────────────────────────────
const CARDS = [
  {
    icon: "ti-credit-card",
    title: "Pagamentos",
    sub: "Recibos e mensalidades",
    href: "/pagamentos",
  },
  {
    icon: "ti-mail",
    title: "Mensagens",
    sub: "Comunicação com a escola",
    href: "/mensagens",
  },
  {
    icon: "ti-chart-bar",
    title: "Gestão de Faltas",
    sub: "Presenças e justificações",
    href: "/faltas",
  },
  {
    icon: "ti-star",
    title: "Eventos",
    sub: "Espetáculos e datas especiais",
    href: "/eventos",
  },
  {
    icon: "ti-shopping-bag",
    title: "Marketplace",
    sub: "Material e equipamentos",
    href: "/marketplace",
  },
];

// ─── Horários placeholder (virão da API) ─────────────────
const SCHEDULE_PLACEHOLDER = [
  { day: "Seg", time: "18h30", name: "Contemporâneo" },
  { day: "Qua", time: "19h00", name: "Ballet" },
  { day: "Sex", time: null, name: "Sem aula" },
];

export default function LandingPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUserName(parsed.nome || "");
      } catch {
        /* ignora */
      }
    }
  }, []);

  // Fecha drawer ao carregar Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

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

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{
        background: "var(--background)",
        fontFamily: "var(--font-lato)",
      }}
    >
      {/* ══════════════════════════════════════
          NAVBAR
          ══════════════════════════════════════ */}
      <nav
        className="flex items-center justify-between px-5 flex-shrink-0"
        style={{
          height: "52px",
          borderBottom: "1px solid var(--border-warm)",
          background: "var(--background)",
        }}
      >
        {/* Esquerda */}
        <div className="flex items-center gap-3">
          {/* Botão drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="flex items-center justify-center transition-colors"
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

          {/* Logo */}
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
              style={{
                fontSize: "9px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "var(--accent-muted)",
                fontWeight: 300,
                marginLeft: "4px",
              }}
            >
              · escola de dança
            </span>
          </div>
        </div>

        {/* Direita */}
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

          {/* Notificações */}
          <button
            aria-label="Notificações"
            className="flex items-center justify-center"
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
          </button>

          {/* Avatar */}
          <div
            className="flex items-center justify-center"
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
        </div>
      </nav>

      {/* ══════════════════════════════════════
          BODY
          ══════════════════════════════════════ */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Overlay do drawer */}
        {drawerOpen && (
          <div
            className="absolute inset-0 z-10"
            style={{ background: "rgba(44,31,20,0.30)" }}
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* ── DRAWER ── */}
        <aside
          ref={drawerRef}
          className="absolute top-0 bottom-0 left-0 z-20 flex flex-col"
          style={{
            width: "220px",
            background: "var(--panel-dark)",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform .28s cubic-bezier(.4,0,.2,1)",
          }}
        >
          {/* Header drawer */}
          <div
            className="px-5 py-5"
            style={{ borderBottom: "1px solid rgba(212,178,136,0.12)" }}
          >
            <span
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "13px",
                letterSpacing: "3px",
                color: "var(--accent-gold)",
                fontWeight: 400,
                display: "block",
              }}
            >
              entartes
            </span>
            <span
              style={{
                fontSize: "9px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "rgba(212,178,136,0.35)",
                fontWeight: 300,
                marginTop: "2px",
                display: "block",
              }}
            >
              escola de dança
            </span>
          </div>

          {/* Itens de navegação */}
          <div className="flex-1 overflow-y-auto py-2">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                <div
                  style={{
                    fontSize: "9px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: "rgba(212,178,136,0.22)",
                    fontWeight: 300,
                    padding: "14px 20px 4px",
                  }}
                >
                  {section.title}
                </div>
                {section.items.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      setDrawerOpen(false);
                    }}
                    className="flex items-center gap-2 w-full transition-colors"
                    style={{
                      padding: "10px 20px",
                      color: "rgba(212,178,136,0.55)",
                      fontSize: "12px",
                      letterSpacing: ".5px",
                      fontWeight: 300,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(212,178,136,0.08)";
                      (e.currentTarget as HTMLElement).style.color =
                        "var(--accent-gold)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(212,178,136,0.55)";
                    }}
                  >
                    <i
                        className={`ti ti-${item.icon.replace('ti-', '')}`}
                        style={{ fontSize: "16px", display: "inline-block" }}
                        aria-hidden="true"
                    />
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Footer drawer — logout */}
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid rgba(212,178,136,0.10)",
            }}
          >
            <button
              onClick={handleLogout}
              className="flex items-center gap-2"
              style={{
                color: "rgba(212,178,136,0.35)",
                fontSize: "12px",
                fontWeight: 300,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "#E8A09A")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "rgba(212,178,136,0.35)")
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
          {/* Cabeçalho da página */}
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

          {/* ── HORÁRIOS EM DESTAQUE ── */}
          <div
            style={{
              background: "var(--panel-dark)",
              borderRadius: "8px",
              padding: "22px",
              marginBottom: "20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Círculo decorativo */}
            <div
              style={{
                position: "absolute",
                top: "-30px",
                right: "-30px",
                width: "120px",
                height: "120px",
                borderRadius: "50%",
                border: "1px solid rgba(212,178,136,0.10)",
              }}
            />

            <p
              style={{
                fontSize: "9px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "rgba(212,178,136,0.45)",
                fontWeight: 300,
                marginBottom: "4px",
              }}
            >
              Esta semana
            </p>
            <h2
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "18px",
                color: "var(--accent-gold)",
                fontWeight: 400,
                marginBottom: "16px",
              }}
            >
              Os teus horários
            </h2>

            {/* Slots */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "10px",
              }}
            >
              {SCHEDULE_PLACEHOLDER.map((slot) => (
                <div
                  key={slot.day}
                  style={{
                    background: "rgba(212,178,136,0.08)",
                    border: `1px ${slot.time ? "solid" : "dashed"} rgba(212,178,136,0.15)`,
                    borderRadius: "6px",
                    padding: "10px 12px",
                    opacity: slot.time ? 1 : 0.4,
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      color: "rgba(212,178,136,0.4)",
                      fontWeight: 300,
                      marginBottom: "4px",
                    }}
                  >
                    {slot.day}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--accent-gold)",
                      fontWeight: 300,
                    }}
                  >
                    {slot.time ?? "—"}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(212,178,136,0.55)",
                      marginTop: "2px",
                      fontWeight: 300,
                    }}
                  >
                    {slot.name}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "14px" }}>
              <button
                onClick={() => router.push("/horarios")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "11px",
                  color: "rgba(212,178,136,0.5)",
                  letterSpacing: ".5px",
                  fontWeight: 300,
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "var(--accent-gold)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "rgba(212,178,136,0.5)")
                }
              >
                Ver horário completo →
              </button>
            </div>
          </div>

          {/* ── CARDS PLACEHOLDER ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
            }}
          >
            {CARDS.map((card) => (
              <button
                key={card.href}
                onClick={() => router.push(card.href)}
                style={{
                  background: "#FFFCF8",
                  border: "1px solid var(--border-warm)",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color .15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    "var(--accent-muted)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    "var(--border-warm)")
                }
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    background: "rgba(44,31,20,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "10px",
                    color: "var(--panel-dark)",
                  }}
                >
                <i
                    className={`ti ti-${card.icon.replace('ti-', '')}`}
                    style={{ fontSize: "18px", display: "inline-block" }}
                    aria-hidden="true"
                />
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--panel-dark)",
                    fontWeight: 400,
                    marginBottom: "3px",
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--accent-muted)",
                    fontWeight: 300,
                    lineHeight: 1.4,
                  }}
                >
                  {card.sub}
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════
          FOOTER
          ══════════════════════════════════════ */}
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
          © 2025 Entartes — Escola de Dança
        </span>
      </footer>
    </div>
  );
}
