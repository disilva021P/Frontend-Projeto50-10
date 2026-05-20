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
      router.push('/index');
    } catch (error: any) {
      console.error('Erro detalhado:', error.response?.data || error.message);
      alert('Falha ao entrar. Verifique os dados.');
    }
  };

  return (
    <main className="flex min-h-screen">

      {/* ── Painel esquerdo ── */}
      <div className="hidden md:flex md:w-[44%] lg:w-[40%] flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'var(--panel-dark)' }}>

        {/* Círculos decorativos */}
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full"
          style={{ border: '1px solid rgba(212,178,136,0.12)' }} />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full"
          style={{ border: '1px solid rgba(212,178,136,0.08)' }} />
        <div className="absolute top-1/3 -right-8 w-32 h-32 rounded-full"
          style={{ border: '1px solid rgba(212,178,136,0.06)' }} />

        <div className="relative z-10 flex flex-col items-center text-center px-10">
          <span className="text-3xl tracking-[6px] mb-2"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--accent-gold)', fontWeight: 400 }}>
            entartes
          </span>
          <span className="text-[10px] tracking-[4px] uppercase mb-10"
            style={{ color: 'rgba(212,178,136,0.4)', fontWeight: 300 }}>
            Escola de Dança
          </span>
          <div className="w-8 mb-10" style={{ height: '1px', background: 'rgba(212,178,136,0.2)' }} />
          <p className="text-[15px] leading-relaxed max-w-[210px]"
            style={{ fontFamily: 'var(--font-playfair)', fontStyle: 'italic', color: 'rgba(212,178,136,0.5)' }}>
            "A dança é a linguagem oculta da alma."
          </p>
          <p className="mt-3 text-[11px] tracking-wider"
            style={{ color: 'rgba(212,178,136,0.3)', fontWeight: 300 }}>
            — Martha Graham
          </p>
        </div>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 md:px-16 lg:px-24"
        style={{ background: 'var(--background)' }}>

        {/* Logo mobile only */}
        <div className="md:hidden mb-10 text-center">
          <span className="text-2xl tracking-[5px]"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--panel-dark)', fontWeight: 400 }}>
            entartes
          </span>
          <p className="text-[10px] tracking-[3px] uppercase mt-1"
            style={{ color: 'var(--accent-muted)', fontWeight: 300 }}>
            Escola de Dança
          </p>
        </div>

        <div className="w-full max-w-[400px]">
          <p className="text-[10px] tracking-[3.5px] uppercase mb-2"
            style={{ color: 'var(--accent-muted)', fontWeight: 300 }}>
            Bem-vindo de volta
          </p>
          <h1 className="text-[30px] leading-tight mb-10"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--foreground)', fontWeight: 400 }}>
            Entre na<br />sua conta
          </h1>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email"
                className="block text-[10px] tracking-[2.5px] uppercase mb-2"
                style={{ color: 'var(--accent-muted)', fontWeight: 400 }}>
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
                style={{ borderBottomColor: 'var(--border-warm)', color: 'var(--foreground)', fontFamily: 'var(--font-lato)', fontWeight: 300 }}
                onFocus={e => (e.target.style.borderBottomColor = 'var(--foreground)')}
                onBlur={e => (e.target.style.borderBottomColor = 'var(--border-warm)')}
              />
            </div>

            <div>
              <label htmlFor="password"
                className="block text-[10px] tracking-[2.5px] uppercase mb-2"
                style={{ color: 'var(--accent-muted)', fontWeight: 400 }}>
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
                style={{ borderBottomColor: 'var(--border-warm)', color: 'var(--foreground)', fontFamily: 'var(--font-lato)', fontWeight: 300 }}
                onFocus={e => (e.target.style.borderBottomColor = 'var(--foreground)')}
                onBlur={e => (e.target.style.borderBottomColor = 'var(--border-warm)')}
              />
            </div>

            <div className="text-right -mt-2">
              <button type="button"
                className="text-[11px] bg-transparent border-none cursor-pointer transition-colors duration-200"
                style={{ color: 'var(--accent-muted)', fontWeight: 300 }}
                onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--foreground)')}
                onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--accent-muted)')}>
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-4 text-[11px] tracking-[3.5px] uppercase transition-colors duration-200 cursor-pointer"
              style={{ background: 'var(--panel-dark)', color: 'var(--accent-gold)', border: 'none', borderRadius: '2px', fontFamily: 'var(--font-lato)', fontWeight: 400 }}
              onMouseEnter={e => ((e.target as HTMLElement).style.background = '#3D2A1A')}
              onMouseLeave={e => ((e.target as HTMLElement).style.background = 'var(--panel-dark)')}>
              Entrar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
