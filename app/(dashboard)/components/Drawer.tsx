"use client";

import { useDashboard } from "../context/DashboardContext";
import { useRouter } from "next/navigation";

const NAV_SECTIONS = [
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

export default function Drawer() {
  const router = useRouter();
  const { drawerOpen, setDrawerOpen, pinnedHrefs, togglePin, handleLogout } =
    useDashboard();

  return (
    <>
      {drawerOpen && (
        <div
          className="absolute inset-0 z-10"
          style={{ background: "rgba(44,31,20,0.30)" }}
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className="absolute top-0 bottom-0 left-0 z-20 flex flex-col"
        style={{
          width: "240px",
          background: "#503c25",
          boxShadow: "4px 0 24px rgba(44,28,10,0.30)",
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .28s cubic-bezier(.4,0,.2,1)",
          borderRight: "1px solid rgba(245,217,168,0.12)",
          height: "100%",
        }}
      >
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
                        }}
                      >
                        <i
                          className={`ti ${item.icon}`}
                          style={{ fontSize: "15px", opacity: 0.85 }}
                        />
                        {item.label}
                      </button>

                      {canPin && (
                        <button
                          onClick={() => togglePin(item.href)}
                          className={`pin-btn${isPinned ? " is-pinned" : ""}`}
                          style={{
                            padding: "10px 20px 10px 0",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: isPinned
                              ? "#F5D9A8"
                              : "rgba(245,217,168,0.30)",
                          }}
                        >
                          <i
                            className="ti ti-pin"
                            style={{ fontSize: "13px" }}
                          />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

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
          >
            <i className="ti ti-logout" style={{ fontSize: "15px" }} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
