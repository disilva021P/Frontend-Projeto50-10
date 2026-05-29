'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Tipos Alinhados com os Records do Back-end ──────────────────────────────
type Role = 'ALUNO' | 'COORDENACAO' | 'PROFESSOR' | 'ENCARREGADO';

interface FaltaDto {
  id: string;
  aulaId: string;
  utilizadorId: string;
  justificado: boolean;
  motivo?: string;
  estado: string; // Ex: "PENDENTE", "APROVADA", "REJEITADA", "INJUSTIFICADA"
}

interface FaltaResumoDto {
  total: number;
  justificadas: number;
  pendentes: number;
  injustificadas: number;
}

const BASE_URL = 'http://localhost:8080';

export default function GestaoFaltasPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);

  // Estados de dados da API
  const [faltas, setFaltas] = useState<FaltaDto[]>([]);
  const [resumo, setResumo] = useState<FaltaResumoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Estados para o fluxo de Justificação (Upload de PDF)
  const [faltaSelecionadaId, setFaltaSelecionadaId] = useState<string | null>(null);
  const [motivoJustificacao, setMotivoJustificacao] = useState('');
  const [ficheiroPdf, setFicheiroPdf] = useState<File | null>(null);
  const [submittingJustificacao, setSubmittingJustificacao] = useState(false);

  // 1. Inicializar Utilizador (Apenas para descobrir a Role e carregar os dados)
  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setRole((parsed.tipoUtilizadorId as Role) ?? null);
      } catch { /* ignora */ }
    }
  }, []);

  // 2. Carregar Faltas e Estatísticas baseadas no Perfil
  useEffect(() => {
    if (!role) return;

    const token = localStorage.getItem('token') ?? '';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    let endpointLista = `${BASE_URL}/api/faltas/meu-perfil/detalhe`;
    let endpointStats = `${BASE_URL}/api/faltas/meu-perfil/estatisticas`;

    if (role === 'COORDENACAO') {
      endpointLista = `${BASE_URL}/api/faltas`; 
      endpointStats = ''; 
    } else if (role === 'ENCARREGADO') {
      endpointLista = `${BASE_URL}/api/faltas/encarregado/educandos/faltas`;
      endpointStats = `${BASE_URL}/api/faltas/encarregado/educandos/estatisticas`;
    }

    setLoading(true);

    const chamadas = [fetch(endpointLista, { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); })];
    if (endpointStats) {
      chamadas.push(fetch(endpointStats, { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }));
    }

    Promise.all(chamadas)
      .then(([dadosLista, dadosStats]) => {
        setFaltas(dadosLista ?? []);
        if (dadosStats) setResumo(dadosStats);
      })
      .catch(() => setErro('Não foi possível carregar os dados de assiduidade.'))
      .finally(() => setLoading(false));
  }, [role]);

  // Ação de Validação/Aprovação (Exclusivo COORDENACAO)
  const handleValidarFalta = async (id: string, aprovada: boolean) => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/api/faltas/${id}/validar?aprovada=${aprovada}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      
      setFaltas(prev => prev.map(f => f.id === id ? { ...f, estado: aprovada ? 'APROVADA' : 'REJEITADA', justificado: aprovada } : f));
      alert('Validação registada com sucesso.');
    } catch {
      alert('Erro ao validar a falta.');
    }
  };

  // Ação de Remoção de Falta (Exclusivo COORDENACAO)
  const handleRemoverFalta = async (id: string) => {
    if (!confirm('Tem a certeza que deseja eliminar permanentemente este registo de falta?')) return;
    const token = localStorage.getItem('token') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/api/faltas/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      setFaltas(prev => prev.filter(f => f.id !== id));
    } catch {
      alert('Erro ao remover falta.');
    }
  };

  // Submissão do Multipart/FormData de Justificação (Alunos, Encarregados, Professores)
  const handleSubmeterJustificacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faltaSelecionadaId || !ficheiroPdf || !motivoJustificacao.trim()) {
      alert('Preencha todos os campos e anexe o ficheiro PDF.');
      return;
    }

    const token = localStorage.getItem('token') ?? '';
    setSubmittingJustificacao(true);

    const formData = new FormData();
    formData.append('pdf', ficheiroPdf);
    formData.append('motivo', motivoJustificacao);

    try {
      const res = await fetch(`${BASE_URL}/api/faltas/${faltaSelecionadaId}/justificar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error();

      alert('Justificação submetida! Aguarda validação da coordenação.');
      setFaltas(prev => prev.map(f => f.id === faltaSelecionadaId ? { ...f, estado: 'PENDENTE', motivo: motivoJustificacao } : f));
      
      setFaltaSelecionadaId(null);
      setMotivoJustificacao('');
      setFicheiroPdf(null);
    } catch {
      alert('Falha ao enviar o documento comprovativo.');
    } finally {
      setSubmittingJustificacao(false);
    }
  };

  // Abrir visualização nativa de PDF (Exclusivo COORDENACAO)
  const handleVerPdf = (id: string) => {
    const token = localStorage.getItem('token') ?? '';
    fetch(`${BASE_URL}/api/faltas/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      })
      .catch(() => alert('Documento não disponível ou sem anexo para esta falta.'));
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      {/* TÍTULO E INTRODUÇÃO DA PÁGINA */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>
          Controlo de Assiduidade
        </p>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', color: 'var(--panel-dark)', fontWeight: 400, margin: 0 }}>
          Registo de Faltas
        </h1>
      </div>

      {loading ? (
        <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderRadius: '8px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-warm)', borderTopColor: 'var(--accent-gold)', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : erro ? (
        <div style={{ background: '#fff', border: '1px solid var(--border-warm)', padding: '20px', borderRadius: '8px', color: 'var(--accent-muted)', fontSize: '13px' }}>{erro}</div>
      ) : (
        <>
          {/* ── CARDS DE RESUMO ── */}
          {resumo && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-muted)', marginBottom: '4px' }}>Total de Faltas</div>
                <div style={{ fontSize: '22px', color: 'var(--panel-dark)' }}>{resumo.total}</div>
              </div>
              <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderLeft: '3px solid #2E7D32', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-muted)', marginBottom: '4px' }}>Justificadas</div>
                <div style={{ fontSize: '22px', color: '#2E7D32' }}>{resumo.justificadas}</div>
              </div>
              <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderLeft: '3px solid #B58100', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-muted)', marginBottom: '4px' }}>Em Análise (Pendentes)</div>
                <div style={{ fontSize: '22px', color: '#B58100' }}>{resumo.pendentes}</div>
              </div>
              <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderLeft: '3px solid #C62828', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--accent-muted)', marginBottom: '4px' }}>Injustificadas</div>
                <div style={{ fontSize: '22px', color: '#C62828' }}>{resumo.injustificadas}</div>
              </div>
            </div>
          )}

          {/* ── FORMULÁRIO DE JUSTIFICAÇÃO FLUTUANTE ── */}
          {faltaSelecionadaId && (
            <div style={{ background: '#FFFDF9', border: '1px solid var(--accent-gold)', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontFamily: 'var(--font-playfair)', fontSize: '15px', color: 'var(--panel-dark)', marginBottom: '12px', margin: 0 }}>Submeter Comprovativo de Falta</h3>
              <form onSubmit={handleSubmeterJustificacao} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--panel-dark)', display: 'block', marginBottom: '4px' }}>Motivo Explicativo:</label>
                  <input type="text" value={motivoJustificacao} onChange={e => setMotivoJustificacao(e.target.value)} required placeholder="Ex: Doença, Consulta Médica..." style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border-warm)', background: '#FFF', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--panel-dark)', display: 'block', marginBottom: '4px' }}>Documento Justificativo (Apenas PDF):</label>
                  <input type="file" accept="application/pdf" onChange={e => setFicheiroPdf(e.target.files?.[0] || null)} required style={{ fontSize: '12px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button type="submit" disabled={submittingJustificacao} style={{ background: 'var(--panel-dark)', color: 'var(--accent-gold)', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
                    {submittingJustificacao ? 'A enviar...' : 'Enviar PDF'}
                  </button>
                  <button type="button" onClick={() => setFaltaSelecionadaId(null)} style={{ background: 'transparent', border: '1px solid var(--border-warm)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', color: 'var(--accent-muted)', cursor: 'pointer' }}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {/* ── TABELA DE FALTAS REAL ── */}
          <div style={{ background: '#FFFCF8', border: '1px solid var(--border-warm)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-warm)', background: '#FBF7F2' }}>
              <h3 style={{ fontFamily: 'var(--font-playfair)', fontSize: '15px', color: 'var(--panel-dark)', fontWeight: 400, margin: 0 }}>Histórico de Assiduidade</h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-warm)', color: 'var(--accent-muted)', background: '#FAF6F0' }}>
                    <th style={{ padding: '12px 20px', fontSize: '11px', textTransform: 'uppercase' }}>ID Aula</th>
                    {role === 'COORDENACAO' && <th style={{ padding: '12px 20px', fontSize: '11px', textTransform: 'uppercase' }}>ID Aluno</th>}
                    <th style={{ padding: '12px 20px', fontSize: '11px', textTransform: 'uppercase' }}>Motivo Registado</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', textTransform: 'uppercase' }}>Estado</th>
                    <th style={{ padding: '12px 20px', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faltas.length === 0 ? (
                    <tr>
                      <td colSpan={role === 'COORDENACAO' ? 5 : 4} style={{ padding: '30px', textAlign: 'center', color: 'var(--accent-muted)' }}>Nenhum registo de falta pendente ou arquivado.</td>
                    </tr>
                  ) : (
                    faltas.map(falta => (
                      <tr key={falta.id} style={{ borderBottom: '1px solid rgba(212,178,136,0.15)', color: 'var(--panel-dark)' }}>
                        <td style={{ padding: '14px 20px', fontFamily: 'monospace' }}>{falta.aulaId}</td>
                        {role === 'COORDENACAO' && <td style={{ padding: '14px 20px' }}>{falta.utilizadorId}</td>}
                        <td style={{ padding: '14px 20px' }}>
                          <div>{falta.motivo || <span style={{ color: 'var(--accent-muted)', fontStyle: 'italic' }}>Não especificado</span>}</div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: 500,
                            backgroundColor: falta.estado === 'APROVADA' || falta.justificado ? 'rgba(52, 168, 83, 0.08)' : falta.estado === 'PENDENTE' ? 'rgba(249, 171, 0, 0.08)' : 'rgba(234, 67, 53, 0.08)',
                            color: falta.estado === 'APROVADA' || falta.justificado ? '#2E7D32' : falta.estado === 'PENDENTE' ? '#B58100' : '#C62828'
                          }}>
                            {falta.estado || (falta.justificado ? 'JUSTIFICADA' : 'INJUSTIFICADA')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            
                            {/* Operações da COORDENAÇÃO */}
                            {role === 'COORDENACAO' && (
                              <>
                                <button onClick={() => handleVerPdf(falta.id)} title="Ver PDF Anexo" style={{ background: 'none', border: 'none', color: 'var(--panel-dark)', cursor: 'pointer' }}><i className="ti ti-file-text" style={{ fontSize: '16px' }} /></button>
                                <button onClick={() => handleValidarFalta(falta.id, true)} title="Aprovar/Validar" style={{ background: 'none', border: 'none', color: '#2E7D32', cursor: 'pointer' }}><i className="ti ti-check" style={{ fontSize: '16px' }} /></button>
                                <button onClick={() => handleValidarFalta(falta.id, false)} title="Rejeitar Justificação" style={{ background: 'none', border: 'none', color: '#B58100', cursor: 'pointer' }}><i className="ti ti-x" style={{ fontSize: '16px' }} /></button>
                                <button onClick={() => handleRemoverFalta(falta.id)} title="Eliminar Falta" style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer' }}><i className="ti ti-trash" style={{ fontSize: '16px' }} /></button>
                              </>
                            )}

                            {/* Operação de Alunos/Encarregados */}
                            {role !== 'COORDENACAO' && !falta.justificado && falta.estado !== 'PENDENTE' && (
                              <button onClick={() => setFaltaSelecionadaId(falta.id)} style={{ background: 'var(--panel-dark)', border: 'none', color: 'var(--accent-gold)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                Justificar
                              </button>
                            )}
                            
                            {role !== 'COORDENACAO' && (falta.justificado || falta.estado === 'PENDENTE') && (
                              <span style={{ fontSize: '11px', color: 'var(--accent-muted)' }}>Em análise</span>
                            )}

                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}