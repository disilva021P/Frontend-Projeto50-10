'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

// ─── DTOs (Sincronizados com o Backend) ──────────────────────────────────────

interface FaltaDto {
  id?: string;
  aulaId: string;
  utilizadorId: string;
  justificado: boolean;
  motivo: string;
  estado: string;
}

interface FaltaResponseDto {
  id: string;
  data: string;
  diaSemana: string;
  horario: string;
  disciplina: string;
  estado: string; // PENDENTE, APROVADA, INJUSTIFICADA
  professor: string;
  observacoes: string;
  utilizadorId?: string;
}

interface FaltaResumoDto {
  total: number;
  justificadas: number;
  pendentes: number;
  injustificadas: number;
}

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

function Badge({ estado }: { estado: string }) {
  const styles = {
    APROVADA: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50 shadow-[0_0_10px_rgba(52,211,153,0.1)]",
    REJEITADA: "bg-red-900/60 text-red-300 border-red-700/50",
    PENDENTE: "bg-amber-900/60 text-amber-300 border-amber-700/50",
    INJUSTIFICADA: "bg-red-900/60 text-red-300 border-red-700/50", // Mapeado para vermelho
    // Fallback para estilos antigos ou variações
    REJECTED: "bg-red-900/60 text-red-300 border-red-700/50"
  };

  const label = estado === 'APROVADA' ? 'Justificada' : 
                estado === 'PENDENTE' ? 'Pendente' : 
                estado === 'INJUSTIFICADA' || estado === 'REJEITADA' ? 'Injustificada' : 'Desconhecido';

  const dotColor = estado === 'APROVADA' ? 'bg-emerald-400' :
                   estado === 'PENDENTE' ? 'bg-amber-400 animate-pulse' : 'bg-red-400';

  const currentStyle = styles[estado as keyof typeof styles] || styles.INJUSTIFICADA;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStyle}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`bg-gray-800/80 border ${color} rounded-xl p-4 flex flex-col gap-1 transition-transform hover:scale-[1.02]`}>
      <span className="text-xs text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-3xl font-bold text-white">{value}</span>
    </div>
  );
}

// ─── MODAL DE JUSTIFICAÇÃO ────────────────────────────────────────────────────

interface ModalJustificacaoProps {
  faltaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalJustificacao({ faltaId, onClose, onSuccess }: ModalJustificacaoProps) {
  const [pdf, setPdf] = useState<File | null>(null);
  const [motivo, setMotivo] = useState(""); 
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdf) return alert('Selecione um ficheiro PDF.');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('pdf', pdf); 
      formData.append('motivo', motivo || "Justificação de falta"); 

      await api.post(`/faltas/${faltaId}/justificar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('Justificação submetida com sucesso.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data || 'Erro ao submeter justificação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Submeter Justificação</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition bg-gray-900/30"
            onClick={() => fileRef.current?.click()}
          >
            {pdf ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-blue-400 text-sm font-medium">{pdf.name}</span>
                <span className="text-xs text-gray-500">Clique para trocar</span>
              </div>
            ) : (
              <span className="text-gray-400 text-sm">Selecione o PDF médico/comprovativo</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => setPdf(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex gap-3 justify-end mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm transition">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-50">
              {submitting ? 'A enviar...' : 'Enviar Justificação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL DE EDIÇÃO ──────────────────────────────────────────────────────────

interface ModalEdicaoProps {
  falta: any; // Aceita FaltaDto ou FaltaResponseDto
  onClose: () => void;
  onSuccess: () => void;
}

function ModalEdicao({ falta, onClose, onSuccess }: ModalEdicaoProps) {
  const [form, setForm] = useState({
    motivo: falta.observacoes || falta.motivo || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/faltas/${falta.id}`, { motivo: form.motivo });
      alert('Falta atualizada com sucesso.');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.response?.data || 'Erro ao atualizar falta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white">Editar Registo</h3>
          <p className="text-xs text-gray-400">{falta.disciplina || `Aula ID: ${falta.aulaId}`}</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 ml-1">Observações / Motivo</label>
            <textarea
              placeholder="Notas internas..."
              className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={form.motivo}
              onChange={e => setForm({ ...form, motivo: e.target.value })}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm transition">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-50">
              {saving ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────

export default function FaltasPage() {
  const [faltas, setFaltas] = useState<any[]>([]); // Permite ambos DTOs
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [estatisticas, setEstatisticas] = useState<FaltaResumoDto | null>(null);

  const [pesquisaId, setPesquisaId] = useState('');
  const [pesquisando, setPesquisando] = useState(false);
  const [modalJustificacao, setModalJustificacao] = useState<string | null>(null);
  const [modalEdicao, setModalEdicao] = useState<any | null>(null);

  const [formData, setFormData] = useState<FaltaDto>({
    aulaId: '',
    utilizadorId: '',
    justificado: false,
    motivo: '',
    estado: ''
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      carregarDados(parsedUser.tipoUtilizadorId);
      carregarEstatisticas(parsedUser.tipoUtilizadorId);
    }
  }, []);

  const carregarDados = async (role: string) => {
    setLoading(true);
    try {
      let endpoint = '/faltas/meu-perfil/detalhe';
      if (role === 'COORDENACAO') {
        endpoint = '/faltas'; 
      } else if (role === 'ENCARREGADO') {
        endpoint = '/faltas/encarregado/educandos/faltas';
      } 
      const response = await api.get(endpoint);
      setFaltas(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro:', error);
      setFaltas([]);
    } finally {
      setLoading(false);
    }
  };

  const carregarEstatisticas = async (role: string) => {
    if (role !== 'ALUNO' && role !== 'PROFESSOR' && role !== 'ENCARREGADO') return;
    try {
      let endpoint = role === 'ENCARREGADO' 
        ? '/faltas/encarregado/educandos/estatisticas' 
        : '/faltas/meu-perfil/estatisticas';
      const response = await api.get(endpoint);
      setEstatisticas(response.data);
    } catch (error) {
      console.error('Erro estatísticas:', error);
    }
  };

  const handleMarcarFalta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/faltas/marcar', formData);
      alert('Falta registada!');
      setFormData({ aulaId: '', utilizadorId: '', justificado: false, motivo: '' ,estado:''});
      carregarDados(user.tipoUtilizadorId);
    } catch (error: any) {
      alert(error.response?.data || 'Erro');
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm('Deseja remover?')) return;
    try {
      await api.delete(`/faltas/${id}`);
      setFaltas(faltas.filter(f => f.id !== id));
    } catch (error) {
      alert('Erro.');
    }
  };

  const handleValidar = async (id: string, aprovada: boolean) => {
    const acao = aprovada ? 'aprovar' : 'rejeitar';
    if (!confirm(`Deseja ${acao}?`)) return;
    try {
      await api.patch(`/faltas/${id}/validar`, null, { params: { aprovada } });
      carregarDados(user.tipoUtilizadorId);
    } catch (error: any) {
      alert(error.response?.data || 'Erro.');
    }
  };

  const handleVerPdf = async (id: string) => {
    try {
      const response = await api.get(`/faltas/${id}/pdf`, { responseType: 'blob' });
      const fileURL = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(fileURL, '_blank');
    } catch (error) {
      alert('PDF não encontrado.');
    }
  };

  const handlePesquisarAluno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pesquisaId.trim()) return;
    setPesquisando(true);
    try {
      const response = await api.get(`/faltas/utilizador/${pesquisaId}/detalhe`);
      setFaltas(response.data);
    } catch (error: any) {
      alert('Não encontrado.');
    } finally {
      setPesquisando(false);
    }
  };

  const handleLimparPesquisa = () => {
    setPesquisaId('');
    carregarDados(user.tipoUtilizadorId);
  };

  const handleFaltasPendentes = async () => {
    try {
      const response = await api.get('/faltas/pendentes');
      setFaltas(response.data);
    } catch (error) {
      alert('Erro.');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">Sincronizando...</div>;

  const role = user?.tipoUtilizadorId;
  const isCoordenacao = role === 'COORDENACAO';
  const isProfessor = role === 'PROFESSOR';
  const isAluno = role === 'ALUNO';
  const isEncarregado = role === 'ENCARREGADO';

  return (
    <main className="min-h-screen bg-gray-900 text-white pb-20">
      {modalJustificacao && (
        <ModalJustificacao
          faltaId={modalJustificacao}
          onClose={() => setModalJustificacao(null)}
          onSuccess={() => { carregarDados(role); carregarEstatisticas(role); }}
        />
      )}
      {modalEdicao && (
        <ModalEdicao
          falta={modalEdicao}
          onClose={() => setModalEdicao(null)}
          onSuccess={() => carregarDados(role)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">Gestão de Faltas</h1>
            <p className="text-gray-400 mt-2">Portal de assiduidade académica</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-800/50 p-2 rounded-2xl border border-gray-700/50">
            <div className="pl-4 pr-2 text-right">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-tighter">Utilizador</p>
              <p className="text-sm font-semibold text-blue-400">{user?.nome}</p>
            </div>
            <span className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-black uppercase">
              {role}
            </span>
          </div>
        </header>

        {estatisticas && (isAluno || isProfessor || isEncarregado) && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard label="Total de Faltas" value={estatisticas.total} color="border-gray-700" />
            <StatCard label="Justificadas" value={estatisticas.justificadas} color="border-emerald-700/50" />
            <StatCard label="Em Análise" value={estatisticas.pendentes} color="border-amber-700/50" />
            <StatCard label="Injustificadas" value={estatisticas.injustificadas} color="border-red-700/50" />
          </section>
        )}

        {(isProfessor || isCoordenacao) && (
          <section className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-2xl p-6 mb-10 shadow-xl">
            <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-2 h-5 bg-blue-500 rounded-full" />
              Registar Falta Manual
            </h2>
            <form onSubmit={handleMarcarFalta} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input required placeholder="ID do Aluno" value={formData.utilizadorId} className="bg-gray-900/50 text-white p-3 rounded-xl border border-gray-700 outline-none" onChange={e => setFormData({ ...formData, utilizadorId: e.target.value })} />
              <input required placeholder="ID da Aula" value={formData.aulaId} className="bg-gray-900/50 text-white p-3 rounded-xl border border-gray-700 outline-none" onChange={e => setFormData({ ...formData, aulaId: e.target.value })} />
              <input placeholder="Motivo/Obs" value={formData.motivo} className="bg-gray-900/50 text-white p-3 rounded-xl border border-gray-700 outline-none" onChange={e => setFormData({ ...formData, motivo: e.target.value })} />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition">
                Registar Falta
              </button>
            </form>
          </section>
        )}

        {isCoordenacao && (
          <section className="flex flex-col sm:flex-row gap-3 mb-8">
            <form onSubmit={handlePesquisarAluno} className="flex gap-2 flex-1">
              <input
                placeholder="Pesquisar por ID do aluno..."
                value={pesquisaId}
                onChange={e => setPesquisaId(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 text-white px-5 py-3 rounded-xl outline-none"
              />
              <button type="submit" disabled={pesquisando} className="bg-gray-700 hover:bg-gray-600 px-6 rounded-xl font-bold transition">
                {pesquisando ? '...' : 'Procurar'}
              </button>
              {pesquisaId && (
                <button type="button" onClick={handleLimparPesquisa} className="bg-red-900/30 text-red-400 px-4 rounded-xl">✕</button>
              )}
            </form>
            <button onClick={handleFaltasPendentes} className="bg-amber-600/20 border border-amber-600/40 text-amber-400 px-6 py-3 rounded-xl font-bold transition">
              Pedidos Pendentes
            </button>
          </section>
        )}

        <section className="bg-gray-800/60 border border-gray-700/50 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-800/90 border-b border-gray-700">
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">ID Registo</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">ID Aula / Aluno</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Observações</th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {faltas.map((falta: any) => (
                  <tr key={falta.id} className="hover:bg-gray-700/20 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-400">{falta.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-200">
                          {falta.disciplina || `Aula: ${falta.aulaId}`}
                        </span>
                        <span className="text-xs text-gray-500">
                          {falta.data ? `${falta.data} (${falta.diaSemana})` : `Utilizador: ${falta.utilizadorId}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge estado={falta.estado} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-400 max-w-[200px] truncate italic">
                        {falta.motivo || falta.observacoes || <span className="opacity-20">—</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                        
                        {isCoordenacao && (
                          <>
                            <button onClick={() => handleVerPdf(falta.id)} className="p-2 hover:bg-blue-500/20 text-blue-400 rounded-lg transition" title="Ver Comprovativo">PDF</button>
                            {falta.estado === 'PENDENTE' && (
                              <>
                                <button onClick={() => handleValidar(falta.id, true)} className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition">OK</button>
                                <button onClick={() => handleValidar(falta.id, false)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition">X</button>
                              </>
                            )}
                            <button onClick={() => setModalEdicao(falta)} className="p-2 hover:bg-amber-500/20 text-amber-400 rounded-lg transition">Edit</button>
                            <button onClick={() => handleRemover(falta.id)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition">Del</button>
                          </>
                        )}

                        {isProfessor && (
                          <>
                            <button onClick={() => setModalEdicao(falta)} className="text-xs font-bold text-amber-500 hover:underline">Editar</button>
                            {falta.estado === 'PENDENTE' && (
                              <button onClick={() => setModalJustificacao(falta.id)} className="text-xs font-bold text-indigo-400 hover:underline ml-2">Justificar</button>
                            )}
                          </>
                        )}

                        {(isAluno || isEncarregado) && (
                          <div className="flex gap-2">
                            {falta.estado === 'PENDENTE' && (
                              <button onClick={() => setModalJustificacao(falta.id)} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-md text-xs font-bold transition">
                                Justificar
                              </button>
                            )}
                            <button onClick={() => handleVerPdf(falta.id)} className="text-xs text-blue-400 hover:underline">
                              Ver Comprovativo
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {faltas.length === 0 && (
                  <tr><td colSpan={5} className="py-20 text-center opacity-30">Sem registos encontrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}