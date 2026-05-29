'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'ALUNO' | 'COORDENACAO' | 'PROFESSOR' | 'ENCARREGADO';

interface UtilizadoreResumoDto {
  id: string;
  nome: string;
}

interface TipoPagamentoDto {
  id: string;
  tipoPagamento: string;
}

interface PagamentoDto {
  id?: string;
  valorPagamento: number;
  pago: boolean;
  descricao: string;
  idTipoPagamento?: string;
  tipoPagamentoNome?: string;
  dataPagamento?: string;
  utilizadoreResumoDto?: UtilizadoreResumoDto;
}

const BASE_URL = 'http://localhost:8080';

const CATEGORIAS_PADRAO: TipoPagamentoDto[] = [
  { id: "eyJDcmVhdGVkQXQiOjE3MTU4OTIzNDYsImkiOjF9", tipoPagamento: "Mensalidade" },
  { id: "eyJDcmVhdGVkQXQiOjE3MTU4OTIzNDYsImkiOjJ9", tipoPagamento: "Aula Avulso" },
  { id: "eyJDcmVhdGVkQXQiOjE3MTU4OTIzNDYsImkiOjN9", tipoPagamento: "Inscrição" },
  { id: "eyJDcmVhdGVkQXQiOjE3MTU4OTIzNDYsImkiOjR9", tipoPagamento: "Seguro" },
  { id: "eyJDcmVhdGVkQXQiOjE3MTU4OTIzNDYsImkiOjV9", tipoPagamento: "Material" },
  { id: "eyJDcmVhdGVkQXQiOjE3MTU4OTIzNDYsImkiOjZ9", tipoPagamento: "Outro" },
  { id: "eyJDcmVhdGVkQXQiOjE3MTU4OTIzNDYsImkiOjd9", tipoPagamento: "Pagamento" }
];

function formatarDataBR(dataStr: string | undefined): string {
  if (!dataStr) return '—';
  if (dataStr.includes('-')) {
    const partes = dataStr.split('-');
    if (partes.length === 3 && partes[0].length === 4) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
  }
  return dataStr;
}

export default function PagamentosPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Estados de Dados
  const [pagamentos, setPagamentos] = useState<PagamentoDto[]>([]);
  const [todosOsPagamentos, setTodosOsPagamentos] = useState<PagamentoDto[]>([]); 
  const [loading, setLoading] = useState(true);
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamentoDto[]>(CATEGORIAS_PADRAO);

  // Estados locais para Totais Financeiros (Calculados dinamicamente)
  const [totalLiquidado, setTotalLiquidado] = useState<number>(0);
  const [totalPendente, setTotalPendente] = useState<number>(0);

  // Filtros
  const [pesquisaNome, setPesquisaNome] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');

  // Modal e Formulários
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalModo, setModalModo] = useState<'CRIAR' | 'EDITAR'>('CRIAR');
  const [editId, setEditId] = useState<string>('');

  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState(0);
  const [formPago, setFormPago] = useState(false);
  const [formDataPagamento, setFormDataPagamento] = useState('');
  const [formIdTipoPagamento, setFormIdTipoPagamento] = useState('');

  // Sugestões de Utilizadores (Modal)
  const [formUtilizadorNome, setFormUtilizadorNome] = useState('');
  const [utilizadorSelecionado, setUtilizadorSelecionado] = useState<UtilizadoreResumoDto | null>(null);
  const [utilizadoresLista, setUtilizadoresLista] = useState<UtilizadoreResumoDto[]>([]);
  const [utilizadoresSugestoes, setUtilizadoresSugestoes] = useState<UtilizadoreResumoDto[]>([]);
  
  const sugestoesRef = useRef<HTMLUListElement>(null);

  // Estados para ordenação e filtro por coluna
  const [ordenacaoData, setOrdenacaoData] = useState<'ASC' | 'DESC'>('DESC');
  const [ordenacaoMontante, setOrdenacaoMontante] = useState<'ASC' | 'DESC' | null>(null);
  const [filtroEstadoCol, setFiltroEstadoCol] = useState<'TODOS' | 'LIQUIDADO' | 'PENDENTE'>('TODOS');

  // ENCARREGADO
  const [perfilUtilizador, setPerfilUtilizador] = useState<any>(null);
  const [educandos, setEducandos] = useState<UtilizadoreResumoDto[]>([]);
  const [educandoSelecionado, setEducandoSelecionado] = useState<UtilizadoreResumoDto | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setRole((parsed.tipoUtilizadorId as Role) ?? null);
      } catch { }
    }
  }, []);

  useEffect(() => {
    if (isMounted && role) {
      carregarPerfil();
    }
  }, [isMounted, role]);

  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (sugestoesRef.current && !sugestoesRef.current.contains(e.target as Node)) {
        setUtilizadoresSugestoes([]);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const calcularOffsetMes = (dataSelecao: string): number => {
    if (!dataSelecao) return 0;
    const [anoSel, mesSel] = dataSelecao.split('-').map(Number);
    const agora = new Date();
    return (anoSel - agora.getFullYear()) * 12 + (mesSel - (agora.getMonth() + 1));
  };

  const carregarDadosFinanceiros = async () => {
    if (!isMounted) return;
    const token = localStorage.getItem('token') ?? '';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    
    const offsetCalculado = calcularOffsetMes(mesFiltro);

    let endpointLista = `${BASE_URL}/api/pagamentos`; 

    if (role === 'ALUNO') {
      if (mesFiltro) {
        endpointLista = `${BASE_URL}/api/pagamentos/meus?offset=${offsetCalculado}`;
      } else {
        endpointLista = `${BASE_URL}/api/pagamentos/meus/paginado?page=0&size=500`;
      }
    } else if (role === 'PROFESSOR') {
      endpointLista = `${BASE_URL}/api/pagamentos/meus/professor/paginado?page=0&size=500`;
    } 
    
    if (role === 'ENCARREGADO') {
      if (!educandoSelecionado) return; 
      endpointLista = `${BASE_URL}/api/pagamentos/educando/${educandoSelecionado.id}/paginado?page=0&size=500`;
    }

    setLoading(true);
    try {
      const resLista = await fetch(endpointLista, { headers });

      let listaTratada: PagamentoDto[] = [];
      if (resLista.ok) {
        const dadosLista = await resLista.json();
        listaTratada = Array.isArray(dadosLista) ? dadosLista : dadosLista?.content || [];
      }

      setTodosOsPagamentos(listaTratada);

      const mapaCategorias = new Map<string, string>();
      CATEGORIAS_PADRAO.forEach(c => mapaCategorias.set(c.tipoPagamento.toLowerCase(), c.id));

      listaTratada.forEach(p => {
        if (p.idTipoPagamento && p.tipoPagamentoNome) {
          mapaCategorias.set(p.tipoPagamentoNome.toLowerCase(), p.idTipoPagamento);
        }
      });

      const listaFinalCategorias: TipoPagamentoDto[] = [];
      mapaCategorias.forEach((id, nomeFormatado) => {
        const original = CATEGORIAS_PADRAO.find(c => c.tipoPagamento.toLowerCase() === nomeFormatado)?.tipoPagamento 
                        || (nomeFormatado.charAt(0).toUpperCase() + nomeFormatado.slice(1));
        listaFinalCategorias.push({ id, tipoPagamento: original });
      });

      setTiposPagamento(listaFinalCategorias);

    } catch (err) {
      console.error('Erro ao processar dados financeiros:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isMounted) return;

    let dadosTratados = [...todosOsPagamentos];

    if (mesFiltro) {
      dadosTratados = dadosTratados.filter(p => p.dataPagamento?.startsWith(mesFiltro));
    }

    if (role === 'COORDENACAO' && pesquisaNome.trim() !== '') {
      const termo = pesquisaNome.toLowerCase().trim();
      dadosTratados = dadosTratados.filter(p => 
        p.utilizadoreResumoDto?.nome?.toLowerCase().includes(termo) ||
        p.descricao?.toLowerCase().includes(termo)
      );
    }

    let liq = 0;
    let pen = 0;
    dadosTratados.forEach(p => {
      const valor = p.valorPagamento ?? 0;
      if (p.pago) {
        liq += valor;
      } else {
        pen += valor;
      }
    });
    setTotalLiquidado(liq);
    setTotalPendente(pen);

    if (filtroEstadoCol === 'LIQUIDADO') {
      dadosTratados = dadosTratados.filter(p => p.pago === true);
    } else if (filtroEstadoCol === 'PENDENTE') {
      dadosTratados = dadosTratados.filter(p => p.pago === false);
    }

    if (ordenacaoMontante !== null) {
      dadosTratados.sort((a, b) => {
        const valorA = a.valorPagamento ?? 0;
        const valorB = b.valorPagamento ?? 0;
        return ordenacaoMontante === 'ASC' ? valorA - valorB : valorB - valorA;
      });
    } else {
      dadosTratados.sort((a, b) => {
        const dataA = a.dataPagamento ? new Date(a.dataPagamento).getTime() : 0;
        const dataB = b.dataPagamento ? new Date(b.dataPagamento).getTime() : 0;
        return ordenacaoData === 'ASC' ? dataA - dataB : dataB - dataA;
      });
    }

    setPagamentos(dadosTratados);
  }, [todosOsPagamentos, mesFiltro, pesquisaNome, ordenacaoData, ordenacaoMontante, filtroEstadoCol, isMounted, role]);

  useEffect(() => {
    if (isMounted && role) {
      carregarDadosFinanceiros();
    }
  }, [mesFiltro, educandoSelecionado, role, isMounted]);

  const alternarOrdenacaoData = () => {
    setOrdenacaoMontante(null); 
    setOrdenacaoData(prev => prev === 'DESC' ? 'ASC' : 'DESC');
  };

  const alternarOrdenacaoMontante = () => {
    if (ordenacaoMontante === null) {
      setOrdenacaoMontante('ASC');
    } else if (ordenacaoMontante === 'ASC') {
      setOrdenacaoMontante('DESC');
    } else {
      setOrdenacaoMontante(null); 
      setOrdenacaoData('DESC');
    }
  };

  const alternarFiltroEstado = () => {
    setFiltroEstadoCol(prev => {
      if (prev === 'TODOS') return 'PENDENTE';
      if (prev === 'PENDENTE') return 'LIQUIDADO';
      return 'TODOS';
    });
  };

  const carregarPerfil = async () => {
    const token = localStorage.getItem('token') ?? '';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const resPerfil = await fetch(`${BASE_URL}/api/utilizadores/meu-perfil`, { headers });
      if (resPerfil.ok) {
        const perfil = await resPerfil.json();
        setPerfilUtilizador(perfil);
      }

      if (role === 'ENCARREGADO') {
        const resEducandos = await fetch(`${BASE_URL}/api/utilizadores/meus-educandos`, { headers });
        if (resEducandos.ok) {
          const lista = await resEducandos.json();
          setEducandos(lista);
          if (lista.length > 0) setEducandoSelecionado(lista[0]); 
        }
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    }
  };

  const carregarDadosModal = async () => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const [resUtilizadores, resTipos] = await Promise.all([
        fetch(`${BASE_URL}/api/utilizadores?size=200`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${BASE_URL}/api/tipos-pagamento`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (resUtilizadores.ok) {
        const dados = await resUtilizadores.json();
        const lista = dados?.content || (Array.isArray(dados) ? dados : []);
        const listaFormatada = lista.map((u: any) => ({
          id: u.id,
          nome: u.nome || u.username || 'Utilizador sem nome'
        }));
        setUtilizadoresLista(listaFormatada);
        setUtilizadoresSugestoes(listaFormatada);
      }

      if (resTipos.ok) {
        const tipos = await resTipos.json();
        setTiposPagamento(tipos);
      }

    } catch (err) {
      console.error("Erro ao carregar dados do modal:", err);
    }
  };

  const filtrarUtilizadoresModal = (nomeDigitado: string) => {
    setFormUtilizadorNome(nomeDigitado);
    setUtilizadorSelecionado(null);

    if (nomeDigitado.trim() === '') {
      setUtilizadoresSugestoes(utilizadoresLista);
    } else {
      const termo = nomeDigitado.toLowerCase();
      setUtilizadoresSugestoes(
        utilizadoresLista.filter(u => u.nome.toLowerCase().includes(termo))
      );
    }
  };

  const selecionarUtilizador = (u: UtilizadoreResumoDto) => {
    setUtilizadorSelecionado(u);
    setFormUtilizadorNome(u.nome);
    setUtilizadoresSugestoes([]);
  };

  const abrirModalCriar = () => {
    setModalModo('CRIAR');
    setFormDescricao('');
    setFormValor(0);
    setFormPago(false);
    setFormDataPagamento(new Date().toISOString().split('T')[0]);
    setFormUtilizadorNome('');
    setUtilizadorSelecionado(null);
    setFormIdTipoPagamento(tiposPagamento.length > 0 ? tiposPagamento[0].id : '');
    setIsModalOpen(true);
    carregarDadosModal(); 
  };

  const abrirModalEditar = (pag: PagamentoDto) => {
    setModalModo('EDITAR');
    setEditId(pag.id || '');
    setFormDescricao(pag.descricao);
    setFormValor(pag.valorPagamento);
    setFormPago(pag.pago);
    setFormDataPagamento(pag.dataPagamento || new Date().toISOString().split('T')[0]);
    setFormIdTipoPagamento(pag.idTipoPagamento || (tiposPagamento.length > 0 ? tiposPagamento[0].id : ''));
    if (pag.utilizadoreResumoDto) {
      setUtilizadorSelecionado(pag.utilizadoreResumoDto);
      setFormUtilizadorNome(pag.utilizadoreResumoDto.nome);
    }
    setIsModalOpen(true);
    carregarDadosModal();
  };

  const handleGravarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utilizadorSelecionado) {
      alert('Por favor, escolhe um utilizador da lista flutuante.');
      return;
    }

    const token = localStorage.getItem('token') ?? '';
    const payload = modalModo === 'CRIAR'
    ? {
        valorPagamento: Number(formValor),
        descricao: formDescricao,
        dataPagamento: formDataPagamento,
        idTipoPagamento: formIdTipoPagamento,
        idUtilizador: utilizadorSelecionado.id,
        idAula: null
      }
    : {
        id: editId,
        valorPagamento: Number(formValor),
        pago: formPago,
        descricao: formDescricao,
        dataPagamento: formDataPagamento,
        idTipoPagamento: formIdTipoPagamento,
        utilizadoreResumoDto: {
          id: utilizadorSelecionado.id,
          nome: utilizadorSelecionado.nome
        }
      };

    const url = modalModo === 'CRIAR' ? `${BASE_URL}/api/pagamentos` : `${BASE_URL}/api/pagamentos/${editId}`;
    const method = modalModo === 'CRIAR' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        carregarDadosFinanceiros();
        alert('Registo guardado com sucesso!');
      } else {
        alert('Erro ao guardar lançamento.');
      }
    } catch {
      alert('Falha na ligação com o servidor.');
    }
  };

  const handleConfirmarPagamento = async (id: string) => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/api/pagamentos/${id}/confirmar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) carregarDadosFinanceiros();
    } catch {
      alert('Erro de rede.');
    }
  };

  // Esta função agora serve para o fluxo unificado de execução de pagamentos pendentes no frontend
  const handlePagarFatura = async (idPagamento: string) => {
    if (!confirm("Desejas proceder ao pagamento deste lançamento pendente?")) return;

    const token = localStorage.getItem('token') ?? '';
    const url = `${BASE_URL}/api/pagamentos/${idPagamento}/confirmar`;

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        alert("Pagamento efetuado com sucesso!");
        carregarDadosFinanceiros();
      } else {
        alert("Não foi possível processar o pagamento. Tente novamente.");
      }
    } catch (err) {
      console.error("Erro ao processar pagamento:", err);
      alert("Falha de comunicação com o servidor.");
    }
  };

  const handleEliminarPagamento = async (id: string) => {
    if (!confirm('Eliminar permanentemente este registo?')) return;
    const token = localStorage.getItem('token') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/api/pagamentos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) carregarDadosFinanceiros();
    } catch {
      alert('Erro ao eliminar.');
    }
  };

  const isMenorDeIdade = (): boolean => {
    if (!perfilUtilizador?.dataNascimento) return false;
    const nascimento = new Date(perfilUtilizador.dataNascimento);
    const hoje = new Date();
    const idade = hoje.getFullYear() - nascimento.getFullYear() -
      (hoje < new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate()) ? 1 : 0);
    return idade < 18;
  };

  if (!isMounted) return <p className="p-8 text-sm">A ler configurações do servidor...</p>;

  const estiloCampoElegante = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border-warm)',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: '#FFF',
    color: 'var(--panel-dark)',
    fontFamily: 'inherit',
    boxShadow: 'rgba(0, 0, 0, 0.02) 0px 1px 3px 0px, rgba(27, 31, 35, 0.15) 0px 0px 0px 1px inset',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  };

  const deveMostrarColunaAcoes = 
    role === 'COORDENACAO' || 
    role === 'PROFESSOR' || 
    role === 'ENCARREGADO' ||
    (role === 'ALUNO' && !isMenorDeIdade());

  return (
    <div style={{ paddingBottom: '40px' }}>
      
      {/* SECTOR DE FILTROS */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--accent-muted)' }}>PAINEL FINANCEIRO</p>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', margin: 0, fontWeight: 400 }}>Histórico de Pagamentos</h1>
        </div>

        <div className="flex items-end gap-4"> 
          {role === 'COORDENACAO' && (
            <div className="flex flex-col">
              <label style={{ fontSize: '10px', color: 'var(--accent-muted)', marginBottom: '4px', fontWeight: 500 }}>PESQUISAR UTILIZADOR / CONTEÚDO</label>
              <input
                type="text"
                placeholder="Digite nome utilizador / conteúdo"
                value={pesquisaNome}
                onChange={e => setPesquisaNome(e.target.value)}
                style={{ padding: '7px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', width: '220px', outline: 'none' }}
              />
            </div>
          )}

          <div className="flex flex-col">
            <label style={{ fontSize: '10px', color: 'var(--accent-muted)', marginBottom: '4px', fontWeight: 500 }}>FILTRAR MÊS</label>
            <input
              type="month"
              value={mesFiltro}
              onChange={e => setMesFiltro(e.target.value)}
              style={{ padding: '6px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
            />
          </div>

          {role === 'COORDENACAO' && (
            <button
              onClick={abrirModalCriar}
              style={{ background: 'var(--panel-dark)', color: 'var(--accent-gold)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
            >
              <i className="ti ti-plus" /> Novo Lançamento
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--accent-muted)', fontSize: '13px' }}>A atualizar listagem da base dados...</p>
      ) : (
        <>
          {/* PAINEL DE TOTAIS */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-lg" style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderLeft: '4px solid #2E7D32' }}>
              <p style={{ fontSize: '10px', color: 'var(--accent-muted)', margin: '0 0 4px 0' }}>
                {role === 'PROFESSOR' ? 'HONORÁRIOS RECEBIDOS' : 'TOTAL LIQUIDADO'}
              </p>
              <p style={{ fontSize: '22px', margin: 0, color: 'var(--panel-dark)', fontWeight: 500 }}>
                {totalLiquidado.toFixed(2)}€
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderLeft: '4px solid #C62828' }}>
              <p style={{ fontSize: '10px', color: 'var(--accent-muted)', margin: '0 0 4px 0' }}>
                {role === 'PROFESSOR' ? 'VALOR PENDENTE A RECEBER' : 'VALOR POR REGULARIZAR'}
              </p>
              <p style={{ fontSize: '22px', margin: 0, color: '#C62828', fontWeight: 500 }}>
                {totalPendente.toFixed(2)}€
              </p>
            </div>
          </div>

          {/* SELECTOR DE EDUCANDOS NO JSX (Apenas para ENCARREGADO) */}
          {role === 'ENCARREGADO' && educandos.length > 0 && (
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted)', letterSpacing: '0.5px' }}>
                Educando
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {educandos.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setEducandoSelecionado(e)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-warm)',
                      background: educandoSelecionado?.id === e.id ? 'var(--panel-dark)' : 'transparent',
                      color: educandoSelecionado?.id === e.id ? 'var(--accent-gold)' : 'var(--panel-dark)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {e.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TABELA PRINCIPAL */}
          <div style={{ background: '#FFF', border: '1px solid var(--border-warm)', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="w-full text-left text-sm border-collapse">
              <thead style={{ background: '#FAF6F0', color: 'var(--accent-muted)' }}>
                <tr>
                  <th className="p-3" style={{ fontSize: '11px' }}>Utilizador</th>
                  <th className="p-3" style={{ fontSize: '11px' }}>Descrição</th>
                  <th className="p-3" style={{ fontSize: '11px' }}>Categoria</th>
                  
                  <th 
                    className="p-3 cursor-pointer select-none hover:bg-orange-50 transition-colors" 
                    style={{ fontSize: '11px' }}
                    onClick={alternarOrdenacaoData}
                  >
                    Data Emissão {ordenacaoMontante === null && (ordenacaoData === 'DESC' ? '↓' : '↑')}
                  </th>
                  
                  <th 
                    className="p-3 cursor-pointer select-none hover:bg-orange-50 transition-colors" 
                    style={{ fontSize: '11px' }}
                    onClick={alternarOrdenacaoMontante}
                  >
                    Montante {ordenacaoMontante === 'ASC' ? '↑' : ordenacaoMontante === 'DESC' ? '↓' : ''}
                  </th>
                  
                  <th 
                    className="p-3 cursor-pointer select-none hover:bg-orange-50 transition-colors" 
                    style={{ fontSize: '11px' }}
                    onClick={alternarFiltroEstado}
                  >
                    <span style={{ 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      background: filtroEstadoCol !== 'TODOS' ? 'var(--panel-dark)' : 'transparent',
                      color: filtroEstadoCol !== 'TODOS' ? 'var(--accent-gold)' : 'inherit'
                    }}>
                      Estado {filtroEstadoCol === 'TODOS' ? '⌕' : `(${filtroEstadoCol})`}
                    </span>
                  </th>
                  
                  {deveMostrarColunaAcoes && <th className="p-3 text-right" style={{ fontSize: '11px' }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {pagamentos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center" style={{ color: 'var(--accent-muted)', fontSize: '13px' }}>
                      Nenhum registo financeiro encontrado para os critérios selecionados.
                    </td>
                  </tr>
                ) : (
                  pagamentos.map((p, idx) => (
                    <tr key={p.id || idx} className="border-t border-gray-100" style={{ color: 'var(--panel-dark)' }}>
                      <td className="p-3 font-medium">{p.utilizadoreResumoDto?.nome || '—'}</td>
                      <td className="p-3">{p.descricao}</td>
                      <td className="p-3 text-xs">{p.tipoPagamentoNome || 'Geral'}</td>
                      <td className="p-3 text-xs">{formatarDataBR(p.dataPagamento)}</td>
                      <td className="p-3 font-bold">{p.valorPagamento?.toFixed(2)}€</td>
                      <td className="p-3">
                        <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500, backgroundColor: p.pago ? 'rgba(52, 168, 83, 0.08)' : 'rgba(249, 171, 0, 0.08)', color: p.pago ? '#2E7D32' : '#B58100' }}>
                          {p.pago ? 'Liquidado' : 'Pendente'}
                        </span>
                      </td>
                      {deveMostrarColunaAcoes && (
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            {/* AÇÕES DA COORDENAÇÃO */}
                            {role === 'COORDENACAO' && (
                              <>
                                {!p.pago && (
                                  <button onClick={() => handleConfirmarPagamento(p.id!)} title="Liquidar" className="text-green-700 bg-transparent border-none cursor-pointer"><i className="ti ti-check" /></button>
                                )}
                                <button onClick={() => abrirModalEditar(p)} title="Editar" className="text-gray-500 bg-transparent border-none cursor-pointer"><i className="ti ti-edit" /></button>
                                <button onClick={() => handleEliminarPagamento(p.id!)} title="Eliminar" className="text-red-700 bg-transparent border-none cursor-pointer"><i className="ti ti-trash" /></button>
                              </>
                            )}

                            {/* CORREÇÃO E UNIFICAÇÃO AQUI: 
                                Exibe o mesmo botão "Pagar" premium para Professor, Encarregado e Alunos maiores de idade quando o pagamento estiver Pendente */}
                            {!p.pago && (role === 'ENCARREGADO' || role === 'PROFESSOR' || (role === 'ALUNO' && !isMenorDeIdade())) && (
                              <button
                                onClick={() => handlePagarFatura(p.id!)}
                                title={role === 'PROFESSOR' ? "Confirmar Recebimento / Pagar" : "Efetuar Pagamento"}
                                style={{ 
                                  background: 'var(--panel-dark)', 
                                  color: 'var(--accent-gold)', 
                                  border: 'none', 
                                  padding: '4px 10px', 
                                  borderRadius: '4px', 
                                  cursor: 'pointer', 
                                  fontSize: '11px', 
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <i className="ti ti-credit-card" /> Pagar
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL CRIAÇÃO / EDIÇÃO */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(24, 23, 21, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ position: 'relative', background: '#FFFFFF', padding: '30px', borderRadius: '12px', width: '460px', border: '1px solid var(--border-warm)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
            
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '5px', backgroundColor: 'var(--panel-dark)' }} />

            <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', margin: '0 0 6px 0', color: 'var(--panel-dark)', fontWeight: 400 }}>
              {modalModo === 'CRIAR' ? 'Lançar Novo Pagamento' : 'Editar Registo Financeiro'}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--accent-muted)', margin: '0 0 24px 0', letterSpacing: '0.3px' }}>
              Preenche os detalhes financeiros para atualizar o fluxo de caixa.
            </p>

            <form onSubmit={handleGravarPagamento} className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Descrição do Lançamento</label>
                <input style={estiloCampoElegante} placeholder="Ex: Mensalidade de Dança Contemporânea" value={formDescricao} onChange={e => setFormDescricao(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Montante (€)</label>
                  <input style={estiloCampoElegante} type="number" step="0.01" placeholder="0.00" value={formValor || ''} onChange={e => setFormValor(Number(e.target.value))} required />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Data de Emissão</label>
                  <input style={estiloCampoElegante} type="date" value={formDataPagamento} onChange={e => setFormDataPagamento(e.target.value)} required />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Categoria de Pagamento</label>
                <div style={{ position: 'relative' }}>
                  <select style={estiloCampoElegante} value={formIdTipoPagamento} onChange={e => setFormIdTipoPagamento(e.target.value)} required>
                    <option value="">-- Escolher uma categoria --</option>
                    {tiposPagamento.map((t, idx) => (
                      <option key={t.id || idx} value={t.id}>
                        {t.tipoPagamento}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Atribuir ao Utilizador</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      ...estiloCampoElegante,
                      borderColor: utilizadorSelecionado ? '#2E7D32' : 'var(--border-warm)',
                      paddingRight: utilizadorSelecionado ? '90px' : '14px'
                    }}
                    placeholder="Escreva para pesquisar."
                    value={formUtilizadorNome}
                    onChange={e => filtrarUtilizadoresModal(e.target.value)}
                    autoComplete="off"
                  />

                  {utilizadorSelecionado && (
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', background: '#E8F5E9', color: '#2E7D32', padding: '3px 8px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.3px' }}>
                      ✓ VINCULADO
                    </span>
                  )}

                  {utilizadoresSugestoes.length > 0 && (
                    <ul ref={sugestoesRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#FFF', border: '1px solid var(--border-warm)', borderRadius: '6px', zIndex: 300, maxHeight: '150px', overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                      {utilizadoresSugestoes.map((u, i) => (
                        <li key={u.id || i} onMouseDown={() => selecionarUtilizador(u)} style={{ padding: '9px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--panel-dark)', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#FAF6F0'} onMouseLeave={e => e.currentTarget.style.background = '#FFF'}>
                          {u.nome}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {modalModo === 'EDITAR' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Estado Fluxo do Pagamento</label>
                  <select style={estiloCampoElegante} value={formPago ? 't' : 'f'} onChange={e => setFormPago(e.target.value === 't')}>
                    <option value="f">Pendente (Aguardar Recebimento)</option>
                    <option value="t">Pago / Liquidado (Validado)</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  style={{ padding: '10px 18px', border: '1px solid var(--border-warm)', background: 'transparent', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--panel-dark)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9F6F0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ background: 'var(--panel-dark)', color: 'var(--accent-gold)', border: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {modalModo === 'CRIAR' ? 'Criar Lançamento' : 'Gravar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}