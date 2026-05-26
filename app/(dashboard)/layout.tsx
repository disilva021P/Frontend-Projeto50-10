"use client";

import { DashboardProvider } from "./context/DashboardContext";
import Navbar from "./components/Navbar";
import Drawer from "./components/Drawer";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullHeight = pathname === "/mensagens";

  return (
    <DashboardProvider>
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
        {/* Navbar fixa no topo */}
        <Navbar />

        <div className="flex flex-1 relative overflow-hidden">
          {/* Menu lateral */}
          <Drawer />

          {/* Conteúdo dinâmico das páginas internas */}
          {isFullHeight ? (
            <main className="flex-1 overflow-hidden flex flex-col">
              {children}
            </main>
          ) : (
            <main className="flex-1 overflow-y-auto" style={{ padding: "28px 28px 40px" }}>
              {children}
            </main>
          )}
        </div>

        {/* Rodapé — escondido em páginas full-height */}
        {!isFullHeight && (
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
        )}
      </div>
    </DashboardProvider>
  );
}
