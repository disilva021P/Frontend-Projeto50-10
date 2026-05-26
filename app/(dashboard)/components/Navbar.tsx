"use client";

import { useDashboard } from "../context/DashboardContext";

export default function Navbar() {
  const {
    setDrawerOpen,
    userName,
    showNotifPanel,
    setShowNotifPanel,
    showProfileMenu,
    setShowProfileMenu,
    unreadCount,
    notificacoes,
    marcarTodasComoLidas,
    handleLogout,
    initials,
  } = useDashboard();

  return (
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

        {/* SINO DE NOTIFICAÇÕES */}
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

        {/* BOLINHA DO PERFIL */}
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
                  window.location.href = "/utilizadores/verPerfil";
                  setShowProfileMenu(false);
                }}
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
  );
}
