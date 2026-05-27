'use client';

import { useState } from 'react';

const API_BASE_URL = 'http://localhost:8080/api/utilizadores';

type Mensagem = { texto: string; tipo: 'success' | 'error' } | null;

export default function RecuperarPasswordPage() {
    const [passo, setPasso] = useState<1 | 2>(1);
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [novaPassword, setNovaPassword] = useState('');
    const [confirmaNovaPassword, setConfirmaNovaPassword] = useState('');
    const [mensagem, setMensagem] = useState<Mensagem>(null);
    const [loading, setLoading] = useState(false);

    const exibirMensagem = (texto: string, tipo: 'success' | 'error') => {
        setMensagem({ texto, tipo });
    };

  const gerarToken = async () => {
    if (!email) {
      exibirMensagem('Por favor, insira o e-mail.', 'error');
      return;
    }
    setLoading(true);
    setMensagem(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/geraTokenEmail?email=${email}`,
        { method: 'POST' }
      );
      const data = await response.text();
      if (response.ok) {
        exibirMensagem(data, 'success');
        setPasso(2);
      } else {
        exibirMensagem(data, 'error');
      }
    } catch {
      exibirMensagem('Erro ao conectar com o servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const alterarSenha = async () => {
    if (novaPassword !== confirmaNovaPassword) {
      exibirMensagem('As palavras-passe não coincidem.', 'error');
      return;
    }
    if (!token || !novaPassword) {
      exibirMensagem('Preencha todos os campos.', 'error');
      return;
    }
    setLoading(true);
    setMensagem(null);
    try {
      const response = await fetch(`${API_BASE_URL}/esqueceuPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, novaPassword, confirmaNovaPassword }),
      });
      const data = await response.text();
      if (response.ok) {
        exibirMensagem(data, 'success');
      } else {
        exibirMensagem(data, 'error');
      }
    } catch {
      exibirMensagem('Erro ao processar alteração.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const voltar = () => {
    setPasso(1);
    setMensagem(null);
    setToken('');
    setNovaPassword('');
    setConfirmaNovaPassword('');
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-400">Recuperação de Acesso</h1>
          <p className="text-gray-500 text-sm mt-1">
            {passo === 1
              ? 'Insira o seu e-mail para receber o código de validação.'
              : 'Verifique o seu e-mail e defina uma nova palavra-passe.'}
          </p>
        </div>

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 space-y-4">

          {/* Indicador de passo */}
          <div className="flex items-center gap-3 mb-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${
              passo === 1 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'
            }`}>1</div>
            <div className={`flex-1 h-px ${passo === 2 ? 'bg-blue-500' : 'bg-gray-700'}`} />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${
              passo === 2 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'
            }`}>2</div>
          </div>

          {/* PASSO 1 */}
          {passo === 1 && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && gerarToken()}
                  placeholder="utilizador@email.com"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white outline-none focus:border-blue-500 transition placeholder-gray-600"
                />
              </div>
              <button
                onClick={gerarToken}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-xl font-bold text-sm transition"
              >
                {loading ? 'A enviar...' : 'Enviar Código'}
              </button>
            </>
          )}

          {/* PASSO 2 */}
          {passo === 2 && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white outline-none focus:border-blue-500 transition placeholder-gray-600 tracking-widest text-lg"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Nova Palavra-passe
                </label>
                <input
                  type="password"
                  value={novaPassword}
                  onChange={(e) => setNovaPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white outline-none focus:border-blue-500 transition placeholder-gray-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">
                  Confirmar Nova Palavra-passe
                </label>
                <input
                  type="password"
                  value={confirmaNovaPassword}
                  onChange={(e) => setConfirmaNovaPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white outline-none focus:border-blue-500 transition placeholder-gray-600"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={voltar}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-bold text-sm transition"
                >
                  Voltar
                </button>
                <button
                  onClick={alterarSenha}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-xl font-bold text-sm transition"
                >
                  {loading ? 'A alterar...' : 'Alterar Palavra-passe'}
                </button>
              </div>
            </>
          )}

          {/* Mensagem de feedback */}
          {mensagem && (
            <div className={`text-xs font-bold p-3 rounded-lg border ${
              mensagem.tipo === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {mensagem.texto}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
