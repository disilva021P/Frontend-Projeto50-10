'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, nome, tipoId } = response.data;
      if (!token) throw new Error('Token não recebido do servidor');
      const tokenStr = typeof token === 'object' ? token.token : token;
      localStorage.setItem('token', tokenStr);
      localStorage.setItem('user', JSON.stringify({ nome, tipoUtilizadorId: tipoId }));
      router.push('/landingPage');
    } catch (error: any) {
      console.error('Erro detalhado:', error.response?.data || error.message);
      alert('Falha ao entrar. Verifique os dados.');
    }
  };

  return (
    <main className="flex min-h-screen">

      {/* ═══════════════════════════════════════
          PAINEL ESQUERDO — Vídeo (60%)
          ═══════════════════════════════════════ */}
      <div className="hidden md:block md:w-[60%] relative overflow-hidden">

        {/* Vídeo de fundo */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/entartes-bg.mp4" type="video/mp4" />
        </video>

        {/* Overlay escuro geral */}
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(15, 8, 2, 0.45)' }}
        />

        {/* ── Fade para o painel bege */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to left, #F2EDE4 0%, rgba(242,237,228,0.55) 18%, rgba(242,237,228,0.0) 42%)',
          }}
        />

        {/* Conteúdo sobre o vídeo */}
        <div className="relative z-10 flex flex-col justify-between h-full p-10">

          {/* Logo — topo esquerdo */}
          <div>
            <span
              className="block text-[22px] tracking-[5px]"
              style={{ fontFamily: 'var(--font-playfair)', color: 'var(--accent-gold)', fontWeight: 400 }}
            >
              entartes
            </span>
            <span
              className="block text-[9px] tracking-[4px] uppercase mt-1"
              style={{ color: 'rgba(212,178,136,0.8)', fontWeight: 300 }}
            >
              Escola de Dança
            </span>
          </div>

          {/* Lema — canto inferior esquerdo */}
          <div className="max-w-[370px]">
            <div
              className="mb-3"
              style={{ width: '24px', height: '1px', background: 'rgba(212,178,136,0.30)' }}
            />
            <p
              className="text-[16px] leading-[1.75] mb-2"
              style={{
                fontFamily: 'var(--font-playfair)',
                fontStyle: 'italic',
                color: 'rgba(212,178,136,0.72)',
              }}
            >
              "A arte começa onde o movimento encontra a emoção."
            </p>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════
          PAINEL DIREITO — Formulário (40%)
          ═══════════════════════════════════════ */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-8 md:px-10 lg:px-14"
        style={{ background: 'var(--background)' }}
      >

        {/* Logo visível só em mobile */}
        <div className="md:hidden mb-10 text-center">
          <span
            className="text-2xl tracking-[5px]"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--panel-dark)', fontWeight: 400 }}
          >
            entartes
          </span>
          <p
            className="text-[10px] tracking-[3px] uppercase mt-1"
            style={{ color: 'var(--accent-muted)', fontWeight: 300 }}
          >
            Escola de Dança
          </p>
        </div>

        <div className="w-full max-w-[360px]">

          <p
            className="text-[9px] tracking-[3.5px] uppercase mb-2"
            style={{ color: 'var(--accent-muted)', fontWeight: 300 }}
          >
            Bem-vindo
          </p>
          <h1
            className="text-[28px] leading-tight mb-10"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--foreground)', fontWeight: 400 }}
          >
            Entre na<br />sua conta
          </h1>

          <form onSubmit={handleLogin} className="space-y-6">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[9px] tracking-[2.5px] uppercase mb-2"
                style={{ color: 'var(--accent-muted)', fontWeight: 400 }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="o.seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-0 border-b pb-2 text-sm outline-none transition-colors duration-200"
                style={{
                  borderBottomColor: 'var(--border-warm)',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-lato)',
                  fontWeight: 300,
                }}
                onFocus={e => (e.target.style.borderBottomColor = 'var(--foreground)')}
                onBlur={e => (e.target.style.borderBottomColor = 'var(--border-warm)')}
              />
            </div>

            {/* Senha */}
            <div>
              <label
                htmlFor="password"
                className="block text-[9px] tracking-[2.5px] uppercase mb-2"
                style={{ color: 'var(--accent-muted)', fontWeight: 400 }}
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-0 border-b pb-2 text-sm outline-none transition-colors duration-200"
                style={{
                  borderBottomColor: 'var(--border-warm)',
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-lato)',
                  fontWeight: 300,
                }}
                onFocus={e => (e.target.style.borderBottomColor = 'var(--foreground)')}
                onBlur={e => (e.target.style.borderBottomColor = 'var(--border-warm)')}
              />
            </div>

            {/* Esqueceu a senha */}
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => router.push('/recuperarPassword')}
                className="text-[11px] bg-transparent border-none cursor-pointer transition-colors duration-200 outline-none"
                style={{ color: 'var(--accent-muted)', fontWeight: 300 }}
                onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--foreground)')}
                onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--accent-muted)')}
              >
                Esqueceu a senha?
              </button>
            </div>

            {/* Botão entrar */}
            <button
              type="submit"
              className="w-full py-4 text-[10px] tracking-[3.5px] uppercase transition-colors duration-200 cursor-pointer"
              style={{
                background: 'var(--panel-dark)',
                color: 'var(--accent-gold)',
                border: 'none',
                borderRadius: '2px',
                fontFamily: 'var(--font-lato)',
                fontWeight: 400,
              }}
              onMouseEnter={e => ((e.target as HTMLElement).style.background = '#3D2A1A')}
              onMouseLeave={e => ((e.target as HTMLElement).style.background = 'var(--panel-dark)')}
            >
              Entrar
            </button>

          </form>

        </div>
      </div>
    </main>
  );
}