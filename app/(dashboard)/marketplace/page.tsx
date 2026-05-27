"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

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

type Role = "ALUNO" | "COORDENACAO" | "PROFESSOR" | "ENCARREGADO";

const FILTROS_TIPO = [
  { label: "Todos os tipos", value: null },
  { label: "Doação", value: 0 },
  { label: "Venda", value: 1 },
  { label: "Aluguer", value: 2 },
];

const CONDICOES = ["Novo", "Como novo", "Bom estado", "Usado"];

function GaleriaImagens({ ids }: { ids: string[] }) {
  const [ativa, setAtiva] = useState(0);
  const total = ids.length;

  if (!ids || ids.length === 0) {
    return (
      <div
        className="w-full h-full bg-[#FFFCF8] rounded-lg flex flex-col items-center justify-center border border-border-warm text-accent-muted gap-2"
        style={{ aspectRatio: "4/3" }}
      >
        <i className="ti ti-photo text-2xl" />
        <span className="text-xs tracking-wider uppercase font-light">
          Sem imagens disponíveis
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative w-full rounded-lg overflow-hidden border border-border-warm bg-[#FFFCF8] group/gallery"
        style={{ aspectRatio: "4/3" }}
      >
        <img
          src={`http://localhost:8080/api/marketplace/imagem/${ids[ativa]}`}
          className="w-full h-full object-cover transition-transform duration-500"
          alt="Imagem do artigo"
        />
        {total > 1 && (
          <>
            <button
              onClick={() => setAtiva((i) => (i - 1 + total) % total)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-panel-dark/80 hover:bg-panel-dark text-accent-gold rounded-sm w-8 h-8 flex items-center justify-center transition-all opacity-0 group-hover/gallery:opacity-100"
            >
              <i className="ti ti-chevron-left" />
            </button>
            <button
              onClick={() => setAtiva((i) => (i + 1) % total)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-panel-dark/80 hover:bg-panel-dark text-accent-gold rounded-sm w-8 h-8 flex items-center justify-center transition-all opacity-0 group-hover/gallery:opacity-100"
            >
              <i className="ti ti-chevron-right" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-panel-dark/40 px-2 py-1 rounded-full backdrop-blur-sm">
              {ids.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setAtiva(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === ativa ? "bg-accent-gold w-3" : "bg-[#FFFCF8]/60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {ids.map((imgId, idx) => (
            <img
              key={imgId}
              src={`http://localhost:8080/api/marketplace/imagem/${imgId}`}
              onClick={() => setAtiva(idx)}
              className={`w-14 h-14 object-cover rounded border transition-all cursor-pointer ${
                idx === ativa
                  ? "border-accent-gold scale-95"
                  : "border-border-warm/40 opacity-60 hover:opacity-100"
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
  const router = useRouter();

  // Estados mantidos apenas para controlo interno e Marketplace
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<Role | null>(null);

  // Estados do Marketplace
  const [artigos, setArtigos] = useState<Artigo[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [loading, setLoading] = useState(true);

  // Estados de Coordenação / Doações Pendentes
  const [pendentes, setPendentes] = useState<Artigo[]>([]);
  const [mostrarPendentes, setMostrarPendentes] = useState(false);
  const [loadingPendentes, setLoadingPendentes] = useState(false);

  const [pesquisa, setPesquisa] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<number | null>(null);
  const [filtroTamanho, setFiltroTamanho] = useState("");
  const [filtroCor, setFiltroCor] = useState("");
  const [filtroCondicao, setFiltroCondicao] = useState("");
  const [precoMin, setPrecoMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [apenasMeus, setApenasMeus] = useState(false);

  const [dataFimAluguer, setDataFimAluguer] = useState<string>("");
  const [modalAberto, setModalAberto] = useState(false);
  const [loadingInserir, setLoadingInserir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [imagens, setImagens] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [artigoSelecionado, setArtigoSelecionado] = useState<Artigo | null>(
    null,
  );
  const [idSendoEditado, setIdSendoEditado] = useState<string | null>(null);
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    tamanho: "",
    cor: "",
    condicao: "Novo",
    isVenda: false,
    isAluguer: false,
    isDoacao: false,
    precoVenda: "",
    precoAluguer: "",
  });

  const [alugueresAtivos, setAlugueresAtivos] = useState<any[]>([]);
  const [mostrarAlugueres, setMostrarAlugueres] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    let idFinal: string | undefined;
    let nomeUsuario = "";

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUserName(parsed.nome ?? "");
        setRole((parsed.tipoUtilizadorId as Role) ?? null);
        idFinal = parsed.id ?? parsed.sub;
        nomeUsuario = parsed.nome ?? "Utilizador";
      } catch { /* ignora */ }
    }

    if (!idFinal && token) {
      try {
        const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        idFinal = payload.sub ?? payload.id;
      } catch { /* ignora */ }
    }

    if (idFinal) {
      setUsuarioLogado({ id: String(idFinal), nome: nomeUsuario });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const novosFicheiros = Array.from(e.target.files);
      const ficheirosGrandes = novosFicheiros.filter(
        (f) => f.size > 16 * 1024 * 1024,
      );
      if (ficheirosGrandes.length > 0) {
        setErro("Uma ou mais imagens excedem o limite de 16MB.");
        return;
      }
      setImagens((prev) => [...prev, ...novosFicheiros]);
      const novosPreviews = novosFicheiros.map((file) =>
        URL.createObjectURL(file),
      );
      setPreviews((prev) => [...prev, ...novosPreviews]);
      e.target.value = "";
    }
  };

  const carregarArtigos = async (pagina: number) => {
    setLoading(true);
    try {
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

      if (apenasMeus) {
        const token = localStorage.getItem("token");
        let meuIdReal = usuarioLogado?.id;

        if (!meuIdReal && token) {
          try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            meuIdReal = payload.sub; 
          } catch (e) {
            console.error("Erro ao extrair ID para o filtro:", e);
          }
        }

        if (meuIdReal) {
          params.donoId = meuIdReal;
        }
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

  // Carrega as Doações Pendentes (Exclusivo Coordenação)
  const carregarPendentes = async () => {
    setLoadingPendentes(true);
    try {
      const response = await api.get<Artigo[]>('/coordenacao/pendentes');
      setPendentes(response.data);
    } catch (error) {
      console.error("Erro ao carregar doações pendentes:", error);
    } finally {
      setLoadingPendentes(false);
    }
  };

  // Executa a ação de triagem (Aprovar=2, Recusar=5, Inventário=9)
  const handleDecisao = async (id: string, novoEstado: number) => {
    let acaoTexto = "alterar o estado deste artigo";
    if (novoEstado === 2) acaoTexto = "aceitar e publicar esta doação";
    if (novoEstado === 5) acaoTexto = "recusar esta doação";
    if (novoEstado === 9) acaoTexto = "adicionar este artigo diretamente ao inventário escolar";

    if (!confirm(`Tem a certeza que deseja ${acaoTexto}?`)) return;

    try {
      await api.put(`/marketplace/artigos/${id}/estado/${novoEstado}`);
      alert("Operação realizada com sucesso!");
      // Atualiza o estado local removendo o item processado de forma instantânea
      setPendentes((prev) => prev.filter((artigo) => artigo.id !== id));
      // Recarrega a montra principal caso o item tenha sido publicado
      if (novoEstado === 2) carregarArtigos(0);
    } catch (error) {
      console.error("Erro ao processar decisão:", error);
      alert("Ocorreu um erro ao atualizar o estado do artigo.");
    }
  };

  useEffect(() => {
    if (!mostrarPendentes) {
      carregarArtigos(0);
    } else {
      carregarPendentes();
    }
  }, [
    pesquisa,
    filtroTipo,
    filtroTamanho,
    filtroCor,
    filtroCondicao,
    precoMin,
    precoMax,
    apenasMeus,
    usuarioLogado?.id,
    mostrarPendentes
  ]);

  useEffect(() => {
  if (role === "COORDENACAO") {
    carregarPendentes(); // carrega a contagem em background
  }
}, [role]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const val =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setForm((prev) => {
      const newForm = { ...prev, [name]: val };
      if ((name === "isVenda" || name === "isAluguer") && val === true) {
        newForm.isDoacao = false;
      }
      if (name === "isDoacao" && val === true) {
        newForm.isVenda = false;
        newForm.isAluguer = false;
      }
      return newForm;
    });
  };

  const removerImagem = async (index: number) => {
    const previewRemovido = previews[index];
    if (!previewRemovido.startsWith("blob:")) {
      const partes = previewRemovido.split("/");
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

    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setImagens((prev) => {
      const numImagensAntigas = previews.length - imagens.length;
      const novoIndexNoFile = index - numImagensAntigas;
      return novoIndexNoFile >= 0
        ? prev.filter((_, i) => i !== novoIndexNoFile)
        : prev;
    });
  };

  const handleSalvar = async () => {
    setErro(null);
    const totalImagensRestantes = previews.length;
    const temOpcaoNegocio = form.isVenda || form.isAluguer || form.isDoacao;

    // ─── VALIDAÇÕES DOS CAMPOS TEXTO OBRIGATÓRIOS ───
    if (!form.nome.trim()) {
      setErro("Por favor, introduza o nome do artigo.");
      return;
    }
    if (!form.descricao.trim()) {
      setErro("Por favor, introduza uma descrição para o artigo.");
      return;
    }
    if (!form.tamanho.trim()) {
      setErro("Por favor, introduza o tamanho do artigo (ex: S, M, L, 38).");
      return;
    }
    if (!form.cor.trim()) {
      setErro("Por favor, especifique a cor do artigo.");
      return;
    }

    // Validação das Opções de Negócio
    if (!temOpcaoNegocio) {
      setErro("Escolha pelo menos uma opção de negócio (Doação, Venda ou Aluguer).");
      return;
    }

    // Validação condicional dos preços com base no tipo de negócio ativo
    if (form.isVenda && (!form.precoVenda || parseFloat(form.precoVenda) <= 0)) {
      setErro("Por favor, insira um preço de venda válido e superior a 0€.");
      return;
    }
    if (form.isAluguer && (!form.precoAluguer || parseFloat(form.precoAluguer) <= 0)) {
      setErro("Por favor, insira um preço de aluguer válido e superior a 0€.");
      return;
    }

    // Validação das Imagens
    if (totalImagensRestantes === 0) {
      setErro("O artigo deve conter pelo menos uma imagem descritiva.");
      return;
    }

    setLoadingInserir(true);
    try {
      const formData = new FormData();
      formData.append("nome", form.nome.trim());
      formData.append("descricao", form.descricao.trim());
      formData.append("tamanho", form.tamanho.trim());
      formData.append("cor", form.cor.trim());
      formData.append("condicao", form.condicao);
      formData.append("isVenda", String(form.isVenda));
      formData.append("isAluguer", String(form.isAluguer));
      formData.append("isDoacao", String(form.isDoacao));

      if (form.isVenda && form.precoVenda !== "")
        formData.append("precoVenda", form.precoVenda);
      if (form.isAluguer && form.precoAluguer !== "")
        formData.append("precoAluguer", form.precoAluguer);

      imagens.forEach((file) => formData.append("imagens", file));

      if (idSendoEditado) {
        await api.put(`/marketplace/${idSendoEditado}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/marketplace", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setModalAberto(false);
      setIdSendoEditado(null);
      setForm({
        nome: "",
        descricao: "",
        tamanho: "",
        cor: "",
        condicao: "Novo",
        isVenda: false,
        isAluguer: false,
        isDoacao: false,
        precoVenda: "",
        precoAluguer: "",
      });
      setImagens([]);
      setPreviews([]);
      carregarArtigos(0);
    } catch (err: any) {
      setErro(
        "Ocorreu um erro ao guardar o artigo. Por favor, verifique os dados e tente novamente.",
      );
    } finally {
      setLoadingInserir(false);
    }
  };

  const handleArquivar = async (id: string) => {
    if (
      !confirm("Tem a certeza que deseja remover definitivamente este artigo?")
    )
      return;
    try {
      await api.delete(`/marketplace/${id}`);
      setArtigos(artigos.filter((a) => a.id !== id));
      setArtigoSelecionado(null);
      carregarArtigos(0);
    } catch (err) {
      alert("Erro ao remover o artigo.");
    }
  };

  const prepararEdicao = (artigo: Artigo) => {
    setIdSendoEditado(artigo.id);
    setForm({
      nome: artigo.nome,
      descricao: artigo.descricao || "",
      tamanho: artigo.tamanho || "",
      cor: artigo.cor || "",
      condicao: artigo.condicao,
      isVenda: artigo.isVenda,
      isAluguer: artigo.isAluguer,
      isDoacao: artigo.isDoacao,
      precoVenda: artigo.precoVenda?.toString() || "",
      precoAluguer: artigo.precoAluguer?.toString() || "",
    });

    if (artigo.imagemIds && artigo.imagemIds.length > 0) {
      const urlsExistentes = artigo.imagemIds.map(
        (id) => `http://localhost:8080/api/marketplace/imagem/${id}`,
      );
      setPreviews(urlsExistentes);
    } else {
      setPreviews([]);
    }
    setImagens([]);
    setModalAberto(true);
    setArtigoSelecionado(null);
  };

  const handleContactar = () => {
    if (!artigoSelecionado) return;
    router.push(
      `/mensagens?vendedorId=${artigoSelecionado.donoId}&nome=${encodeURIComponent(artigoSelecionado.donoNome)}`,
    );
  };

  const handleComprarOuAlugar = async (
    tipo: "VENDA" | "ALUGUER" | "DOACAO",
  ) => {
    if (!artigoSelecionado || !usuarioLogado) {
      alert("Erro de autenticação: Artigo ou Utilizador não identificado.");
      return;
    }

    let dataFimPrevista: string | null = null;
    if (tipo === "ALUGUER") {
      if (!dataFimAluguer) {
        alert(
          "Por favor, selecione uma data válida de fim para o período de aluguer.",
        );
        return;
      }
      dataFimPrevista = dataFimAluguer;
    }

    const payload = {
      artigoId: artigoSelecionado.id,
      compradorId: usuarioLogado.id,
      tipo: tipo,
      valorFinal:
        tipo === "VENDA"
          ? artigoSelecionado.precoVenda
          : tipo === "ALUGUER"
            ? artigoSelecionado.precoAluguer
            : 0,
      dataInicio: new Date().toISOString().split("T")[0],
      dataFimPrevista: dataFimPrevista,
    };

    if (
      !confirm(`Confirma a operação de ${tipo.toLowerCase()} para este artigo?`)
    )
      return;

    try {
      setLoadingInserir(true);
      await api.post("/transacoes/checkout", payload);
      alert("Operação efetuada com sucesso!");
      setArtigoSelecionado(null);
      carregarArtigos(0);
    } catch (err: any) {
      console.error(err);
      alert(
        "Erro no checkout: " +
          (err.response?.data || "Falha na comunicação com o servidor"),
      );
    } finally {
      setLoadingInserir(false);
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

  const carregarAlugueresAtivos = async () => {
    if (!usuarioLogado?.id) return;
    try {
      const res = await api.get("/transacoes/meus-alugueres", {
        params: { compradorId: usuarioLogado.id },
      });
      setAlugueresAtivos(res.data);
    } catch (err) {
      console.error("Erro ao carregar alugueres:", err);
    }
  };

  useEffect(() => {
    if (apenasMeus) carregarAlugueresAtivos();
  }, [apenasMeus, usuarioLogado?.id]);

  return (
    <div className="flex flex-col min-h-full bg-background font-sans text-panel-dark">
      <div className="flex flex-1 relative overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[10px] tracking-[3px] uppercase text-accent-muted font-light mb-1">
                Comunidade
              </p>
              <h1
                style={{ fontFamily: "var(--font-playfair)" }}
                className="text-2xl font-normal text-panel-dark"
              >
                {mostrarPendentes ? "Moderação de Doações" : "Marketplace"}
              </h1>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
              {/* 1. Botão Administrativo: Doações Pendentes (Apenas Visível para COORDENACAO) */}
              {role === "COORDENACAO" && (
                <button
                  onClick={() => {
                    setMostrarPendentes(!mostrarPendentes);
                    setApenasMeus(false);
                    setMostrarAlugueres(false);
                  }}
                  className={`px-4 py-2 border rounded-sm text-xs tracking-wide transition-all uppercase flex items-center gap-1.5 ${
                    mostrarPendentes
                      ? "bg-[#3A6A3A] text-white border-[#3A6A3A] font-medium shadow-sm"
                      : "bg-[#FFFCF8] text-panel-dark border-border-warm hover:border-accent-muted"
                  }`}
                >
                  <i className="ti ti-gavel" /> Doações Pendentes
                  {pendentes.length > 0 && (
                    <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold leading-none ${
                      mostrarPendentes ? "bg-white text-[#3A6A3A]" : "bg-[#3A6A3A] text-white"
                    }`}>
                      {pendentes.length}
                    </span>
                  )}
                </button>
              )}

              {/* 2. Botão Recompras/Alugueres */}
              {apenasMeus && !mostrarPendentes && (
                <button
                  onClick={() => setMostrarAlugueres(!mostrarAlugueres)}
                  className={`px-4 py-2 border rounded-sm text-xs tracking-wide transition-all uppercase ${
                    mostrarAlugueres
                      ? "bg-panel-dark text-accent-gold border-panel-dark font-medium shadow-sm"
                      : "bg-[#FFFCF8] text-panel-dark border-border-warm hover:border-accent-muted"
                  }`}
                >
                  <i className="ti ti-package mr-1" /> Alugueres ({alugueresAtivos.length})
                </button>
              )}

              {/* 3. Botão Ver os meus anúncios */}
              {!mostrarPendentes && (
                <button
                  onClick={() => {
                    setApenasMeus(!apenasMeus);
                    if (mostrarAlugueres) setMostrarAlugueres(false);
                  }}
                  className={`px-4 py-2 border rounded-sm text-xs tracking-wide transition-all uppercase ${
                    apenasMeus && !mostrarAlugueres
                      ? "bg-panel-dark text-accent-gold border-panel-dark font-medium shadow-sm"
                      : "bg-[#FFFCF8] text-accent-muted border-border-warm hover:border-accent-muted"
                  }`}
                >
                  {apenasMeus ? "• Ver todos os artigos" : "Ver os meus anúncios"}
                </button>
              )}

              {/* 4. Botão Criar Anúncio */}
              <button
                onClick={() => {
                  setIdSendoEditado(null);
                  setForm({
                    nome: "",
                    descricao: "",
                    tamanho: "",
                    cor: "",
                    condicao: "Novo",
                    isVenda: false,
                    isAluguer: false,
                    isDoacao: false,
                    precoVenda: "",
                    precoAluguer: "",
                  });
                  setImagens([]);
                  setPreviews([]);
                  setModalAberto(true);
                }}
                className="px-4 py-2 bg-panel-dark hover:bg-panel-dark/90 text-accent-gold rounded-sm text-xs tracking-wider uppercase font-normal transition-all"
              >
                + Criar anúncio
              </button>
            </div>
          </header>

          {/* Oculta filtros e pesquisa se estiver no painel de moderação de pendentes */}
          {!mostrarPendentes && (
            <>
              {/* PESQUISA */}
              <div className="relative mb-5">
                <i className="ti ti-search absolute inset-y-0 left-3 flex items-center text-accent-muted text-sm" />
                <input
                  type="text"
                  placeholder="O que procura hoje?"
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                  className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm py-2 pl-9 pr-4 text-sm text-panel-dark placeholder-accent-muted/60 outline-none focus:border-panel-dark transition-all"
                />
              </div>

              {/* FILTROS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 bg-[#FBF7F2] p-4 border border-border-warm rounded-sm">
                <div>
                  <label className="text-[9px] uppercase tracking-wider font-normal text-accent-muted block mb-1">
                    Tipo de Negócio
                  </label>
                  <select
                    onChange={(e) =>
                      setFiltroTipo(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm p-1.5 text-xs text-panel-dark outline-none focus:border-panel-dark transition-colors"
                  >
                    {FILTROS_TIPO.map((f) => (
                      <option key={f.label} value={f.value ?? ""}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider font-normal text-accent-muted block mb-1">
                    Tamanho
                  </label>
                  <input
                    placeholder="Ex: M, 38"
                    onChange={(e) => setFiltroTamanho(e.target.value)}
                    className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm p-1.5 text-xs text-panel-dark outline-none focus:border-panel-dark transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider font-normal text-accent-muted block mb-1">
                    Cor
                  </label>
                  <input
                    placeholder="Ex: Preto"
                    onChange={(e) => setFiltroCor(e.target.value)}
                    className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm p-1.5 text-xs text-panel-dark outline-none focus:border-panel-dark transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider font-normal text-accent-muted block mb-1">
                    Condição
                  </label>
                  <select
                    onChange={(e) => setFiltroCondicao(e.target.value)}
                    className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm p-1.5 text-xs text-panel-dark outline-none focus:border-panel-dark transition-colors"
                  >
                    <option value="">Qualquer</option>
                    {CONDICOES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] uppercase tracking-wider font-normal text-accent-muted block mb-1">
                      Mínimo (€)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      onChange={(e) => setPrecoMin(e.target.value)}
                      className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm p-1.5 text-xs text-panel-dark outline-none focus:border-panel-dark transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] uppercase tracking-wider font-normal text-accent-muted block mb-1">
                      Máximo (€)
                    </label>
                    <input
                      type="number"
                      placeholder="Max"
                      onChange={(e) => setPrecoMax(e.target.value)}
                      className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm p-1.5 text-xs text-panel-dark outline-none focus:border-panel-dark transition-colors"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SEÇÃO RECOMPRAS / ALUGUERES ATIVOS */}
          {apenasMeus && mostrarAlugueres && !mostrarPendentes && (
            <div className="mb-6 space-y-3">
              <h2
                style={{ fontFamily: "var(--font-playfair)" }}
                className="text-sm text-panel-dark flex items-center gap-1"
              >
                <i className="ti ti-package text-accent-muted" /> Artigos
                requisitados por ti
              </h2>
              {alugueresAtivos.length === 0 ? (
                <div className="text-center py-6 text-xs text-accent-muted bg-[#FBF7F2] rounded-sm border border-dashed border-border-warm">
                  Nenhum aluguer em vigor neste momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {alugueresAtivos.map((t) => (
                    <div
                      key={t.id}
                      className="bg-[#FFFCF8] border border-border-warm rounded-sm p-3 flex justify-between items-center shadow-xs relative"
                    >
                      <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-accent-muted" />
                      <div className="pl-2">
                        <p className="text-sm font-normal text-panel-dark">
                          {t.artigoNome}
                        </p>
                        <p className="text-[10px] text-accent-muted mt-0.5">
                          Período:{" "}
                          <span className="font-normal">{t.dataInicio}</span> a{" "}
                          <span className="font-normal">
                            {t.dataFimPrevista}
                          </span>
                        </p>
                        <p className="text-[10px] text-accent-muted mt-0.5">
                          Custo:{" "}
                          <span className="text-panel-dark font-normal">
                            {t.valorFinal}€
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleDevolver(t.id)}
                        className="bg-panel-dark hover:bg-panel-dark/95 text-accent-gold px-3 py-1.5 rounded-sm text-[10px] uppercase font-normal tracking-wide transition-all"
                      >
                        Devolver
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── VISÃO DO COORDENADOR: LISTA DE DOAÇÕES PENDENTES ── */}
          {mostrarPendentes ? (
            loadingPendentes ? (
              <div className="flex flex-col items-center justify-center py-20 text-accent-muted gap-3">
                <div
                  style={{ borderTopColor: "var(--accent-gold)" }}
                  className="w-5 h-5 border-2 border-border-warm rounded-full animate-spin"
                ></div>
                <p className="text-[11px] font-light uppercase tracking-wider animate-pulse">
                  A carregar doações pendentes...
                </p>
              </div>
            ) : pendentes.length === 0 ? (
              <div className="text-center py-16 text-accent-muted bg-[#FBF7F2] rounded-sm border border-dashed border-border-warm max-w-md mx-auto px-4">
                <i className="ti ti-check text-2xl block mb-2 text-[#3A6A3A]" />
                <h3
                  style={{ fontFamily: "var(--font-playfair)" }}
                  className="text-sm text-panel-dark font-normal"
                >
                  Tudo limpo!
                </h3>
                <p className="text-xs text-accent-muted mt-1 font-light">
                  Nenhuma doação a aguardar moderação de momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendentes.map((artigo) => (
                  <div
                    key={artigo.id}
                    className="bg-[#FFFCF8] rounded-sm border border-border-warm overflow-hidden flex flex-col justify-between hover:shadow-xs transition-all duration-200"
                  >
                    <div>
                      <div className="w-full bg-[#FBF7F2] h-48 relative">
                        {artigo.imagemId ? (
                          <img
                            src={`http://localhost:8080/api/marketplace/imagem/${artigo.imagemId}`}
                            className="w-full h-full object-cover"
                            alt={artigo.nome}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-accent-muted text-[10px] uppercase tracking-wider font-light gap-1">
                            <i className="ti ti-photo" /> Sem foto
                          </div>
                        )}
                        <span className="absolute top-2 right-2 bg-panel-dark text-accent-gold text-[9px] px-2 py-0.5 uppercase tracking-wide rounded-xs font-light">
                          Doador: {artigo.donoNome}
                        </span>
                      </div>

                      <div className="p-3 space-y-1.5">
                        <h3
                          style={{ fontFamily: "var(--font-playfair)" }}
                          className="text-base text-panel-dark font-normal leading-snug truncate"
                        >
                          {artigo.nome}
                        </h3>
                        <p className="text-xs text-accent-muted font-light line-clamp-2 h-8">
                          {artigo.descricao || "Sem descrição informada."}
                        </p>
                        <p className="text-[11px] text-panel-dark bg-[#FBF7F2] px-2 py-1 rounded-xs inline-block font-light">
                          {[artigo.tamanho, artigo.cor, artigo.condicao].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>

                    {/* Botões de Ação para a Triagem */}
                    <div className="p-3 pt-0 border-t border-[#FBF7F2] mt-2 grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handleDecisao(artigo.id, 2)}
                        className="bg-[#3A6A3A] hover:bg-[#2E542E] text-white py-1.5 rounded-sm text-[10px] uppercase tracking-wider font-medium text-center transition-colors"
                        title="Aprovar e publicar no Marketplace"
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() => handleDecisao(artigo.id, 9)}
                        className="bg-panel-dark hover:bg-panel-dark/90 text-accent-gold py-1.5 rounded-sm text-[10px] uppercase tracking-wider font-medium text-center transition-colors"
                        title="Enviar diretamente para o inventário da escola"
                      >
                        Inventário
                      </button>
                      <button
                        onClick={() => handleDecisao(artigo.id, 5)}
                        className="bg-red-700 hover:bg-red-800 text-white py-1.5 rounded-sm text-[10px] uppercase tracking-wider font-medium text-center transition-colors"
                        title="Recusar doação"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* MONTRA DE ARTIGOS REGULARES DO MARKETPLACE */
            loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-accent-muted gap-3">
                <div
                  style={{ borderTopColor: "var(--accent-gold)" }}
                  className="w-5 h-5 border-2 border-border-warm rounded-full animate-spin"
                ></div>
                <p className="text-[11px] font-light uppercase tracking-wider animate-pulse">
                  A atualizar montra...
                </p>
              </div>
            ) : mostrarAlugueres ? (
              null
            ) : artigos.length === 0 ? (
              <div className="text-center py-20 text-accent-muted bg-[#FBF7F2] rounded-sm border border-dashed border-border-warm max-w-md mx-auto px-4">
                <i className="ti ti-box text-2xl block mb-2 text-border-warm" />
                <h3
                  style={{ fontFamily: "var(--font-playfair)" }}
                  className="text-sm text-panel-dark font-normal"
                >
                  Nenhum artigo encontrado
                </h3>
                <p className="text-xs text-accent-muted mt-1 font-light">
                  Experimenta ajustar os filtros aplicados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {artigos.map((artigo) => (
                  <div
                    key={artigo.id}
                    onClick={() => setArtigoSelecionado(artigo)}
                    className="bg-[#FFFCF8] rounded-sm border border-border-warm overflow-hidden flex flex-col hover:border-accent-muted hover:shadow-xs transition-all duration-200 group cursor-pointer"
                  >
                    <div className="w-full bg-[#FBF7F2] overflow-hidden relative" style={{ aspectRatio: "3/4" }}>
                      {artigo.imagemId ? (
                        <img
                          src={`http://localhost:8080/api/marketplace/imagem/${artigo.imagemId}`}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          alt={artigo.nome}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-accent-muted text-[10px] uppercase tracking-wider font-light gap-1">
                          <i className="ti ti-photo" /> Sem foto
                        </div>
                      )}
                    </div>

                    <div className="px-3 py-3 flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3
                          style={{ fontFamily: "var(--font-playfair)" }}
                          className="text-base text-panel-dark font-normal leading-snug flex-1 min-w-0"
                        >
                          {artigo.nome.length > 27 ? artigo.nome.slice(0, 27) + "…" : artigo.nome}
                        </h3>
                        <span style={{ whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "baseline", gap: "4px" }}>
                          {artigo.isVenda && artigo.precoVenda !== null && (
                            <span style={{ fontFamily: "var(--font-playfair)", fontSize: "16px", color: "var(--panel-dark)", fontWeight: 400 }}>
                              {artigo.precoVenda}€
                            </span>
                          )}
                          {artigo.isVenda && artigo.isAluguer && artigo.precoAluguer !== null && (
                            <span style={{ fontSize: "12px", color: "var(--accent-muted)", fontWeight: 300 }}>/</span>
                          )}
                          {artigo.isAluguer && artigo.precoAluguer !== null && (
                            <span style={{ fontFamily: "var(--font-playfair)", fontSize: "15px", color: "#7A5FA0", fontWeight: 400 }}>
                              {artigo.precoAluguer}€<span style={{ fontSize: "11px", color: "var(--accent-muted)", fontWeight: 300 }}> dia</span>
                            </span>
                          )}
                          {!artigo.isVenda && !artigo.isAluguer && artigo.isDoacao && (
                            <span style={{ fontSize: "14px", color: "#3A6A3A", fontWeight: 400 }}>Grátis</span>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-accent-muted font-light">
                        {[artigo.tamanho, artigo.condicao].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* PAGINAÇÃO (Ocultada se estiver a ver doações pendentes) */}
          {!mostrarPendentes && totalPaginas > 1 && (
            <div className="mt-8 flex justify-center items-center gap-4">
              <button
                disabled={paginaAtual === 0}
                onClick={() => carregarArtigos(paginaAtual - 1)}
                className="px-3 py-1.5 border border-border-warm text-accent-muted bg-[#FFFCF8] rounded-sm text-xs disabled:opacity-30 hover:text-panel-dark transition-colors"
              >
                ←
              </button>
              <span className="text-[11px] text-accent-muted font-light">
                Página {paginaAtual + 1} de {totalPaginas}
              </span>
              <button
                disabled={paginaAtual >= totalPaginas - 1}
                onClick={() => carregarArtigos(paginaAtual + 1)}
                className="px-3 py-1.5 border border-border-warm text-accent-muted bg-[#FFFCF8] rounded-sm text-xs disabled:opacity-30 hover:text-panel-dark transition-colors"
              >
                →
              </button>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CRIAR / EDITAR ANÚNCIO */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-panel-dark/40 flex items-center justify-center z-50 p-4 backdrop-blur-xs"
          onClick={() => setModalAberto(false)}
        >
          <div
            className="bg-[#FBF7F2] rounded-sm border border-border-warm w-full max-w-md p-5 max-h-[88vh] overflow-y-auto shadow-xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-panel-dark" />
            <div className="flex justify-between items-center mb-4 pl-2">
              <h2
                style={{ fontFamily: "var(--font-playfair)" }}
                className="text-lg font-normal text-panel-dark"
              >
                {idSendoEditado ? "Editar anúncio" : "Anunciar novo artigo"}
              </h2>
              <button
                onClick={() => setModalAberto(false)}
                className="text-accent-muted hover:text-panel-dark text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 pl-2">
              <div className="bg-[#FFFCF8] p-3 rounded-sm border border-border-warm">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[9px] font-normal text-accent-muted uppercase tracking-wider">
                    Galeria de Fotos
                  </label>
                  {previews.length > 0 && (
                    <button
                      onClick={() => {
                        setImagens([]);
                        setPreviews([]);
                      }}
                      className="text-[9px] text-accent-muted hover:underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="w-full text-xs text-accent-muted file:mr-2 file:py-1 file:px-3 file:rounded-sm file:border file:border-border-warm file:text-[10px] file:uppercase file:bg-[#FBF7F2] file:text-panel-dark hover:file:bg-[#FFFCF8] cursor-pointer"
                />
                {previews.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {previews.map((src, index) => (
                      <div
                        key={index}
                        className="relative flex-shrink-0 group rounded border border-border-warm overflow-hidden"
                      >
                        <img
                          src={src}
                          alt={`Preview ${index}`}
                          className="w-12 h-12 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removerImagem(index)}
                          className="absolute inset-0 bg-panel-dark/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                        >
                          Apagar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[9px] uppercase font-normal tracking-wider text-accent-muted">
                    Título do Anúncio
                  </label>
                  <span className={`text-[9px] font-light ${form.nome.length >= 50 ? "text-red-400" : "text-accent-muted"}`}>
                    {form.nome.length}/50
                  </span>
                </div>
                <input
                  name="nome"
                  value={form.nome}
                  placeholder="Ex: Sapatilhas de Pontas"
                  onChange={handleChange}
                  maxLength={50}
                  className="w-full bg-[#FFFCF8] border border-border-warm p-2 rounded-sm outline-none focus:border-panel-dark text-panel-dark text-xs transition-all"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="text-[9px] uppercase font-normal tracking-wider text-accent-muted">
                    Descrição
                  </label>
                  <span className={`text-[9px] font-light ${(form.descricao?.length || 0) >= 100 ? "text-red-400" : "text-accent-muted"}`}>
                    {form.descricao?.length || 0}/100
                  </span>
                </div>
                <textarea
                  name="descricao"
                  value={form.descricao}
                  placeholder="Detalhes sobre o estado..."
                  onChange={handleChange}
                  maxLength={100}
                  className="w-full bg-[#FFFCF8] border border-border-warm p-2 rounded-sm outline-none h-20 focus:border-panel-dark text-panel-dark text-xs transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase font-normal tracking-wider text-accent-muted block mb-0.5">
                    Tamanho
                  </label>
                  <input
                    name="tamanho"
                    value={form.tamanho}
                    placeholder="Ex: 37"
                    onChange={handleChange}
                    className="w-full bg-[#FFFCF8] border border-border-warm p-2 rounded-sm outline-none focus:border-panel-dark text-panel-dark text-xs transition-all"
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-normal tracking-wider text-accent-muted block mb-0.5">
                    Cor
                  </label>
                  <input
                    name="cor"
                    value={form.cor}
                    placeholder="Ex: Rosa"
                    onChange={handleChange}
                    className="w-full bg-[#FFFCF8] border border-border-warm p-2 rounded-sm outline-none focus:border-panel-dark text-panel-dark text-xs transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase font-normal tracking-wider text-accent-muted block mb-0.5">
                  Estado do Artigo
                </label>
                <select
                  name="condicao"
                  value={form.condicao}
                  onChange={handleChange}
                  className="w-full bg-[#FFFCF8] border border-border-warm p-2 rounded-sm outline-none focus:border-panel-dark text-panel-dark text-xs transition-all"
                >
                  {CONDICOES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-[#FFFCF8] p-3 rounded-sm border border-border-warm space-y-3">
                <p className="text-[9px] font-normal text-accent-muted uppercase tracking-wider">
                  Modelos de Transação
                </p>
                <div className="flex items-center justify-between border-b border-[#FBF7F2] pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-light text-panel-dark">
                    <input
                      type="checkbox"
                      name="isVenda"
                      checked={form.isVenda}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 accent-panel-dark"
                    />
                    <span>Disponível para Venda</span>
                  </label>
                  {form.isVenda && (
                    <input
                      name="precoVenda"
                      value={form.precoVenda}
                      type="number"
                      placeholder="Preço (€)"
                      onChange={handleChange}
                      className="w-24 bg-[#FFFCF8] border border-border-warm p-1 text-xs text-right outline-none focus:border-panel-dark"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between border-b border-[#FBF7F2] pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-light text-panel-dark">
                    <input
                      type="checkbox"
                      name="isAluguer"
                      checked={form.isAluguer}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 accent-panel-dark"
                    />
                    <span>Disponível para Aluguer</span>
                  </label>
                  {form.isAluguer && (
                    <input
                      name="precoAluguer"
                      value={form.precoAluguer}
                      type="number"
                      placeholder="Por dia (€)"
                      onChange={handleChange}
                      className="w-24 bg-[#FFFCF8] border border-border-warm p-1 text-xs text-right outline-none focus:border-panel-dark"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <label
                    className={`flex items-center gap-2 text-xs font-light text-panel-dark ${form.isVenda || form.isAluguer ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      name="isDoacao"
                      checked={form.isDoacao}
                      onChange={handleChange}
                      disabled={form.isVenda || form.isAluguer}
                      className="w-3.5 h-3.5 accent-panel-dark"
                    />
                    <span>Doação Gratuita</span>
                  </label>
                </div>
              </div>

              {erro && (
                <p className="text-panel-dark text-[11px] bg-red-100 p-2 border border-red-200">
                  {erro}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 border border-border-warm py-2 rounded-sm text-xs transition-all text-accent-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={loadingInserir}
                  className="flex-1 bg-panel-dark hover:bg-panel-dark/95 text-accent-gold py-2 rounded-sm text-xs tracking-wide uppercase transition-all disabled:opacity-50"
                >
                  {loadingInserir
                    ? "A processar..."
                    : idSendoEditado
                      ? "Guardar"
                      : "Publicar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHE DO ARTIGO */}
      {artigoSelecionado && (
        <div
          className="fixed inset-0 bg-panel-dark/40 flex items-center justify-center z-50 p-4 backdrop-blur-xs"
          onClick={() => {
            setArtigoSelecionado(null);
            setDataFimAluguer("");
          }}
        >
          <div
            className="bg-[#FBF7F2] rounded-sm border border-border-warm w-full max-w-3xl p-5 overflow-y-auto max-h-[90vh] shadow-xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-panel-dark" />
            <div className="flex justify-between items-start mb-4 pl-3">
              <div>
                <h2
                  style={{ fontFamily: "var(--font-playfair)" }}
                  className="text-xl font-normal text-panel-dark"
                >
                  {artigoSelecionado.nome.length > 50 ? artigoSelecionado.nome.slice(0, 50) + "…" : artigoSelecionado.nome}
                </h2>
              </div>
              <button
                onClick={() => {
                  setArtigoSelecionado(null);
                  setDataFimAluguer("");
                }}
                className="text-accent-muted hover:text-panel-dark text-xl"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-3">
              <div>
                <GaleriaImagens ids={artigoSelecionado.imagemIds ?? []} />
              </div>
              <div className="flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="bg-[#FFFCF8] p-3 border border-border-warm rounded-sm">
                    <h3 className="text-[9px] font-normal text-accent-muted uppercase tracking-wider mb-1">
                      Especificações
                    </h3>
                    <p className="text-panel-dark text-xs leading-relaxed mb-3 font-light break-words whitespace-pre-line">
                      {(() => {
                        const desc = artigoSelecionado.descricao || "Sem descrição.";
                        return desc.length > 100 ? desc.slice(0, 100) + "…" : desc;
                      })()}
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs border-t border-[#FBF7F2] pt-2 text-accent-muted font-light">
                      <div>
                        Tamanho:{" "}
                        <strong className="text-panel-dark font-normal">
                          {artigoSelecionado.tamanho || "N/D"}
                        </strong>
                      </div>
                      <div>
                        Cor:{" "}
                        <strong className="text-panel-dark font-normal">
                          {artigoSelecionado.cor || "N/D"}
                        </strong>
                      </div>
                      <div>
                        Conservação:{" "}
                        <strong className="text-panel-dark font-normal">
                          {artigoSelecionado.condicao}
                        </strong>
                      </div>
                      <div>
                        Anunciante:{" "}
                        <strong className="text-panel-dark font-normal">
                          {artigoSelecionado.donoNome}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#FFFCF8] p-3 border border-border-warm rounded-sm space-y-2">
                    <h3 className="text-[9px] font-normal text-accent-muted uppercase tracking-wider">
                      Cedência
                    </h3>
                    {artigoSelecionado.isVenda && (
                      <p className="text-sm text-panel-dark font-light flex justify-between items-center bg-[#FBF7F2]/60 p-2 rounded-sm border border-border-warm/30">
                        <span>Preço de Venda:</span>{" "}
                        <span className="font-normal text-base text-panel-dark">
                          {artigoSelecionado.precoVenda}€
                        </span>
                      </p>
                    )}
                    
                    {artigoSelecionado.isAluguer && (
                      <div className="bg-[#FBF7F2]/60 p-2 rounded-sm border border-border-warm/30 space-y-2">
                        <p className="text-sm text-panel-dark font-light flex justify-between items-center">
                          <span>Taxa de Aluguer:</span>{" "}
                          <span className="font-normal text-base text-panel-dark">
                            {artigoSelecionado.precoAluguer}€
                            <span className="text-xs font-light text-accent-muted">
                              /dia
                            </span>
                          </span>
                        </p>
                        
                        {(!usuarioLogado?.id || !artigoSelecionado?.donoId || String(usuarioLogado.id) !== String(artigoSelecionado.donoId)) && (
                          <div className="pt-2 border-t border-border-warm/40">
                            <label className="text-[9px] font-normal text-accent-muted uppercase tracking-wider block mb-0.5">
                              Previsão de Devolução
                            </label>
                            <input
                              type="date"
                              min={new Date().toISOString().split("T")[0]}
                              value={dataFimAluguer}
                              onChange={(e) => setDataFimAluguer(e.target.value)}
                              className="w-full bg-[#FFFCF8] border border-border-warm rounded-sm px-2 py-1 text-xs text-panel-dark outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {artigoSelecionado.isDoacao && (
                      <p className="text-xs text-panel-dark bg-[#FBF7F2] p-2 rounded-sm border border-border-warm/40 text-center font-light">
                        Disponível para Doação Gratuita
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border-warm/40">
                  {usuarioLogado?.id &&
                  artigoSelecionado?.donoId &&
                  String(usuarioLogado.id) === String(artigoSelecionado.donoId) ? (
                    <div className="space-y-2">
                      <p className="text-accent-muted text-[9px] text-center uppercase tracking-wider font-light">
                        Gestão do teu artigo
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => prepararEdicao(artigoSelecionado)}
                          className="flex-1 border border-border-warm py-2 rounded-sm text-xs text-panel-dark hover:bg-neutral-50 transition-all"
                        >
                          Editar Anúncio
                        </button>
                        <button
                          onClick={() => handleArquivar(artigoSelecionado.id)}
                          className="flex-1 border border-red-200 py-2 rounded-sm text-xs text-red-500 hover:bg-red-50 transition-all"
                        >
                          Remover Artigo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleContactar}
                        className="w-full border border-border-warm py-2 rounded-sm text-xs text-panel-dark flex items-center justify-center gap-1.5 font-light"
                      >
                        <i className="ti ti-mail" /> Contactar Anunciante
                      </button>
                      <div className="space-y-1.5 pt-1">
                        {artigoSelecionado.isVenda && (
                          <button
                            onClick={() => handleComprarOuAlugar("VENDA")}
                            disabled={loadingInserir}
                            className="w-full bg-panel-dark text-accent-gold py-2 px-4 rounded-sm text-xs uppercase font-normal flex justify-between items-center transition-all disabled:opacity-50"
                          >
                            <span>Comprar agora</span>
                            <span>{artigoSelecionado.precoVenda}€</span>
                          </button>
                        )}
                        {artigoSelecionado.isAluguer && (
                          <button
                            onClick={() => handleComprarOuAlugar("ALUGUER")}
                            disabled={loadingInserir}
                            className="w-full bg-panel-dark text-accent-gold py-2 px-4 rounded-sm text-xs uppercase font-normal flex justify-between items-center transition-all disabled:opacity-50"
                          >
                            <span>Alugar equipamento</span>
                            <span>{artigoSelecionado.precoAluguer}€/dia</span>
                          </button>
                        )}
                        {artigoSelecionado.isDoacao && (
                          <button
                            onClick={() => handleComprarOuAlugar("DOACAO")}
                            disabled={loadingInserir}
                            className="w-full bg-panel-dark text-accent-gold py-2 rounded-sm text-xs uppercase font-normal transition-all disabled:opacity-50"
                          >
                            Solicitar Doação Gratuita
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}