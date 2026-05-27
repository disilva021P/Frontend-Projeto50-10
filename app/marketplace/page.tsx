'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

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
  estadoUnidadeId: number | null; 
  estadoUnidadeNome: string | null;
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

  if (!ids || ids.length === 0) {
    return <div className="w-full h-full bg-gray-800 flex items-center justify-center">Sem Imagem</div>;
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

export default function MarketplacePage() {
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [loading, setLoading] = useState(true);

  const [pesquisa, setPesquisa] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<number | null>(null);
  const [filtroTamanho, setFiltroTamanho] = useState('');
  const [filtroCor, setFiltroCor] = useState('');
  const [filtroCondicao, setFiltroCondicao] = useState('');
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [apenasMeus, setApenasMeus] = useState(false);

  //Aluger
  const [dataFimAluguer, setDataFimAluguer] = useState<string>('');

  const [modalAberto, setModalAberto] = useState(false);
  const [loadingInserir, setLoadingInserir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [imagens, setImagens] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  
  const [artigoSelecionado, setArtigoSelecionado] = useState<Artigo | null>(null);

  // Para saber se estamos a editar um artigo existente
  const [idSendoEditado, setIdSendoEditado] = useState<string | null>(null);

  // Para identificar o utilizador logado
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  const getUserIdFromToken = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub; // O 'sub' é o teu ID Hasheado
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        // Define o utilizador UMA ÚNICA VEZ com os campos necessários
        if (payload.sub) {
          setUsuarioLogado({ 
            id: payload.sub, // Este é o Hash ID
            role: payload.role 
          });
        }
      } catch (e) {
        console.error("Erro ao sincronizar utilizador:", e);
      }
    }
  }, []);

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

  const router = useRouter();

  // Estados para notificações
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const carregarNotificacoes = async () => {
    const token = localStorage.getItem('token');

    if (!usuarioLogado?.id || !token) return;

    try {
      const res = await api.get('/notificacoes/me', {
        params: { 
          userId: usuarioLogado.id // O Backend espera @RequestParam String userId
        },
        headers: { Authorization: `Bearer ${token}` }
      }); 
      
      // Como o Backend retorna Page<NotificacoeDto>, os dados estão em res.data.content
      const listaNotif = res.data.content || [];
      
      setNotificacoes(listaNotif);
      setUnreadCount(listaNotif.filter((n: any) => n.lida === false).length);
    } catch (err: any) {
      console.error("Erro ao carregar notificações:", err.response?.data);
    }
  };

  useEffect(() => {
    if (usuarioLogado?.id) {
      carregarNotificacoes(); // Carregamento inicial

      const interval = setInterval(() => {
        carregarNotificacoes();
      }, 10000); // Verifica a cada 10 segundos

      return () => clearInterval(interval);
    }
  }, [usuarioLogado?.id]); 

  const marcarTodasComoLidas = async () => {
    // Filtra apenas as que ainda não estão lidas
    const naoLidas = notificacoes.filter(n => !n.lida);
    
    if (naoLidas.length === 0) return;

    try {
      // Envia um pedido PUT para cada notificação não lida
      await Promise.all(
        naoLidas.map(n => api.put(`/notificacoes/${n.id}/ler`))
      );

      // Atualiza o estado local para refletir que estão lidas (campo lida: true)
      setNotificacoes(prev => 
        prev.map(n => ({ ...n, lida: true }))
      );
      
      // Zera o contador do sino
      setUnreadCount(0);
    } catch (err) {
      console.error("Erro ao marcar notificações como lidas:", err);
    }
  };

  // Função para gerir a seleção de ficheiros e criar previews
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const novosFicheiros = Array.from(e.target.files);
      
      const ficheirosGrandes = novosFicheiros.filter(f => f.size > 16 * 1024 * 1024);
      if (ficheirosGrandes.length > 0) {
        setErro("Uma ou mais imagens excedem o limite de 16MB.");
        return;
      }

      // ACUMULAR: Mantém as antigas e adiciona as novas
      setImagens(prev => [...prev, ...novosFicheiros]);

      // Gerar previews acumulados
      const novosPreviews = novosFicheiros.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...novosPreviews]);
      
      // Limpar o input para permitir selecionar o mesmo ficheiro se necessário
      e.target.value = "";
    }
  };

  const carregarArtigos = async (pagina: number) => {
    setLoading(true);
    try {
      // 1. O userId deve ser tipado como string | null agora
      let userId: string | null = null; 
      const savedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      
      if (savedUser && savedUser !== 'undefined') {
        try {
          const user = JSON.parse(savedUser);
          userId = user.id; // user.id agora virá como hash string do backend
        } catch (e) {
          console.error('Erro ao converter user', e);
        }
      }

      const params: any = { 
        page: pagina, 
        size: 12,
        sortBy: 'criadoEm',
        direction: 'desc'
      };
      
      if (pesquisa) params.nome = pesquisa;
      if (filtroTipo !== null) params.tipoId = filtroTipo;
      if (filtroTamanho) params.tamanho = filtroTamanho;
      if (filtroCor) params.cor = filtroCor;
      if (filtroCondicao) params.condicao = filtroCondicao;
      if (precoMin) params.min = precoMin;
      if (precoMax) params.max = precoMax;

      // 2. Usar o ID do utilizador logado (que já é string/hash)
      if (apenasMeus && usuarioLogado?.id) {
        params.donoId = usuarioLogado.id;
      }

      const response = await api.get<PaginaResponse>('/marketplace', { params });
      
      setArtigos(response.data.content);
      setTotalPaginas(response.data.totalPages);
      setPaginaAtual(response.data.number);
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarArtigos(0);
  }, [pesquisa, filtroTipo, filtroTamanho, filtroCor, filtroCondicao, precoMin, precoMax, apenasMeus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setForm(prev => {
      const newForm = { ...prev, [name]: val };

      // Lógica extra: Se ativar Venda ou Aluguer, desativa Doação automaticamente
      if ((name === 'isVenda' || name === 'isAluguer') && val === true) {
        newForm.isDoacao = false;
      }
      
      // O contrário também: Se ativar Doação, desativa Venda e Aluguer
      if (name === 'isDoacao' && val === true) {
        newForm.isVenda = false;
        newForm.isAluguer = false;
      }

      return newForm;
    });
  };

  const removerImagem = async (index: number) => {
    const previewRemovido = previews[index];
    
    // Se a string NÃO começa com 'blob:', significa que é um URL do servidor (imagem antiga)
    if (!previewRemovido.startsWith('blob:')) {
      // Extrair o ID do URL (ex: .../imagem/123 -> 123)
      const partes = previewRemovido.split('/');
      const idImagem = partes[partes.length - 1];
      
      if (confirm("Deseja remover esta imagem permanentemente?")) {
        try {
          await api.delete(`/marketplace/imagem/${idImagem}`);
        } catch (err) {
          alert("Erro ao remover imagem do servidor.");
          return;
        }
      } else {
        return;
      }
    }

    // Depois de apagar no servidor (ou se for nova), removemos do estado local
    setPreviews(prev => prev.filter((_, i) => i !== index));
    setImagens(prev => {
      const numImagensAntigas = previews.length - imagens.length;
      const novoIndexNoFile = index - numImagensAntigas;
      return (novoIndexNoFile >= 0) ? prev.filter((_, i) => i !== novoIndexNoFile) : prev;
    });
  };

  const handleSalvar = async () => {
    setErro(null);
    
    // 1. Calculamos o total de imagens resultantes
    // Previews contém tudo o que o utilizador está a ver no momento (antigas + novas)
    const totalImagensRestantes = previews.length;

    const temOpcaoNegocio = form.isVenda || form.isAluguer || form.isDoacao;

    // 2. Atualizamos a validação
    if (!form.nome || !temOpcaoNegocio) {
      setErro('Preencha o nome e escolha uma opção de negócio.');
      return;
    }

    if (totalImagensRestantes === 0) {
      setErro('O artigo deve ter pelo menos uma imagem.');
      return;
    }

    setLoadingInserir(true);
    try {
      // 1. Criamos o FormData (necessário para enviar imagens)
      const formData = new FormData();
      formData.append('nome', form.nome);
      formData.append('descricao', form.descricao || '');
      formData.append('tamanho', form.tamanho || '');
      formData.append('cor', form.cor || '');
      formData.append('condicao', form.condicao);
      formData.append('isVenda', String(form.isVenda));
      formData.append('isAluguer', String(form.isAluguer));
      formData.append('isDoacao', String(form.isDoacao));

      if (form.isVenda && form.precoVenda !== '') formData.append('precoVenda', form.precoVenda);
      if (form.isAluguer && form.precoAluguer !== '') formData.append('precoAluguer', form.precoAluguer);

      // 2. Adicionamos as NOVAS imagens selecionadas (se houver)
      imagens.forEach((file) => {
        formData.append('imagens', file);
      });

      // 3. Decidimos se enviamos para a rota de EDITAR ou INSERIR
      if (idSendoEditado) {
        // MODO EDIÇÃO
        await api.put(`/marketplace/${idSendoEditado}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        // MODO NOVO ARTIGO
        await api.post('/marketplace', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // --- SUCESSO: LIMPAR TUDO ---
      setModalAberto(false);
      setIdSendoEditado(null);
      setForm({
        nome: '', descricao: '', tamanho: '', cor: '',
        condicao: 'Novo', isVenda: false, isAluguer: false,
        isDoacao: false, precoVenda: '', precoAluguer: '',
      });
      setImagens([]);
      setPreviews([]);
      carregarArtigos(0);
      
    } catch (err: any) {
      setErro('Erro ao guardar o artigo. Tente novamente.');
    } finally {
      setLoadingInserir(false);
    }
  };

  const handleArquivar = async (id: string) => {
    if (!confirm("Tem a certeza que deseja remover este artigo?")) return;
    try {
      await api.delete(`/marketplace/${id}`);
      setArtigos(artigos.filter(a => a.id !== id));
      setArtigoSelecionado(null);
      carregarArtigos(0);
    } catch (err) {
      alert("Erro ao remover artigo.");
    }
  };

  const prepararEdicao = (artigo: Artigo) => {
    setIdSendoEditado(artigo.id);
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

    // Criar os URLs das imagens que já existem no servidor
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

  //Navegar Mensagens
  const handleContactar = () => {
    if (!artigoSelecionado) return;

  const vendedorHashId = artigoSelecionado.donoId;
  const vendedorNome = artigoSelecionado.donoNome;

    router.push(`/mensagens?vendedorId=${artigoSelecionado.donoId}&nome=${encodeURIComponent(artigoSelecionado.donoNome)}`);
  };

  // Handle para Processar Compra, Aluguer ou Doação
  const handleComprarOuAlugar = async (tipo: 'VENDA' | 'ALUGUER' | 'DOACAO') => {    
    // 1. Verificação de segurança
    if (!artigoSelecionado || !usuarioLogado) {
      alert("Erro: Artigo ou Utilizador não identificado.");
      return;
    }
    
    let valorFinal = 0;
    if (tipo === 'VENDA') valorFinal = artigoSelecionado.precoVenda || 0;
    if (tipo === 'ALUGUER') valorFinal = artigoSelecionado.precoAluguer || 0;

    let dataFimPrevista: string | null = null;

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
      tipo: tipo,
      valorFinal: tipo === 'VENDA' ? artigoSelecionado.precoVenda : (tipo === 'ALUGUER' ? artigoSelecionado.precoAluguer : 0),
      dataInicio: new Date().toISOString().split('T')[0],
      dataFimPrevista: dataFimPrevista 
    };

    // Verificação extra antes de enviar
    if (!payload.artigoId) {
      alert("Erro: O ID do artigo está em falta.");
      return;
    }

    if (!confirm(`Deseja confirmar a ${tipo.toLowerCase()} deste artigo?`)) return;

    try {
      setLoadingInserir(true);
      await api.post('/transacoes/checkout', payload);
      alert('Transação concluída!');
      setArtigoSelecionado(null);
      carregarArtigos(0);
      carregarNotificacoes();
    } catch (err: any) {
      console.error(err);
      alert("Erro no checkout: " + (err.response?.data || "Erro desconhecido"));
    } finally {
      setLoadingInserir(false);
    }
  };

  useEffect(() => {
    const id = getUserIdFromToken();
    setUsuarioLogado({ id: id }); // Forçamos o objeto a ter a propriedade 'id'
  }, []);


  //DEVOLVER ARTIGO ALUGADO

  const [alugueresAtivos, setAlugueresAtivos] = useState<any[]>([]);
  const [mostrarAlugueres, setMostrarAlugueres] = useState(false);

  const carregarAlugueresAtivos = async () => {
      if (!usuarioLogado?.id) return;
      try {
          const res = await api.get('/transacoes/meus-alugueres', {
              params: { compradorId: usuarioLogado.id }
          });
          setAlugueresAtivos(res.data);
      } catch (err) {
          console.error("Erro ao carregar alugueres:", err);
      }
  };

  const handleDevolver = async (transacaoId: string) => {
      if (!confirm("Confirma a devolução deste artigo?")) return;
      try {
          await api.put(`/transacoes/${transacaoId}/devolver`);
          alert("Artigo devolvido com sucesso!");
          carregarAlugueresAtivos();
          carregarArtigos(0);
      } catch (err) {
          alert("Erro ao devolver artigo.");
      }
  };

  // Carrega quando ativa "Meus Artigos"
  useEffect(() => {
      if (apenasMeus) carregarAlugueresAtivos();
  }, [apenasMeus, usuarioLogado?.id]);



  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-400">Marketplace</h1>
          <p className="text-gray-500 text-sm">Explora ou publica os teus artigos</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setApenasMeus(!apenasMeus)}
            className={`px-4 py-2 rounded-lg font-bold transition ${apenasMeus ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}
          >
            {apenasMeus ? '✓ Meus Artigos' : 'Ver Meus Artigos'}
          </button>

          {apenasMeus && (
            <button
                onClick={() => setMostrarAlugueres(!mostrarAlugueres)}
                className={`px-4 py-2 rounded-lg font-bold transition ${mostrarAlugueres ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}
            >
                📦 Meus Alugueres ({alugueresAtivos.length})
            </button>
          )}

          

          <button 
            onClick={() => {
              setIdSendoEditado(null);
              setForm({
                nome: '', descricao: '', tamanho: '', cor: '',
                condicao: 'Novo', isVenda: false, isAluguer: false,
                isDoacao: false, precoVenda: '', precoAluguer: '',
              });
              setImagens([]);
              setPreviews([]);
              setModalAberto(true);
            }} 
            className="px-4 py-2 bg-blue-500 rounded-lg font-bold hover:bg-blue-400 transition">
            + Inserir
          </button>

          {/* SINO DE NOTIFICAÇÕES */}
          <div className="relative">
            <button 
              onClick={() => {
                const novoEstado = !showNotifPanel;
                setShowNotifPanel(novoEstado);
                // Se estivermos a abrir o painel, marcamos como lidas
                if (novoEstado) {
                  marcarTodasComoLidas();
                }
              }}
              className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition relative"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* PAINEL FLUTUANTE */}
            {showNotifPanel && (
              <div className="absolute right-0 mt-3 w-80 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl z-[100] overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="font-bold text-sm">Notificações</h3>
                  <button onClick={() => setShowNotifPanel(false)} className="text-gray-500">×</button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificacoes.length === 0 ? (
                    <p className="p-8 text-center text-gray-500 text-sm">Sem notificações novas.</p>
                  ) : (
                    notificacoes.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-4 border-b border-gray-700/50 hover:bg-gray-750 transition cursor-pointer ${!n.lida ? 'bg-blue-500/5' : ''}`}
                      >
                        <p className="text-xs font-bold text-blue-400">{n.titulo}</p>
                        <p className="text-sm text-gray-300 mt-1">{n.mensagem}</p>
                        <p className="text-[10px] text-gray-500 mt-2 uppercase">
                          {n.criadaEm ? new Date(n.criadaEm).toLocaleDateString() : 'Recentemente'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      
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
          <select onChange={(e) => setFiltroTipo(e.target.value ? Number(e.target.value) : null)} className="w-full bg-gray-700 rounded p-2 text-sm outline-none">
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
            <div key={artigo.id} onClick={() => setArtigoSelecionado(artigo)} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col hover:border-blue-500 transition group">
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
                  {artigo.estadoUnidadeNome && (
                      <span className="text-[10px] text-blue-300 font-medium italic">{artigo.estadoUnidadeNome}</span>
                    )}
                  </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {apenasMeus && mostrarAlugueres && alugueresAtivos.length > 0 && (
        <div className="mb-8 space-y-3">
            <h2 className="text-lg font-bold text-purple-400">Artigos que tenho alugados</h2>
            {alugueresAtivos.map(t => (
                <div key={t.id} className="bg-gray-800 border border-purple-500/30 rounded-xl p-4 flex justify-between items-center">
                    <div>
                        <p className="font-bold text-white">{t.artigoNome}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            De <span className="text-purple-300">{t.dataInicio}</span> até <span className="text-purple-300">{t.dataFimPrevista}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Valor: {t.valorFinal}€</p>
                    </div>
                    <button
                        onClick={() => handleDevolver(t.id)}
                        className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-bold transition"
                    >
                        Devolver
                    </button>
                </div>
            ))}
        </div>
      )}

      {apenasMeus && mostrarAlugueres && alugueresAtivos.length === 0 && (
        <div className="mb-8 text-center py-8 text-gray-500 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
            Não tens alugueres ativos.
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
            <h2 className="text-xl font-bold text-blue-400 mb-6">
              {idSendoEditado ? 'Editar Artigo' : 'Inserir Artigo'}
            </h2>            
            <div className="space-y-4">
              {/* SEÇÃO DE IMAGENS MÚLTIPLAS */}
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
                  multiple // PERMITE VÁRIAS
                  onChange={handleFileChange} 
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer" 
                />

                {/* PREVIEWS DAS IMAGENS */}
                {previews.length > 0 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                    {previews.map((src, index) => (
                      <div key={index} className="relative flex-shrink-0 group">
                        <img 
                          src={src} 
                          alt={`Preview ${index}`} 
                          className="w-20 h-20 object-cover rounded-lg border border-gray-600"
                        />                        
                        
                        {/* O botão aparece sempre que houver uma imagem, mesmo que seja a única */}
                        <button
                          onClick={() => removerImagem(index)}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-red-500 shadow-lg opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CAMPOS DE TEXTO */}
              <input name="nome" value={form.nome} placeholder="Nome" onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea name="descricao" value={form.descricao} placeholder="Descrição" onChange={handleChange} className="w-full bg-gray-700 p-3 rounded-lg outline-none h-24 focus:ring-2 focus:ring-blue-500" />
              
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
                    // Fica desativado se Venda OU Aluguer forem verdadeiros
                    disabled={form.isVenda || form.isAluguer} 
                    className="w-4 h-4 rounded text-blue-500"/>
                  <span className="text-sm">Doação / Grátis</span>
                </label>
              </div>
              
              {erro && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-2 rounded border border-red-500/20">{erro}</p>}
              
              {/* BOTÕES DE AÇÃO */}
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setModalAberto(false)} 
                  className="flex-1 bg-gray-700 py-3 rounded-xl font-bold hover:bg-gray-600 transition"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSalvar} 
                  disabled={loadingInserir} 
                  className="flex-1 bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingInserir ? 'A processar...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>        
      )}

      {artigoSelecionado && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4 backdrop-blur-md" onClick={() => setModalAberto(false)}>
          
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl p-6 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-blue-400">{artigoSelecionado.nome}</h2>
                <button onClick={() => { setArtigoSelecionado(null); setDataFimAluguer(''); }} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* GALERIA DE IMAGENS */}
              <div className="space-y-4">
                <GaleriaImagens ids={artigoSelecionado.imagemIds ?? []} />
              </div>

              {/* INFORMAÇÕES */}
              <div className="space-y-6">
                {/* DETALHES DO PRODUTO */}
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

                {/* PREÇOS E OPÇÕES */}
                <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20">
                  <h3 className="text-xs font-bold text-blue-400 uppercase mb-2">Preços e Opções</h3>
                  {artigoSelecionado.isVenda && <p className="text-xl font-bold">Venda: <span className="text-blue-400">{artigoSelecionado.precoVenda}€</span></p>}
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
                  {artigoSelecionado.isDoacao && <p className="text-green-400 font-bold">Grátis</p>}
                </div>
                
                
                {/* LOGICA DE BOTOES POR PROPRIEDADE */}
                {usuarioLogado?.id && artigoSelecionado?.donoId && 
                  usuarioLogado.id === artigoSelecionado.donoId ? (
                  
                  /* VISÃO DO DONO: EDITAR / REMOVER */
                  <div className="space-y-3 pt-2 border-t border-gray-800">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mb-2">
                      <p className="text-amber-500 text-xs text-center font-bold uppercase">Este artigo é seu</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => prepararEdicao(artigoSelecionado)}
                        className="flex-1 bg-amber-600 hover:bg-amber-500 py-3 rounded-lg font-bold text-sm transition"
                      >
                        Editar Artigo
                      </button>
                      <button 
                        onClick={() => handleArquivar(artigoSelecionado.id)}
                        className="flex-1 bg-red-600 hover:bg-red-500 py-3 rounded-lg font-bold text-sm transition"
                      >
                        Remover Artigo
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VISÃO DO COMPRADOR: CONTACTAR + COMPRAR/ALUGAR */
                  <div className="space-y-3 pt-2 border-t border-gray-800">
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}