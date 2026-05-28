'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'ALUNO' | 'COORDENACAO' | 'PROFESSOR' | 'ENCARREGADO';

interface AulaDto {
  id: string;
  titulo?: string;
}

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
  aula?: AulaDto;
  dataPagamento?: string;
  dataConfirmado?: string;
  utilizadoreResumoDto?: UtilizadoreResumoDto;
}

interface PagamentosEstatisticaCoordenacao {
  getTotalPago: number;
  getTotalPorPagar: number;
}

interface AlunoEstatisticaDto {
  totalPago?: number;
  totalPendente?: number;
}

const BASE_URL = 'http://localhost:8080';

const NAV_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { icon: 'ti-home', label: 'Início', href: '/landingPage' },
      { icon: 'ti-calendar', label: 'Horários', href: '/horarios' },
      { icon: 'ti-credit-card', label: 'Pagamentos', href: '/pagamentos' },
    ],
  },
  {
    title: 'Comunidade',
    items: [
      { icon: 'ti-mail', label: 'Mensagens', href: '/mensagens' },
      { icon: 'ti-star', label: 'Eventos', href: '/eventos' },
      { icon: 'ti-shopping-bag', label: 'Marketplace', href: '/marketplace' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { icon: 'ti-chart-bar', label: 'Gestão de Faltas', href: '/faltas' },
    ],
  },
];

export default function PagamentosPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Dados
  const [pagamentos, setPagamentos] = useState<PagamentoDto[]>([]);
  const [estatisticasCoord, setEstatisticasCoord] = useState<PagamentosEstatisticaCoordenacao | null>(null);
  const [estatisticasAluno, setEstatisticasAluno] = useState<AlunoEstatisticaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [tiposPagamento, setTiposPagamento] = useState<TipoPagamentoDto[]>([]);

  // Filtros
  const [pesquisaAlunoId, setPesquisaAlunoId] = useState('');
  const [mesFiltro, setMesFiltro] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalModo, setModalModo] = useState<'CRIAR' | 'EDITAR'>('CRIAR');
  const [editId, setEditId] = useState<string>('');

  // Campos do formulário
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState(0);
  const [formPago, setFormPago] = useState(false);
  const [formDataPagamento, setFormDataPagamento] = useState('');
  const [formIdTipoPagamento, setFormIdTipoPagamento] = useState('');

  // Autocomplete de utilizadores
  const [formUtilizadorNome, setFormUtilizadorNome] = useState('');
  const [utilizadorSelecionado, setUtilizadorSelecionado] = useState<UtilizadoreResumoDto | null>(null);
  const [utilizadoresSugestoes, setUtilizadoresSugestoes] = useState<UtilizadoreResumoDto[]>([]);
  const [pesquisandoUtilizadores, setPesquisandoUtilizadores] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sugestoesRef = useRef<HTMLUListElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsMounted(true);
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUserName(parsed.nome ?? '');
        setRole((parsed.tipoUtilizadorId as Role) ?? null);
      } catch { /* erro no parse */ }
    }

    // Carregar tipos de pagamento
    const token = localStorage.getItem('token') ?? '';
    fetch(`${BASE_URL}/api/tipospagamento`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(dados => {
        // Tenta as estruturas mais comuns do Spring
        const lista: TipoPagamentoDto[] = Array.isArray(dados)
          ? dados
          : Array.isArray(dados?.content)
          ? dados.content
          : Array.isArray(dados?._embedded?.tipoPagamentoDtoes)
          ? dados._embedded.tipoPagamentoDtoes
          : [];
      
        setTiposPagamento(lista);
        if (lista.length > 0) setFormIdTipoPagamento(lista[0].id);
      })
      .catch(() => {});
  }, []);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (sugestoesRef.current && !sugestoesRef.current.contains(e.target as Node)) {
        setUtilizadoresSugestoes([]);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // ── Dados financeiros ─────────────────────────────────────────────────────

  const calcularOffsetMes = (dataSelecao: string): number => {
    const [anoSel, mesSel] = dataSelecao.split('-').map(Number);
    const agora = new Date();
    return (anoSel - agora.getFullYear()) * 12 + (mesSel - (agora.getMonth() + 1));
  };

  const carregarDadosFinanceiros = () => {
    if (!role || !isMounted) return;

    const token = localStorage.getItem('token') ?? '';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const offset = calcularOffsetMes(mesFiltro);

    let endpointLista = `${BASE_URL}/api/pagamentos`;
    let endpointStats = `${BASE_URL}/api/pagamentos/estatisticas/coordenacao`;

    if (role === 'ALUNO') {
      endpointLista = `${BASE_URL}/api/pagamentos/meus?offset=${offset}`;
      endpointStats = `${BASE_URL}/api/pagamentos/meus/estatisticas?offset=${offset}`;
    } else if (role === 'COORDENACAO' && pesquisaAlunoId.trim() !== '') {
      endpointLista = `${BASE_URL}/api/pagamentos/utilizador/${pesquisaAlunoId.trim()}?offset=${offset}`;
      endpointStats = `${BASE_URL}/api/pagamentos/utilizador/${pesquisaAlunoId.trim()}/estatisticas?offset=${offset}`;
    }

    setLoading(true);
    Promise.all([
      fetch(endpointLista, { headers }).then(res => res.json()),
      fetch(endpointStats, { headers }).then(res => res.json()),
    ])
      .then(([dadosLista, dadosStats]) => {
        setPagamentos(dadosLista ?? []);
        if (role === 'COORDENACAO' && pesquisaAlunoId.trim() === '') {
          setEstatisticasCoord(dadosStats);
          setEstatisticasAluno(null);
        } else {
          setEstatisticasCoord(null);
          setEstatisticasAluno({
            totalPago: dadosStats.totalPago ?? 0,
            totalPendente: dadosStats.totalPendente ?? 0,
          });
        }
      })
      .catch(() => console.error('Erro ao carregar dados'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isMounted) carregarDadosFinanceiros();
  }, [role, mesFiltro, isMounted]);

  const limparPesquisa = () => {
    setPesquisaAlunoId('');
    setLoading(true);
    const token = localStorage.getItem('token') ?? '';
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${BASE_URL}/api/pagamentos`, { headers }).then(res => res.json()),
      fetch(`${BASE_URL}/api/pagamentos/estatisticas/coordenacao`, { headers }).then(res => res.json()),
    ])
      .then(([dadosLista, dadosStats]) => {
        setPagamentos(dadosLista ?? []);
        setEstatisticasCoord(dadosStats);
        setEstatisticasAluno(null);
      })
      .finally(() => setLoading(false));
  };

  // ── Autocomplete ──────────────────────────────────────────────────────────

  const pesquisarUtilizadores = (nome: string) => {
    setFormUtilizadorNome(nome);
    setUtilizadorSelecionado(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (nome.length < 3) {
      setUtilizadoresSugestoes([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setPesquisandoUtilizadores(true);
      const token = localStorage.getItem('token') ?? '';
      try {
        const res = await fetch(
          `${BASE_URL}/api/utilizadores/pesquisar?nome=${encodeURIComponent(nome)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error();
        const dados: UtilizadoreResumoDto[] = await res.json();
        setUtilizadoresSugestoes(dados ?? []);
      } catch {
        setUtilizadoresSugestoes([]);
      } finally {
        setPesquisandoUtilizadores(false);
      }
    }, 300);
  };

  const selecionarUtilizador = (u: UtilizadoreResumoDto) => {
    setUtilizadorSelecionado(u);
    setFormUtilizadorNome(u.nome);
    setUtilizadoresSugestoes([]);
  };

  // ── Modal ─────────────────────────────────────────────────────────────────

  const limparModal = () => {
    setFormDescricao('');
    setFormValor(0);
    setFormPago(false);
    setFormDataPagamento(new Date().toISOString().split('T')[0]);
    setFormUtilizadorNome('');
    setUtilizadorSelecionado(null);
    setUtilizadoresSugestoes([]);
    // Reset ao primeiro tipo disponível
    setFormIdTipoPagamento(tiposPagamento.length > 0 ? tiposPagamento[0].id : '');
  };

  const abrirModalCriar = () => {
    setModalModo('CRIAR');
    limparModal();
    setIsModalOpen(true);
  };

  const abrirModalEditar = (pag: PagamentoDto) => {
    setModalModo('EDITAR');
    setEditId(pag.id || '');
    setFormDescricao(pag.descricao);
    setFormValor(pag.valorPagamento);
    setFormPago(pag.pago);
    setFormDataPagamento(pag.dataPagamento || new Date().toISOString().split('T')[0]);
    setFormIdTipoPagamento(pag.idTipoPagamento || (tiposPagamento.length > 0 ? tiposPagamento[0].id : ''));
    setUtilizadoresSugestoes([]);
    if (pag.utilizadoreResumoDto) {
      setUtilizadorSelecionado(pag.utilizadoreResumoDto);
      setFormUtilizadorNome(pag.utilizadoreResumoDto.nome);
    } else {
      setUtilizadorSelecionado(null);
      setFormUtilizadorNome('');
    }
    setIsModalOpen(true);
  };

  const fecharModal = () => {
    setIsModalOpen(false);
    limparModal();
  };

  // ── Gravar ────────────────────────────────────────────────────────────────

  const handleGravarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!utilizadorSelecionado) {
      alert('Tens de selecionar um utilizador da lista de sugestões.');
      return;
    }
    if (!formIdTipoPagamento) {
      alert('Tens de selecionar um tipo de pagamento.');
      return;
    }

    const token = localStorage.getItem('token') ?? '';

    // CRIAR → CriarPagamentoDto (campos simples)
    // EDITAR → PagamentoDto (compatível com o atualizar existente)
    const payload =
      modalModo === 'CRIAR'
        ? {
            valorPagamento: Number(formValor),
            descricao: formDescricao,
            idUtilizador: utilizadorSelecionado.id,
            idTipoPagamento: formIdTipoPagamento,
            idAula: null,
            dataPagamento: formDataPagamento,
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
              nome: utilizadorSelecionado.nome,
            },
            aula: null,
          };

    const url =
      modalModo === 'CRIAR'
        ? `${BASE_URL}/api/pagamentos`
        : `${BASE_URL}/api/pagamentos/${editId}`;
    const method = modalModo === 'CRIAR' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fecharModal();
        carregarDadosFinanceiros();
        alert(modalModo === 'CRIAR' ? 'Pagamento registado com sucesso!' : 'Registo atualizado!');
      } else {
        const erro = await res.text();
        alert(`Erro (${res.status}): ${erro}`);
      }
    } catch {
      alert('Erro de rede. Verifica a ligação ao servidor.');
    }
  };

  // ── Ações de tabela ───────────────────────────────────────────────────────

  const handleEliminarPagamento = async (id: string) => {
    if (!confirm('Eliminar este registo de pagamento?')) return;
    const token = localStorage.getItem('token') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/api/pagamentos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) carregarDadosFinanceiros();
      else alert('Erro ao eliminar.');
    } catch {
      alert('Erro de rede.');
    }
  };

  const handleConfirmarPagamento = async (id: string) => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const res = await fetch(`${BASE_URL}/api/pagamentos/${id}/confirmar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) carregarDadosFinanceiros();
      else alert('Erro ao confirmar pagamento.');
    } catch {
      alert('Erro de rede.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isMounted) return <p className="p-8">A inicializar aplicação...</p>;

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--background)', fontFamily: 'var(--font-lato)' }}
    >
      {/* NAVBAR */}
      <nav
        className="flex items-center justify-between px-5"
        style={{
          height: '52px',
          borderBottom: '1px solid var(--border-warm)',
          background: 'var(--background)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center"
            style={{
              width: '32px',
              height: '32px',
              border: '1px solid var(--border-warm)',
              borderRadius: '4px',
              background: '#FFFCF8',
              cursor: 'pointer',
            }}
          >
            <i className="ti ti-menu-2" />
          </button>
          <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '16px', letterSpacing: '4px' }}>
            entartes
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '12px', color: 'var(--accent-muted)' }}>{userName}</span>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--panel-dark)',
              color: 'var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
            }}
          >
            {initials}
          </div>
        </div>
      </nav>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Overlay drawer */}
        {drawerOpen && (
          <div
            className="absolute inset-0 z-10"
            style={{ background: 'rgba(44,31,20,0.3)' }}
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* DRAWER */}
        <aside
          className="absolute top-0 bottom-0 left-0 z-20"
          style={{
            width: '220px',
            background: 'var(--panel-dark)',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform .3s',
          }}
        >
          <div className="p-5 overflow-y-auto">
            {NAV_SECTIONS.map(s => (
              <div key={s.title} className="mb-4">
                <p
                  style={{
                    fontSize: '9px',
                    color: 'rgba(212,178,136,0.3)',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                  }}
                >
                  {s.title}
                </p>
                {s.items.map(i => (
                  <button
                    key={i.href}
                    onClick={() => router.push(i.href)}
                    className="block w-full text-left py-2"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(212,178,136,0.7)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <i className={`ti ${i.icon} mr-2`} /> {i.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* Cabeçalho + Filtros */}
          <div className="flex justify-between items-end mb-6">
            <div>
              <p style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--accent-muted)' }}>
                GESTÃO
              </p>
              <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px' }}>Pagamentos</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Filtro por mês */}
              <div className="flex flex-col">
                <label style={{ fontSize: '10px', color: 'var(--accent-muted)', marginBottom: '2px' }}>
                  FILTRAR POR MÊS
                </label>
                <input
                  type="month"
                  value={mesFiltro}
                  onChange={e => setMesFiltro(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--border-warm)',
                    borderRadius: '4px',
                    fontSize: '13px',
                    background: '#FFF',
                  }}
                />
              </div>

              {/* Filtro por hash (coordenação) */}
              {role === 'COORDENACAO' && (
                <div className="flex flex-col">
                  <label style={{ fontSize: '10px', color: 'var(--accent-muted)', marginBottom: '2px' }}>
                    FILTRAR POR UTILIZADOR HASH
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Colar hash do aluno..."
                      value={pesquisaAlunoId}
                      onChange={e => setPesquisaAlunoId(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid var(--border-warm)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        background: '#FFF',
                        fontFamily: 'monospace',
                      }}
                    />
                    {pesquisaAlunoId && (
                      <button
                        onClick={limparPesquisa}
                        style={{
                          padding: '6px 10px',
                          background: '#E0E0E0',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        X
                      </button>
                    )}
                    <button
                      onClick={carregarDadosFinanceiros}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--panel-dark)',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="ti ti-search" />
                    </button>
                  </div>
                </div>
              )}

              {/* Botão novo registo */}
              {role === 'COORDENACAO' && (
                <button
                  onClick={abrirModalCriar}
                  style={{
                    background: 'var(--panel-dark)',
                    color: 'var(--accent-gold)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    height: 'fit-content',
                    alignSelf: 'flex-end',
                  }}
                >
                  <i className="ti ti-plus" /> Novo Registo
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <p>A carregar dados...</p>
          ) : (
            <>
              {/* Cartões estatísticas */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div
                  className="p-4 rounded-lg"
                  style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)' }}
                >
                  <p style={{ fontSize: '10px', color: 'var(--accent-muted)' }}>TOTAL LIQUIDADO</p>
                  <p style={{ fontSize: '20px' }}>
                    {estatisticasCoord
                      ? estatisticasCoord.getTotalPago?.toFixed(2)
                      : estatisticasAluno?.totalPago?.toFixed(2)}
                    €
                  </p>
                </div>
                <div
                  className="p-4 rounded-lg"
                  style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)' }}
                >
                  <p style={{ fontSize: '10px', color: 'var(--accent-muted)' }}>PENDENTE</p>
                  <p style={{ fontSize: '20px', color: '#C62828' }}>
                    {estatisticasCoord
                      ? estatisticasCoord.getTotalPorPagar?.toFixed(2)
                      : estatisticasAluno?.totalPendente?.toFixed(2)}
                    €
                  </p>
                </div>
              </div>

              {/* Tabela */}
              <div
                style={{
                  background: '#FFF',
                  border: '1px solid var(--border-warm)',
                  borderRadius: '8px',
                }}
              >
                <table className="w-full text-left text-sm border-collapse">
                  <thead style={{ background: '#FAF6F0', color: 'var(--accent-muted)' }}>
                    <tr>
                      <th className="p-3">ID Seguro Aluno</th>
                      <th className="p-3">Utilizador</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Data</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagamentos.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-6 text-center"
                          style={{ color: 'var(--accent-muted)', fontSize: '13px' }}
                        >
                          Nenhum pagamento encontrado.
                        </td>
                      </tr>
                    ) : (
                      pagamentos.map(p => (
                        <tr key={p.id} className="border-t border-gray-100">
                          <td className="p-3">
                            <code
                              style={{
                                background: '#F4EFEA',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                              }}
                            >
                              {p.utilizadoreResumoDto?.id || '—'}
                            </code>
                          </td>
                          <td className="p-3 font-medium">{p.utilizadoreResumoDto?.nome || '—'}</td>
                          <td className="p-3">{p.descricao}</td>
                          <td className="p-3" style={{ fontSize: '12px', color: '#5c4d3c' }}>
                            {p.tipoPagamentoNome || '—'}
                          </td>
                          <td className="p-3" style={{ fontSize: '12px', color: '#5c4d3c' }}>
                            {p.dataPagamento || '—'}
                          </td>
                          <td className="p-3 font-bold">{p.valorPagamento?.toFixed(2)}€</td>
                          <td className="p-3">
                            <span
                              style={{
                                color: p.pago ? '#2E7D32' : '#B58100',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              {p.pago ? 'Liquidado' : 'Pendente'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {role === 'COORDENACAO' && (
                              <div className="flex justify-end gap-2">
                                {!p.pago && (
                                  <button
                                    onClick={() => handleConfirmarPagamento(p.id!)}
                                    title="Confirmar pagamento"
                                    className="text-green-700 bg-transparent border-none cursor-pointer"
                                  >
                                    <i className="ti ti-check" />
                                  </button>
                                )}
                                <button
                                  onClick={() => abrirModalEditar(p)}
                                  title="Editar"
                                  className="text-gray-400 bg-transparent border-none cursor-pointer"
                                >
                                  <i className="ti ti-edit" />
                                </button>
                                <button
                                  onClick={() => handleEliminarPagamento(p.id!)}
                                  title="Eliminar"
                                  className="text-red-700 bg-transparent border-none cursor-pointer"
                                >
                                  <i className="ti ti-trash" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={e => { if (e.target === e.currentTarget) fecharModal(); }}
        >
          <div
            style={{
              background: '#FFFCF8',
              padding: '24px',
              borderRadius: '8px',
              width: '420px',
              border: '1px solid var(--border-warm)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h2
              className="mb-4"
              style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px' }}
            >
              {modalModo === 'CRIAR' ? 'Novo Pagamento' : 'Editar Registo'}
            </h2>

            <form onSubmit={handleGravarPagamento} className="flex flex-col gap-3">

              {/* Descrição */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Descrição do Lançamento
                </label>
                <input
                  className="w-full p-2 border rounded text-sm"
                  placeholder="Ex: Mensalidade, Inscrição..."
                  value={formDescricao}
                  onChange={e => setFormDescricao(e.target.value)}
                  required
                />
              </div>

              {/* Valor */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Valor do Pagamento (€)
                </label>
                <input
                  className="w-full p-2 border rounded text-sm"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formValor || ''}
                  onChange={e => setFormValor(Number(e.target.value))}
                  required
                />
              </div>

              {/* Data */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Data do Pagamento
                </label>
                <input
                  className="w-full p-2 border rounded text-sm"
                  type="date"
                  value={formDataPagamento}
                  onChange={e => setFormDataPagamento(e.target.value)}
                  required
                />
              </div>

              {/* Tipo de Pagamento */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Tipo de Pagamento
                </label>
                <select
                  className="w-full p-2 border rounded text-sm"
                  value={formIdTipoPagamento}
                  onChange={e => setFormIdTipoPagamento(e.target.value)}
                  required
                >
                  <option value="">-- Selecionar tipo --</option>
                  {tiposPagamento.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.tipoPagamento}
                    </option>
                  ))}
                </select>
              </div>

              {/* Utilizador com autocomplete */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Utilizador
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="w-full p-2 border rounded text-sm"
                    placeholder="Escreve o nome (mín. 3 letras)..."
                    value={formUtilizadorNome}
                    onChange={e => pesquisarUtilizadores(e.target.value)}
                    autoComplete="off"
                    style={{
                      borderColor: utilizadorSelecionado ? '#2E7D32' : undefined,
                      paddingRight: utilizadorSelecionado ? '100px' : undefined,
                    }}
                  />

                  {/* Badge confirmação */}
                  {utilizadorSelecionado && (
                    <span
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '10px',
                        background: '#E8F5E9',
                        color: '#2E7D32',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ✓ selecionado
                    </span>
                  )}

                  {/* Lista sugestões */}
                  {(utilizadoresSugestoes.length > 0 || pesquisandoUtilizadores) && (
                    <ul
                      ref={sugestoesRef}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        background: '#FFF',
                        border: '1px solid var(--border-warm)',
                        borderRadius: '6px',
                        zIndex: 300,
                        maxHeight: '180px',
                        overflowY: 'auto',
                        margin: 0,
                        padding: 0,
                        listStyle: 'none',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                      }}
                    >
                      {pesquisandoUtilizadores ? (
                        <li style={{ padding: '10px 14px', fontSize: '12px', color: '#999' }}>
                          A pesquisar...
                        </li>
                      ) : utilizadoresSugestoes.length === 0 ? (
                        <li style={{ padding: '10px 14px', fontSize: '12px', color: '#999' }}>
                          Nenhum utilizador encontrado.
                        </li>
                      ) : (
                        utilizadoresSugestoes.map(u => (
                          <li
                            key={u.id}
                            onMouseDown={() => selecionarUtilizador(u)}
                            style={{
                              padding: '9px 14px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #F0EBE3',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#FAF6F0')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#FFF')}
                          >
                            <span
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'var(--panel-dark)',
                                color: 'var(--accent-gold)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {u.nome.charAt(0).toUpperCase()}
                            </span>
                            <span>{u.nome}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>

                {/* Hints */}
                {!utilizadorSelecionado && formUtilizadorNome.length > 0 && formUtilizadorNome.length < 3 && (
                  <p style={{ fontSize: '10px', color: '#999', marginTop: '3px' }}>
                    Escreve pelo menos 3 caracteres para pesquisar.
                  </p>
                )}
                {!utilizadorSelecionado && utilizadoresSugestoes.length === 0 && formUtilizadorNome.length >= 3 && !pesquisandoUtilizadores && (
                  <p style={{ fontSize: '10px', color: '#C62828', marginTop: '3px' }}>
                    Seleciona um utilizador da lista.
                  </p>
                )}
              </div>

              {/* Estado — só no editar */}
              {modalModo === 'EDITAR' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                    Estado
                  </label>
                  <select
                    className="w-full p-2 border rounded text-sm"
                    value={formPago ? 't' : 'f'}
                    onChange={e => setFormPago(e.target.value === 't')}
                  >
                    <option value="f">Pendente</option>
                    <option value="t">Pago / Liquidado</option>
                  </select>
                </div>
              )}

              {/* Botões */}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={fecharModal}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid var(--border-warm)',
                    background: 'transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'var(--panel-dark)',
                    color: 'var(--accent-gold)',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}