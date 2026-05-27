'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

// --- INTERFACES ---
interface Artigo {
  id: string;
  nome: string;
  descricao: string;
  tamanho: string;
  cor: string;
  condicao: string;
  donoId: string;
  donoNome: string;
  isVenda: boolean;
  isAluguer: boolean;
  isDoacao: boolean;
  precoVenda: number | null;
  precoAluguer: number | null;
  criadoEm: string;
  estadoNome: string | null;
  imagemId: string | null;
  imagemIds: string[];
}

interface PaginaResponse {
  content: Artigo[];
  totalPages: number;
  number: number;
}

const FILTROS_TIPO = [
  { label: 'Todos', value: null },
  { label: 'Doação', value: 0 },
  { label: 'Venda', value: 1 },
  { label: 'Aluguer', value: 2 },
];

const CONDICOES = ['Novo', 'Como novo', 'Bom estado', 'Usado'];


function GaleriaImagens({ ids }: { ids: string[] }) {
  const [ativa, setAtiva] = useState(0);
  const total = ids.length;

  if (total === 0) {
    return (
      <div className="text-gray-500 text-center py-10 bg-gray-900 rounded-xl">
        Sem imagens adicionais.
      </div>
    );
  }

  return (
    <div>
      {/* Imagem principal */}
      <div className="relative w-full rounded-xl overflow-hidden border border-gray-700 bg-gray-900" style={{ aspectRatio: '4/3' }}>
        <img
          src={`http://localhost:8080/api/marketplace/imagem/${ids[ativa]}`}
          className="w-full h-full object-cover"
          alt="Imagem do artigo"
        />
        {total > 1 && (
          <>
            <button
              onClick={() => setAtiva(i => (i - 1 + total) % total)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl transition"
            >
              ‹
            </button>
            <button
              onClick={() => setAtiva(i => (i + 1) % total)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl transition"
            >
              ›
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {ids.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setAtiva(idx)}
                  className={`w-2 h-2 rounded-full transition ${idx === ativa ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {ids.map((imgId, idx) => (
            <img
              key={imgId}
              src={`http://localhost:8080/api/marketplace/imagem/${imgId}`}
              onClick={() => setAtiva(idx)}
              className={`w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer border-2 transition ${
                idx === ativa ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              alt=""
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketplaceCoordenacaoPage() {
  // Estados da Listagem Geral
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [loading, setLoading] = useState(true);

  // Estados dos Pendentes (Exclusivo Coordenação)
  const [pendentes, setPendentes] = useState<Artigo[]>([]);
  const [loadingPendentes, setLoadingPendentes] = useState(true);

  // Filtros
  const [pesquisa, setPesquisa] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<number | null>(null);
  const [filtroTamanho, setFiltroTamanho] = useState('');
  const [filtroCor, setFiltroCor] = useState('');
  const [filtroCondicao, setFiltroCondicao] = useState('');
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [apenasMeus, setApenasMeus] = useState(false);

  // Modal Editar
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Modal Inserir
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingInserir, setLoadingInserir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [imagens, setImagens] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    tamanho: '',
    cor: '',
    condicao: 'Novo',
    isVenda: false,
    isAluguer: false,
    isDoacao: false,
    precoVenda: '',
    precoAluguer: '',
  });

  // Modal Detalhe
  const [artigoSelecionado, setArtigoSelecionado] = useState<Artigo | null>(null);

  // Para saber se estamos a editar um artigo existente
  const [idSendoEditado, setIdSendoEditado] = useState<string | null>(null);

  //Comunicar -> Mensagens
  const router = useRouter();

  // Estados para o Inventário
  const [modalInventarioAberta, setModalInventarioAberta] = useState(false);
  const [itensInventario, setItensInventario] = useState<any[]>([]); // Itens vindos da tabela inventario_unidade
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState<string | null>(null);

  // --- IDENTIFICAÇÃO DO UTILIZADOR ---
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(window.atob(token.split('.')[1]));
        setUsuarioLogado({ 
          id: payload.sub, // O Hash ID do coordenador
          role: payload.role 
        });
      } catch (e) {
        console.error("Erro ao ler token na coordenação:", e);
      }
    }
  }, []);


  // Estados para Notificações
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const carregarNotificacoes = async () => {
    const token = localStorage.getItem('token');
    if (!usuarioLogado?.id || !token) return;

    try {
      const res = await api.get('/notificacoes/me', {
        params: { userId: usuarioLogado.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      const lista = res.data.content || [];
      setNotificacoes(lista);
      setUnreadCount(lista.filter((n: any) => !n.lida).length);
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    }
  };

  // Função para marcar como lidas (ao abrir o painel)
  const marcarTodasComoLidas = async () => {
    const naoLidas = notificacoes.filter(n => !n.lida);
    if (naoLidas.length === 0) return;
    try {
      await Promise.all(naoLidas.map(n => api.put(`/notificacoes/${n.id}/ler`)));
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Erro ao ler notificações:", err);
    }
  };

  // Polling de notificações
  useEffect(() => {
    carregarNotificacoes();
    const interval = setInterval(carregarNotificacoes, 10000);
    return () => clearInterval(interval);
  }, [usuarioLogado]);

  //Alugar artigo
  const [dataFimAluguer, setDataFimAluguer] = useState<string>('');

  // -----------------------------------------------------------------------------

  // --- GESTÃO DE IMAGENS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const novosFicheiros = Array.from(e.target.files);

      const ficheirosGrandes = novosFicheiros.filter(f => f.size > 16 * 1024 * 1024);
      if (ficheirosGrandes.length > 0) {
        setErro('Uma ou mais imagens excedem o limite de 16MB.');
        return;
      }

      setImagens(prev => [...prev, ...novosFicheiros]);
      const novosPreviews = novosFicheiros.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...novosPreviews]);
      e.target.value = '';
    }
  };

  // --- CARREGAR DADOS ---
  const carregarPendentes = async () => {
    setLoadingPendentes(true);
    try {
      const res = await api.get<Artigo[]>('/coordenacao/pendentes');
      setPendentes(res.data);
    } catch (err) {
      console.error('Erro pendentes', err);
    } finally {
      setLoadingPendentes(false);
    }
  };

  const carregarArtigos = useCallback(async (pagina: number) => {
    setLoading(true);
    try {
      const params: any = {
        page: pagina,
        size: 12,
        sortBy: 'criadoEm',
        direction: 'desc',
      };

      if (pesquisa) params.nome = pesquisa;
      if (filtroTipo !== null) params.tipoId = filtroTipo;
      if (filtroTamanho) params.tamanho = filtroTamanho;
      if (filtroCor) params.cor = filtroCor;
      if (filtroCondicao) params.condicao = filtroCondicao;
      if (precoMin) params.min = precoMin;
      if (precoMax) params.max = precoMax;
      if (apenasMeus && usuarioLogado?.id) {
        params.donoId = usuarioLogado.id;
      }
      const response = await api.get<PaginaResponse>('/marketplace', { params });
      setArtigos(response.data.content);
      setTotalPaginas(response.data.totalPages);
      setPaginaAtual(response.data.number);
    } catch (error) {
      console.error('Erro geral:', error);
    } finally {
      setLoading(false);
    }
  }, [pesquisa, filtroTipo, filtroTamanho, filtroCor, filtroCondicao, precoMin, precoMax, apenasMeus]);

  useEffect(() => {
    carregarPendentes();
    carregarArtigos(0);
  }, [carregarArtigos]);

  // Função para abrir o modal em modo de edição
  const abrirEdicao = (artigo: Artigo) => {
    setEditandoId(artigo.id);
    setForm({
      nome: artigo.nome,
      descricao: artigo.descricao || '',
      tamanho: artigo.tamanho || '',
      cor: artigo.cor || '',
      condicao: artigo.condicao,
      isVenda: artigo.isVenda,
      isAluguer: artigo.isAluguer,
      isDoacao: artigo.isDoacao,
      precoVenda: artigo.precoVenda?.toString() || '',
      precoAluguer: artigo.precoAluguer?.toString() || '',
    });
    
    // Transformar IDs de imagens existentes em URLs para o preview
    const imagensAntigas = artigo.imagemIds.map(id => `http://localhost:8080/api/marketplace/imagem/${id}`);
    setPreviews(imagensAntigas);
    setImagens([]); // Ficheiros novos começam vazios
    setModalAberto(true);
  };

  // Função para remover imagem (com suporte a remoção na BD para imagens antigas)
  const removerImagem = async (index: number) => {
    const urlParaRemover = previews[index];

    // Se a imagem NÃO for um blob local, significa que já existe no servidor
    if (!urlParaRemover.startsWith('blob:')) {
      const confirmar = confirm("Deseja remover esta imagem permanentemente da base de dados?");
      if (!confirmar) return;

      try {
        // Extrair o ID da URL (http://.../imagem/123 -> 123)
        const idImagem = urlParaRemover.split('/').pop();
        await api.delete(`/marketplace/imagem/${idImagem}`);
      } catch (err) {
        alert("Erro ao remover a imagem do servidor.");
        return;
      }
    }

    // Remove do preview visual
    const novosPreviews = previews.filter((_, i) => i !== index);
    setPreviews(novosPreviews);

    // Se era uma imagem nova (ficheiro), removemos do array de upload
    // Precisamos de calcular a posição correta no array 'imagens'
    const imagensAntigasCount = previews.filter(p => !p.startsWith('blob:')).length;
    if (urlParaRemover.startsWith('blob:')) {
      const indexNoArrayFicheiros = index - imagensAntigasCount;
      setImagens(prev => prev.filter((_, i) => i !== indexNoArrayFicheiros));
    }
  };

  // --- AÇÕES ---
  const handleDecisao = async (id: string, novoEstado: number) => {
    try {
      // Agora enviamos o número do estado diretamente para o teu endpoint
      await api.put(`/marketplace/artigos/${id}/estado/${novoEstado}`);
      
      // Atualiza a lista removendo o artigo processado
      setPendentes(prev => prev.filter(a => a.id !== id));
      
      alert("Decisão registada!");
    } catch (error) {
      console.error(error);
      alert("Erro ao processar.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setForm(prev => {
      const newForm = { ...prev, [name]: val };

      if ((name === 'isVenda' || name === 'isAluguer') && val === true) {
        newForm.isDoacao = false;
      }
      if (name === 'isDoacao' && val === true) {
        newForm.isVenda = false;
        newForm.isAluguer = false;
      }

      return newForm;
    });
  };

  const handleSalvar = async () => {
    setErro(null);

    // Validação básica (Mantida)
    const temNome = form.nome.trim() !== '';
    const temOpcaoNegocio = form.isVenda || form.isAluguer || form.isDoacao;
    const temImagens = previews.length > 0;

    if (!temNome) { setErro('O nome do artigo é obrigatório.'); return; }
    if (!temOpcaoNegocio) { setErro('Escolha pelo menos uma opção de negócio.'); return; }
    if (!temImagens) { setErro('O artigo deve ter pelo menos uma imagem.'); return; }

    setLoadingInserir(true);
    try {
      const formData = new FormData();
      formData.append('nome', form.nome);
      formData.append('descricao', form.descricao || '');
      formData.append('tamanho', form.tamanho || '');
      formData.append('cor', form.cor || '');
      formData.append('condicao', form.condicao);
      formData.append('isVenda', String(form.isVenda));
      formData.append('isAluguer', String(form.isAluguer));
      formData.append('isDoacao', String(form.isDoacao));

      // Correção 1: Garantir que valores numéricos são enviados como String limpa
      if (form.isVenda && form.precoVenda.trim() !== '') {
        formData.append('precoVenda', form.precoVenda.replace(',', '.'));
      }
      if (form.isAluguer && form.precoAluguer.trim() !== '') {
        formData.append('precoAluguer', form.precoAluguer.replace(',', '.'));
      }

      // Correção 2: Se vier do inventário, passamos o Hash ID (unidadeSelecionadaId já deve ser string)
      if (unidadeSelecionadaId) {
        console.log("DEBUG FRONTEND: unidadeSelecionadaId detetado:", unidadeSelecionadaId);
        formData.append('unidadeId', unidadeSelecionadaId); 
      } else {
        console.warn("DEBUG FRONTEND: unidadeSelecionadaId está VAZIO!");
      }

      // Log para ver o conteúdo real do FormData
      for (let [key, value] of formData.entries()) {
        console.log(`DEBUG FORM DATA: ${key} =`, value);
      }

      // Adicionar apenas os NOVOS ficheiros de imagem selecionados
      imagens.forEach(file => formData.append('imagens', file));

      // LÓGICA DE PRIORIDADE (Mantida e Protegida)
      if (editandoId) {
        // MODO EDIÇÃO (PUT) - O editandoId aqui é a Hash String
        await api.put(`/marketplace/${editandoId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else if (unidadeSelecionadaId) {
        // MODO CONVERSÃO (Inventário -> Marketplace)
        await api.post('/marketplace/importar-inventario', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        // MODO INSERÇÃO MANUAL
        await api.post('/marketplace', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Resetar estados e fechar modal (Mantido)
      setModalAberto(false);
      setEditandoId(null);
      setUnidadeSelecionadaId(null);
      setForm({
        nome: '', descricao: '', tamanho: '', cor: '',
        condicao: 'Novo', isVenda: false, isAluguer: false,
        isDoacao: false, precoVenda: '', precoAluguer: '',
      });
      setImagens([]);
      setPreviews([]);
      
      // Atualizar listas
      carregarArtigos(0);
      // Se a função carregarPendentes existir no teu contexto, ela será executada
      if (typeof carregarPendentes === 'function') carregarPendentes();
      
      alert(editandoId ? "Artigo atualizado!" : (unidadeSelecionadaId ? "Artigo importado com sucesso!" : "Artigo guardado!"));
      
    } catch (err: any) {
      // Melhoria no feedback de erro
      const mensagemErro = err.response?.data?.message || 'Erro ao guardar artigo. Verifique os dados ou imagens.';
      setErro(mensagemErro);
      console.error("Erro detalhado:", err);
    } finally {
      setLoadingInserir(false);
    }
  };

  const handleArquivar = async (id: string) => {
    if (!confirm("Tem a certeza que deseja remover/arquivar este artigo?")) return;
    try {
      await api.delete(`/marketplace/${id}`);
      carregarArtigos(paginaAtual);
      carregarPendentes();
      setArtigoSelecionado(null);
    } catch (err) {
      alert("Erro ao arquivar artigo");
    }
  };

  const prepararEdicao = (artigo: Artigo) => {
    setEditandoId(artigo.id); 
    setUnidadeSelecionadaId(null);

    setForm({
      nome: artigo.nome,
      descricao: artigo.descricao || '',
      tamanho: artigo.tamanho || '',
      cor: artigo.cor || '',
      condicao: artigo.condicao,
      isVenda: artigo.isVenda,
      isAluguer: artigo.isAluguer,
      isDoacao: artigo.isDoacao,
      precoVenda: artigo.precoVenda?.toString() || '',
      precoAluguer: artigo.precoAluguer?.toString() || '',
    });

    if (artigo.imagemIds && artigo.imagemIds.length > 0) {
      const urlsExistentes = artigo.imagemIds.map(
        (id) => `http://localhost:8080/api/marketplace/imagem/${id}`
      );
      setPreviews(urlsExistentes);
    } else {
      setPreviews([]);
    }
    
    setImagens([]);
    setModalAberto(true);
    setArtigoSelecionado(null);
  };

  //Comunica para mensagens
  const handleContactar = () => {
    if (!artigoSelecionado) return;

  const vendedorHashId = artigoSelecionado.donoId;
  const vendedorNome = artigoSelecionado.donoNome;

    router.push(`/mensagens?vendedorId=${artigoSelecionado.donoId}&nome=${encodeURIComponent(artigoSelecionado.donoNome)}`);
  };

  // Handle para Processar Compra, Aluguer ou Doação
  const handleComprarOuAlugar = async (tipo: 'VENDA' | 'ALUGUER' | 'DOACAO') => {
    if (!artigoSelecionado || !usuarioLogado) {
      alert("É necessário estar logado.");
      return;
    }


    // Na coordenação, o donoId pode ser o da escola. 
    // Mas mantemos a proteção para o coordenador não comprar o que ele próprio postou.
    if (usuarioLogado.id === artigoSelecionado.donoId) {
      alert("Não podes comprar/alugar o teu próprio artigo.");
      return;
    }

    let valorFinal = 0;
    if (tipo === 'VENDA') valorFinal = artigoSelecionado.precoVenda || 0;
    if (tipo === 'ALUGUER') valorFinal = artigoSelecionado.precoAluguer || 0;

    let dataFimPrevista: string | null = null;

    // Validação específica para Aluguer
    if (tipo === 'ALUGUER') {
      if (!dataFimAluguer) {
        alert("Por favor, indica a data de fim do aluguer.");
        return;
      }
      dataFimPrevista = dataFimAluguer;
    }

    const payload = {
      artigoId: artigoSelecionado.id,    
      compradorId: usuarioLogado.id,
      vendedorId: artigoSelecionado.donoId,
      tipo: tipo,
      valorFinal: tipo === 'VENDA' ? artigoSelecionado.precoVenda : (tipo === 'ALUGUER' ? artigoSelecionado.precoAluguer : 0),
      dataInicio: new Date().toISOString().split('T')[0],
      dataFimPrevista: dataFimPrevista 
    };

    if (!confirm(`Deseja confirmar a ${tipo.toLowerCase()} deste artigo?`)) return;

    try {
      setLoadingInserir(true);
      await api.post('/transacoes/checkout', payload);
      alert('Transação concluída!');
      
      // Limpar estados após sucesso
      setArtigoSelecionado(null);
      setDataFimAluguer(''); 
      carregarArtigos(0);
      if (typeof carregarNotificacoes === 'function') carregarNotificacoes();
    } catch (err: any) {
      console.error(err);
      alert("Erro no checkout: " + (err.response?.data?.message || "Erro de validação nos dados."));
    } finally {
      setLoadingInserir(false);
    }
  };

  // Função para buscar itens do inventário
  const abrirImportacaoInventario = async () => {
    try {
      const res = await api.get('/inventario/unidades-disponiveis');
      setItensInventario(res.data);
      setModalInventarioAberta(true);
    } catch (err) {
      alert("Erro ao carregar inventário.");
    }
  };

  // Função para "Puxar" os dados para o formulário de inserção
  const selecionarItemParaForm = (item: any) => {
    setForm({
      ...form,
      nome: item.nome,
      descricao: item.descricao || '',
    });
    setUnidadeSelecionadaId(item.id);
    setModalInventarioAberta(false);
    setModalAberto(true); // Abre a modal de inserção que já tens
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-yellow-500">Painel Coordenação</h1>
          <p className="text-gray-500 text-sm">Gestão total do Marketplace</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={abrirImportacaoInventario}
            className="px-6 py-2 bg-amber-600/20 text-amber-500 border border-amber-500/30 rounded-lg font-bold hover:bg-amber-500 hover:text-white transition"
          >
            Importar do Inventário
          </button>
          <button
            onClick={() => {
              setEditandoId(null);
              setUnidadeSelecionadaId(null);
              setModalAberto(true);
            }}
            className="px-6 py-2 bg-blue-600 rounded-lg font-bold hover:bg-blue-500 transition"
          >
            + Novo Artigo
          </button>

          <button 
            onClick={() => {
              const novoEstado = !showNotifPanel;
              setShowNotifPanel(novoEstado);
              if (novoEstado) marcarTodasComoLidas();
            }}
            className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition relative"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          {/* PAINEL FLUTUANTE */}
          {showNotifPanel && (
            <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[100] max-h-96 overflow-y-auto">
              <div className="p-4 border-b border-gray-700 font-bold text-sm">Notificações</div>
              {notificacoes.length === 0 ? (
                <p className="p-4 text-xs text-gray-500">Sem notificações.</p>
              ) : (
                notificacoes.map((n) => (
                  <div key={n.id} className={`p-4 border-b border-gray-700/50 hover:bg-gray-700/30 transition ${!n.lida ? 'bg-blue-500/5' : ''}`}>
                    <p className="text-xs font-bold text-blue-400">{n.titulo}</p>
                    <p className="text-[11px] text-gray-300 mt-1">{n.mensagem}</p>
                    <p className="text-[9px] text-gray-500 mt-2 uppercase">{new Date(n.criadaEm).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          )}
          
        </div>
      </div>

      {/* --- SECÇÃO: PENDENTES DE APROVAÇÃO --- */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
          Doações a Aguardar Aprovação ({pendentes.length})
        </h2>
        {loadingPendentes ? (
          <p className="text-gray-500 animate-pulse">A carregar...</p>
        ) : pendentes.length === 0 ? (
          <div className="p-6 bg-gray-800/30 border border-dashed border-gray-700 rounded-xl text-center text-gray-500">
            Tudo em dia! Sem pendentes.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {pendentes.map(artigo => (
              <div key={artigo.id} className="min-w-[300px] bg-gray-800 border border-yellow-900/30 p-4 rounded-xl">
                <div className="h-32 bg-gray-700 rounded mb-3 overflow-hidden">
                  {artigo.imagemId ? (
                    <img
                      src={`http://localhost:8080/api/marketplace/imagem/${artigo.imagemId}`}
                      className="w-full h-full object-cover"
                      alt={artigo.nome}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Sem imagem</div>
                  )}
                </div>
                <h3 className="font-bold truncate">{artigo.nome}</h3>
                <p className="text-xs text-gray-400 mb-1">{artigo.cor} • Tam: {artigo.tamanho}</p>
                <p className="text-xs text-gray-500 mb-4 italic">Por: {artigo.donoNome}</p>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {/* Publicar (Estado 2) */}
                    <button
                      onClick={() => handleDecisao(artigo.id, 2)}
                      className="flex-1 text-[10px] font-bold py-2 bg-green-500/10 text-green-500 rounded border border-green-500/20 hover:bg-green-500 transition"
                    >
                      Publicar
                    </button>

                    {/* Inventário (Estado 9) */}
                    <button
                      onClick={() => handleDecisao(artigo.id, 9)}
                      className="flex-1 text-[10px] font-bold py-2 bg-blue-500/10 text-blue-500 rounded border border-blue-500/20 hover:bg-blue-500 transition"
                    >
                      Inventário
                    </button>
                  </div>

                  {/* Recusar (Estado 5) */}
                  <button
                    onClick={() => handleDecisao(artigo.id, 5)}
                    className="w-full text-[10px] font-bold py-2 bg-red-500/10 text-red-500 rounded border border-red-500/20 hover:bg-red-500 transition"
                  >
                    Recusar Doação
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="border-gray-800 mb-10" />

      {/* --- MARKETPLACE GERAL --- */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Artigos Publicados</h2>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/inventario')}
            className="px-4 py-2 rounded-lg font-bold transition bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"
          >
            Inventário da Escola
          </button>
          <button
            onClick={() => setApenasMeus(!apenasMeus)}
            className={`px-4 py-2 rounded-lg font-bold transition ${apenasMeus ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}
          >
            {apenasMeus ? '✓ Artigos da Escola' : 'Ver Artigos Da Escola'}
          </button>
        </div>
      </div>

      {/* BARRA DE PESQUISA */}
      <div className="mb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
          <input
            type="text"
            placeholder="Pesquisar por nome do artigo..."
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10 bg-gray-800 p-4 rounded-xl border border-gray-700">
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-400">Tipo</label>
          <select
            onChange={(e) => setFiltroTipo(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-gray-700 rounded p-2 text-sm outline-none"
          >
            {FILTROS_TIPO.map(f => <option key={f.label} value={f.value ?? ''}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-400">Tamanho</label>
          <input placeholder="Ex: 38, M" onChange={(e) => setFiltroTamanho(e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm outline-none" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-400">Cor</label>
          <input placeholder="Ex: Preto" onChange={(e) => setFiltroCor(e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm outline-none" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-gray-400">Condição</label>
          <select onChange={(e) => setFiltroCondicao(e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm outline-none">
            <option value="">Todas</option>
            {CONDICOES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="lg:col-span-2 flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] uppercase font-bold text-gray-400">Mín (€)</label>
            <input type="number" onChange={(e) => setPrecoMin(e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm outline-none" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase font-bold text-gray-400">Máx (€)</label>
            <input type="number" onChange={(e) => setPrecoMax(e.target.value)} className="w-full bg-gray-700 rounded p-2 text-sm outline-none" />
          </div>
        </div>
      </div>

      {/* LISTAGEM GERAL */}
      {loading ? (
        <div className="text-center py-20 animate-pulse text-gray-500">A carregar artigos...</div>
      ) : artigos.length === 0 ? (
        <div className="text-center py-20 text-gray-500 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
          Nenhum artigo encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {artigos.map((artigo) => (
            <div
              key={artigo.id}
              onClick={() => setArtigoSelecionado(artigo)}
              className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col hover:border-blue-500 transition group cursor-pointer"
            >
              <div className="w-full h-48 bg-gray-700 rounded-lg overflow-hidden relative mb-3">
                {artigo.imagemId ? (
                  <img
                    src={`http://localhost:8080/api/marketplace/imagem/${artigo.imagemId}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    alt={artigo.nome}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Sem imagem</div>
                )}
                <span className="absolute top-2 left-2 text-[9px] bg-black/60 backdrop-blur-md px-2 py-1 rounded-full font-bold">
                  {artigo.condicao}
                </span>
              </div>
              <h3 className="font-bold truncate text-gray-100">{artigo.nome}</h3>
              <p className="text-xs text-gray-400 line-clamp-1">{artigo.cor} • Tam: {artigo.tamanho}</p>

              <div className="mt-4 border-t border-gray-700 pt-3 space-y-1">
                {artigo.isVenda && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Venda</span>
                    <span className="text-blue-400 font-black">{artigo.precoVenda}€</span>
                  </div>
                )}
                {artigo.isAluguer && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-purple-400 uppercase font-bold">Aluguer</span>
                    <span className="text-purple-400 font-black">{artigo.precoAluguer}€</span>
                  </div>
                )}
                {artigo.isDoacao && !artigo.isVenda && !artigo.isAluguer && (
                  <div className="text-green-400 font-black text-sm">Doação / Grátis</div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-1 rounded">
                    {artigo.donoNome}
                  </span>
                  {artigo.estadoNome && (
                    <span className="text-[10px] text-blue-300 font-medium italic">{artigo.estadoNome}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAGINAÇÃO */}
      {totalPaginas > 1 && (
        <div className="mt-10 flex justify-center gap-2">
          <button
            disabled={paginaAtual === 0}
            onClick={() => carregarArtigos(paginaAtual - 1)}
            className="px-4 py-2 bg-gray-800 rounded disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-gray-400">Página {paginaAtual + 1} de {totalPaginas}</span>
          <button
            disabled={paginaAtual >= totalPaginas - 1}
            onClick={() => carregarArtigos(paginaAtual + 1)}
            className="px-4 py-2 bg-gray-800 rounded disabled:opacity-30"
          >
            Próxima
          </button>
        </div>
      )}

      {/* MODAL INSERIR */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setModalAberto(false)}>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-yellow-400 mb-6">
              {editandoId ? `A Editar: ${form.nome}` : 'Novo Artigo (Coordenação)'}
            </h2>
            <div className="space-y-4">
              {/* IMAGENS MÚLTIPLAS */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Imagens do Artigo (Múltiplas)
                  </label>
                  {imagens.length > 0 && (
                    <button
                      onClick={() => { setImagens([]); setPreviews([]); }}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Limpar Seleção
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"/>
                {previews.length > 0 && (
                <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                  {previews.map((src, index) => (
                    <div key={index} className="relative flex-shrink-0 group">
                      <img
                        src={src}
                        alt={`Preview ${index}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-600"
                      />
                      
                      {/* BOTÃO X PARA REMOVER */}
                      <button
                        type="button"
                        onClick={() => removerImagem(index)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-red-500 shadow-lg transition-opacity group-hover:opacity-100 sm:opacity-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              </div>

              {/* CAMPOS DE TEXTO */}
              <input
                name="nome"
                value={form.nome}
                placeholder="Nome"
                onChange={handleChange}
                className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                name="descricao"
                value={form.descricao}
                placeholder="Descrição"
                onChange={handleChange}
                className="w-full bg-gray-700 p-3 rounded-lg outline-none h-24 focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <input name="tamanho" value={form.tamanho} placeholder="Tamanho" onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                <input name="cor" value={form.cor} placeholder="Cor" onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <select name="condicao" value={form.condicao} onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                {CONDICOES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* OPÇÕES DE NEGÓCIO */}
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase">Opções de Negócio</p>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="isVenda" checked={form.isVenda} onChange={handleChange} className="w-4 h-4 rounded text-blue-500" />
                    <span className="text-sm">Venda</span>
                  </label>
                  {form.isVenda && (
                    <input name="precoVenda" value={form.precoVenda} type="number" placeholder="Preço (€)" onChange={handleChange} className="w-32 bg-gray-700 p-2 rounded text-sm outline-none" />
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="isAluguer" checked={form.isAluguer} onChange={handleChange} className="w-4 h-4 rounded text-blue-500" />
                    <span className="text-sm">Aluguer</span>
                  </label>
                  {form.isAluguer && (
                    <input name="precoAluguer" value={form.precoAluguer} type="number" placeholder="Diária (€)" onChange={handleChange} className="w-32 bg-gray-700 p-2 rounded text-sm outline-none" />
                  )}
                </div>

                <label className={`flex items-center gap-2 ${form.isVenda || form.isAluguer ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    name="isDoacao"
                    checked={form.isDoacao}
                    onChange={handleChange}
                    disabled={form.isVenda || form.isAluguer}
                    className="w-4 h-4 rounded text-blue-500"
                  />
                  <span className="text-sm">Doação / Grátis</span>
                </label>
              </div>

              {erro && (
                <p className="text-red-500 text-xs font-bold bg-red-500/10 p-2 rounded border border-red-500/20">{erro}</p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setModalAberto(false); setEditandoId(null); setErro(null); }}
                  className="flex-1 bg-gray-700 py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={loadingInserir}
                  className="flex-1 bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {loadingInserir ? 'A processar...' : (editandoId ? 'Guardar Alterações' : 'Publicar Artigo')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHE DO ARTIGO */}
      {artigoSelecionado && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4 backdrop-blur-md" onClick={() => setArtigoSelecionado(null)}>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl p-6 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-blue-400">{artigoSelecionado.nome}</h2>
              <button onClick={() => setArtigoSelecionado(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* GALERIA DE IMAGENS */}
              <div className="space-y-4">
                <GaleriaImagens ids={artigoSelecionado.imagemIds ?? []} />
              </div>

              {/* INFORMAÇÕES */}
              <div className="space-y-6">
                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Detalhes do Produto</h3>
                  <p className="text-gray-300 mb-4">{artigoSelecionado.descricao || 'Sem descrição.'}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-500">Tamanho:</span> {artigoSelecionado.tamanho}</div>
                    <div><span className="text-gray-500">Cor:</span> {artigoSelecionado.cor}</div>
                    <div><span className="text-gray-500">Condição:</span> {artigoSelecionado.condicao}</div>
                    <div><span className="text-gray-500">Vendedor:</span> {artigoSelecionado.donoNome}</div>
                  </div>
                </div>

                <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20">
                  <h3 className="text-xs font-bold text-blue-400 uppercase mb-2">Preços e Opções</h3>
                  {artigoSelecionado.isVenda && (
                    <p className="text-xl font-bold">Venda: <span className="text-blue-400">{artigoSelecionado.precoVenda}€</span></p>
                  )}
                  {artigoSelecionado.isAluguer && (
                    <>
                      <p className="text-xl font-bold">Aluguer: <span className="text-purple-400">{artigoSelecionado.precoAluguer}€ / dia</span></p>
                      <div className="mt-3">
                        <label className="text-xs font-bold text-gray-500 uppercase">Data de fim do aluguer</label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={dataFimAluguer}
                          onChange={e => setDataFimAluguer(e.target.value)}
                          className="w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </>
                  )}
                  {artigoSelecionado.isDoacao && (
                    <p className="text-green-400 font-bold">Grátis</p>
                  )}
                </div>

                {/* SECÇÃO DE GESTÃO (Painel de Coordenador) */}
                <div className="space-y-4 pt-2 border-t border-gray-800">
                  <p className="text-[10px] font-bold text-gray-500 uppercase text-center">Gestão de Marketplace</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setArtigoSelecionado(null);
                        prepararEdicao(artigoSelecionado);
                      }}
                      className="flex-1 bg-amber-600 hover:bg-amber-500 py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                    >
                      <span>✏️</span> Editar Artigo
                    </button>
                    <button 
                      onClick={() => {
                        if(confirm("Desejas remover este artigo permanentemente?")) {
                          handleArquivar(artigoSelecionado.id);
                          setArtigoSelecionado(null);
                        }
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
                    >
                      <span>🗑️</span> Remover
                    </button>
                  </div>

                  {/* SEPARAÇÃO DINÂMICA: Só mostra interação se NÃO for o dono */}
                  {usuarioLogado && usuarioLogado.id !== artigoSelecionado.donoId ? (
                    <div className="space-y-3">
                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-700"></span></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-gray-800 px-2 text-gray-500">Interação</span></div>
                      </div>

                      <button 
                        onClick={handleContactar}
                        className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                        <span>💬</span> Contactar Vendedor
                      </button>

                      <div className="grid grid-cols-1 gap-2">
                        {artigoSelecionado.isVenda && (
                          <button 
                            onClick={() => handleComprarOuAlugar('VENDA')}
                            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition flex justify-between px-6 items-center">
                            <span>Comprar Agora</span>
                            <span className="bg-white/20 px-2 py-1 rounded text-sm">{artigoSelecionado.precoVenda}€</span>
                          </button>
                        )}

                        {artigoSelecionado.isAluguer && (
                          <button 
                            onClick={() => handleComprarOuAlugar('ALUGUER')}
                            className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-bold transition flex justify-between px-6 items-center">
                            <span>Alugar / Requisitar</span>
                            <span className="bg-white/20 px-2 py-1 rounded text-sm">{artigoSelecionado.precoAluguer}€/dia</span>
                          </button>
                        )}

                        {artigoSelecionado.isDoacao && (
                          <button 
                            onClick={() => handleComprarOuAlugar('DOACAO')}
                            className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold transition">
                            Pedir Doação Gratuita
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* AVISO PARA O DONO */
                    <div className="bg-amber-600/10 border border-amber-600/20 p-3 rounded-xl">
                      <p className="text-amber-500 text-[10px] font-bold text-center uppercase">Você é o proprietário deste item.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELEÇÃO INVENTÁRIO */}
      {modalInventarioAberta && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm" onClick={() => setModalInventarioAberta(false)}>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-amber-400">Selecionar do Inventário Escolar</h2>
              <button onClick={() => setModalInventarioAberta(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2">
              {itensInventario.length === 0 ? (
                <p className="text-center py-10 text-gray-500">Nenhum item disponível no inventário.</p>
              ) : (
                itensInventario.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => selecionarItemParaForm(item)}
                    className="p-4 bg-gray-900/50 border border-gray-700 rounded-xl hover:border-amber-500 cursor-pointer transition flex justify-between items-center group"
                  >
                    <div>
                      <p className="font-bold text-gray-200 group-hover:text-amber-400">{item.nome}</p>
                      <p className="text-xs text-gray-500">{item.descricao || 'Sem descrição'}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-600 uppercase">Selecionar</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
