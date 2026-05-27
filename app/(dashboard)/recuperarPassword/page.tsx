'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE_URL = 'http://localhost:8080/api/utilizadores';

type Mensagem = { texto: string; tipo: 'success' | 'error' } | null;

export default function RecuperarPasswordPage() {
  const router = useRouter();
  const [passo, setPasso] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [novaPassword, setNovaPassword] = useState('');
  const [confirmaNovaPassword, setConfirmaNovaPassword] = useState('');
  const [mensagem, setMensagem] = useState<Mensagem>(null);
  const [loading, setLoading] = useState(false);
  const [countDown, setCountDown] = useState<number | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (countDown === null) return;
    if (countDown === 0) {
      router.push('/');
      return;
    }
    const t = setTimeout(() => setCountDown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countDown, router]);

  const exibirMensagem = (texto: string, tipo: 'success' | 'error') => {
    setMensagem({ texto, tipo });
  };

  const gerarToken = async () => {
    if (!email) { exibirMensagem('Por favor, insira o seu e-mail.', 'error'); return; }
    setLoading(true);
    setMensagem(null);
    try {
      const response = await fetch(`${API_BASE_URL}/geraTokenEmail?email=${email}`, { method: 'POST' });
      const data = await response.text();
      if (response.ok) { exibirMensagem(data, 'success'); setPasso(2); }
      else exibirMensagem(data, 'error');
    } catch {
      exibirMensagem('Erro ao conectar com o servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const alterarSenha = async () => {
    if (novaPassword !== confirmaNovaPassword) { exibirMensagem('As palavras-passe não coincidem.', 'error'); return; }
    if (!token || !novaPassword) { exibirMensagem('Preencha todos os campos obrigatórios.', 'error'); return; }
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
        setSucesso(true);
        setCountDown(3);
      } else {
        exibirMensagem(data, 'error');
      }
    } catch {
      exibirMensagem('Erro ao processar a alteração da palavra-passe.', 'error');
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

  const inputStyle = {
    background: 'var(--background)',
    border: '1px solid var(--border-warm)',
    color: 'var(--panel-dark)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  const labelStyle = {
    fontSize: '11px',
    color: 'var(--accent-muted)',
    letterSpacing: '1px',
  };

  return (
    <main
      className="h-screen w-screen flex items-center justify-center overflow-hidden fixed inset-0 select-none"
      style={{ background: 'var(--background)', padding: '0 1.5rem' }}
    >
      <div 
        className="w-full max-h-[92vh] overflow-y-auto pr-1 flex flex-col justify-center" 
        style={{ maxWidth: '420px', scrollbarWidth: 'none' }}
      >
        {/* Cabeçalho */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 transition-transform hover:rotate-6"
            style={{ background: '#FFFCF8', border: '1px solid var(--border-warm)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
          >
            <i className="ti ti-lock-open" style={{ fontSize: '20px', color: 'var(--accent-gold)' }} />
          </div>
          <h1
            className="tracking-normal mb-1.5"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--panel-dark)', fontWeight: 400, fontSize: '24px' }}
          >
            Recuperação de Acesso
          </h1>
          <p className="font-light px-4 leading-relaxed" style={{ fontSize: '13px', color: 'var(--accent-muted)' }}>
            {sucesso
              ? 'A sua conta foi reconfigurada.'
              : passo === 1
              ? 'Insira o e-mail associado à sua conta para receber um código.'
              : 'Verifique a sua caixa de entrada e configure a nova credencial.'}
          </p>
        </div>

        {/* Card Principal */}
        <div
          className="rounded-sm transition-all duration-300"
          style={{ 
            background: '#FFFCF8', 
            border: '1px solid var(--border-warm)', 
            padding: '2rem',
            boxShadow: '0 10px 30px rgba(44,31,20,0.04)'
          }}
        >
          {/* --- ESTADO DE SUCESSO --- */}
          {sucesso ? (
            <div className="text-center py-4">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 animate-bounce"
                style={{ background: '#F0F5E8', border: '1px solid #C4D6A8' }}
              >
                <i className="ti ti-circle-check" style={{ fontSize: '28px', color: '#3A5A1A' }} />
              </div>
              <p className="font-normal text-base" style={{ color: 'var(--panel-dark)', marginBottom: '0.5rem' }}>
                Alteração Concluída!
              </p>
              <p className="font-light" style={{ fontSize: '13px', color: 'var(--accent-muted)' }}>
                A redirecionar para o painel em <span className="font-medium" style={{ color: 'var(--panel-dark)' }}>{countDown}s</span>...
              </p>
            </div>
          ) : (
            <>
              {/* Indicador de passos */}
              <div className="flex items-center gap-3 mb-6 px-1">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full font-medium transition-all duration-300"
                  style={{
                    fontSize: '12px',
                    background: passo >= 1 ? 'var(--panel-dark)' : 'transparent',
                    border: `1px solid ${passo >= 1 ? 'var(--panel-dark)' : 'var(--border-warm)'}`,
                    color: passo >= 1 ? 'var(--accent-gold)' : 'var(--accent-muted)',
                  }}
                >
                  {passo === 2 ? <i className="ti ti-check" style={{ fontSize: '12px' }} /> : '1'}
                </div>
                <div className="flex-1 h-px transition-all duration-500" style={{ background: passo === 2 ? 'var(--accent-gold)' : 'var(--border-warm)' }} />
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full font-medium transition-all duration-300"
                  style={{
                    fontSize: '12px',
                    background: passo === 2 ? 'var(--panel-dark)' : 'transparent',
                    border: `1px solid ${passo === 2 ? 'var(--panel-dark)' : 'var(--border-warm)'}`,
                    color: passo === 2 ? 'var(--accent-gold)' : 'var(--accent-muted)',
                  }}
                >
                  2
                </div>
              </div>

              {/* PASSO 1: Inserir Email */}
              {passo === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label className="block uppercase tracking-wider font-medium mb-1.5" style={labelStyle}>
                      Endereço de E-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && gerarToken()}
                      placeholder="exemplo@entartes.com"
                      className="w-full rounded-sm outline-none font-light shadow-2xs focus:shadow-md"
                      style={{ ...inputStyle, padding: '10px 14px', fontSize: '14px' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--accent-gold)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(245,217,168,0.2)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-warm)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  <button
                    onClick={gerarToken}
                    disabled={loading}
                    className="w-full rounded-sm font-medium uppercase tracking-wider transition-all duration-200 disabled:opacity-50 active:scale-[0.99]"
                    style={{ background: 'var(--panel-dark)', color: 'var(--accent-gold)', padding: '12px', fontSize: '13px', boxShadow: '0 4px 12px rgba(80,60,37,0.15)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    {loading ? 'A processar...' : 'Enviar Código'}
                  </button>
                </div>
              )}

              {/* PASSO 2: Inserir Token e Novas Senhas */}
              {passo === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label className="block uppercase tracking-wider font-medium mb-1.5" style={labelStyle}>
                      Código de Confirmação
                    </label>
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      maxLength={6}
                      className="w-full rounded-sm outline-none font-medium tracking-[0.4em] text-center"
                      style={{ ...inputStyle, padding: '10px 14px', fontSize: '16px' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--accent-gold)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(245,217,168,0.2)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border-warm)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                    <p className="font-light text-center mt-2" style={{ fontSize: '11px', color: 'var(--accent-muted)' }}>
                      Enviámos um token de 6 dígitos para <span className="font-normal" style={{ color: 'var(--panel-dark)' }}>{email}</span>
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col gap-4" style={{ borderTop: '1px solid rgba(245,217,168,0.25)' }}>
                    {[
                      { label: 'Nova Palavra-passe', value: novaPassword, setter: setNovaPassword },
                      { label: 'Confirmar Nova Palavra-passe', value: confirmaNovaPassword, setter: setConfirmaNovaPassword },
                    ].map(({ label, value, setter }) => (
                      <div key={label}>
                        <label className="block uppercase tracking-wider font-medium mb-1.5" style={labelStyle}>
                          {label}
                        </label>
                        <input
                          type="password"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-sm outline-none font-light"
                          style={{ ...inputStyle, padding: '10px 14px', fontSize: '14px' }}
                          onFocus={(e) => {
                            e.target.style.borderColor = 'var(--accent-gold)';
                            e.target.style.boxShadow = '0 0 0 3px rgba(245,217,168,0.2)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'var(--border-warm)';
                            e.target.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-1">
                    <button
                      onClick={voltar}
                      className="flex-1 rounded-sm font-normal transition-all duration-200 hover:bg-panel-dark/5 active:scale-[0.99]"
                      style={{ border: '1px solid var(--border-warm)', color: 'var(--panel-dark)', background: 'transparent', padding: '12px', fontSize: '13px' }}
                    >
                      Voltar
                    </button>
                    <button
                      onClick={alterarSenha}
                      disabled={loading}
                      className="flex-1 rounded-sm font-medium uppercase tracking-wider transition-all duration-200 disabled:opacity-50 active:scale-[0.99]"
                      style={{ background: 'var(--panel-dark)', color: 'var(--accent-gold)', padding: '12px', fontSize: '13px', boxShadow: '0 4px 12px rgba(80,60,37,0.15)' }}
                    >
                      {loading ? 'A gravar...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Feedback dinâmico */}
              {mensagem && (
                <div
                  className="rounded-sm flex items-start gap-2.5 font-light animate-fadeIn"
                  style={{
                    marginTop: '1.25rem',
                    padding: '12px 14px',
                    fontSize: '13px',
                    background: mensagem.tipo === 'success' ? '#F0F5E8' : '#F9EDEA',
                    border: `1px solid ${mensagem.tipo === 'success' ? '#C4D6A8' : '#E8C4BE'}`,
                    color: messageColor(mensagem.tipo),
                  }}
                >
                  <i className={`ti flex-shrink-0 text-base ${mensagem.tipo === 'success' ? 'ti-circle-check' : 'ti-alert-circle'}`} style={{ marginTop: '1px' }} />
                  <span className="leading-snug">{mensagem.texto}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        {!sucesso && (
          <p
            className="text-center font-light uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ fontSize: '11px', color: 'var(--accent-muted)', marginTop: '2rem' }}
          >
            Lembrou-se da conta?{' '}
            <a href="/" style={{ color: 'var(--accent-gold)', fontWeight: 400 }} className="hover:underline">
              Voltar ao Início
            </a>
          </p>
        )}
      </div>
    </main>
  );
}

// Auxiliar simples fora do componente para manter as cores limpas
function messageColor(type: 'success' | 'error') {
  return type === 'success' ? '#3A5A1A' : '#7A2E20';
}