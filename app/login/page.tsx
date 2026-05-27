'use client';

import { useState, useEffect, useMemo, useCallback } 
from 'react';import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    console.log("Resposta dwqdqelfmefºqcompleta adwpadim");
    e.preventDefault();
    console.log("Resposta completa adwpadim");

    try {
      const response = await api.post('/auth/login', { email, password });
      console.log("Resposta completa:", response.data);

      // 1. Verifique o que chega no log
  
      const { token, nome, tipoId } = response.data;
  
      if (!token) {
        throw new Error("Token não recebido do servidor");
      }
  
      // 2. FORÇAR A GRAVAÇÃO APENAS DA STRING
      // Se 'token' for um objeto, pegamos a propriedade 'token' dele, 
      // caso contrário, usamos o valor diretamente.
      const tokenStr = typeof token === 'object' ? token.token : token;
      localStorage.setItem('token', tokenStr);
  
      localStorage.setItem('user', JSON.stringify({ 
        nome, 
        tipoUtilizadorId: tipoId 
      })); 
  
      // Redirecionamento
      if (tipoId === 'COORDENACAO') {
        router.push('/index');
      } else {
        router.push('/index');
      }
  
    } catch (error: any) {
      console.error("Erro detalhado:", error.response?.data || error.message);
      alert('Falha ao entrar. Verifique os dados.');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <form onSubmit={handleLogin} className="p-8 bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-400">Login 50+10</h1>
        <div className="space-y-4">

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="seu@email.com"
              onChange={(e) => setEmail(e.target.value)}/>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}/>
          </div>

          <button
            type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition duration-200">Entrar
          </button>

        </div>
      </form>
    </main>
  );
}