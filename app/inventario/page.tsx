'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface InventarioItem {
    id: string;
    nomeArtigo: string;
    descricao: string;
    tamanho: string;
    cor: string;
    condicao: string;
    estadoId: number;
    estadoNome: string;
    disponivel: boolean;
    localizacao: string;
    notas: string;
    criadoEm: string;
    imagemId: string | null;
    imagemIds: string[];
}

interface PaginaResponse {
    content: InventarioItem[];
    totalPages: number;
    number: number;
}

const CONDICOES = ['Novo', 'Como novo', 'Bom estado', 'Usado'];

export default function InventarioPage() {
    const [itens, setItens] = useState<InventarioItem[]>([]);
    const [paginaAtual, setPaginaAtual] = useState(0);
    const [totalPaginas, setTotalPaginas] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pesquisa, setPesquisa] = useState('');

    const [itemSelecionado, setItemSelecionado] = useState<InventarioItem | null>(null);
    const [modalEditarAberto, setModalEditarAberto] = useState(false);
    const [loadingSalvar, setLoadingSalvar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    //Adicionar
    const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
    const [loadingAdicionar, setLoadingAdicionar] = useState(false);

    const [form, setForm] = useState({
        nome: '',
        descricao: '',
        disponivel: true,
        localizacao: '',
        notas: '',
    });

    const carregarItens = async (pagina: number) => {
        setLoading(true);
        try {
        const params: any = { page: pagina, size: 20, sortBy: 'criadoEm', direction: 'desc' };
        if (pesquisa) params.nome = pesquisa;
        const response = await api.get<PaginaResponse>('/inventario', { params });
        setItens(response.data.content);
        setTotalPaginas(response.data.totalPages);
        setPaginaAtual(response.data.number);
        } catch (error) {
        console.error('Erro ao carregar inventário:', error);
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        carregarItens(0);
    }, [pesquisa]);

    const abrirEditar = (item: InventarioItem) => {
        setForm({
            nome: item.nomeArtigo,
            descricao: item.descricao || '',
            disponivel: item.disponivel,
            localizacao: item.localizacao || '',
            notas: item.notas || '',
        });
        setItemSelecionado(item);
        setModalEditarAberto(true);
        setErro(null);
        };

    const handleSalvar = async () => {
        if (!itemSelecionado) return;
        if (!form.nome.trim()) { setErro('O nome não pode estar vazio.'); return; }
        setLoadingSalvar(true);
        setErro(null);
        try {
            await api.put(`/inventario/${itemSelecionado.id}`, form);
            setModalEditarAberto(false);
            setItemSelecionado(null);
            carregarItens(paginaAtual);
        } catch {
        setErro('Erro ao guardar. Tente novamente.');
        } finally {
        setLoadingSalvar(false);
        }
    };

    const handleRemover = async (id: string) => {
    if (!confirm('Tem a certeza que deseja remover este item do inventário?')) return;
        try {
        await api.delete(`/inventario/${id}`);
        setItemSelecionado(null);
        carregarItens(paginaAtual);
        } catch {
        alert('Erro ao remover item.');
        }
    };

const [formAdicionar, setFormAdicionar] = useState({
    nome: '', 
    descricao: '', 
    donoUtilizadorId: 1, // ID do Admin/Escola
    estadoId: 9,         // Default Inventário
    disponivel: true, 
    localizacao: '', 
    notas: '',
});

const handleAdicionar = async () => {
    if (!formAdicionar.nome.trim()) { setErro('O nome é obrigatório.'); return; }
    
    setLoadingAdicionar(true); 
    setErro(null);
    
    try {
        await api.post('/inventario', formAdicionar);
        setModalAdicionarAberto(false);
        // Limpar form após sucesso
        setFormAdicionar({ 
            nome: '', descricao: '', donoUtilizadorId: 1, 
            estadoId: 9, disponivel: true, localizacao: '', notas: '' 
        });
        carregarItens(0);
    } catch {
        setErro('Erro ao adicionar artigo. Tente novamente.');
    } finally {
        setLoadingAdicionar(false);
    }
};

return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
    {/* HEADER */}
    <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-400">Inventário da Escola</h1>
        <p className="text-gray-500 text-sm">Gestão do stock interno</p>
        <button
            onClick={() => setModalAdicionarAberto(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2">
            + Adicionar Artigo
        </button>
    </div>

    {/* BARRA DE PESQUISA */}
    <div className="relative mb-6">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
        <input
            type="text"
            placeholder="Pesquisar por nome do artigo..."
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white outline-none focus:border-blue-500 transition"
        />
    </div>

    {/* TABELA */}
    {loading ? (
        <div className="text-center py-20 animate-pulse text-gray-500">A carregar inventário...</div> 
    ) : itens.length === 0 ? (
        <div className="text-center py-20 text-gray-500 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
            Nenhum item encontrado.
        </div>
    ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {/* HEADER DA TABELA */}
            <div className="grid grid-cols-3 px-6 py-3 bg-gray-900/60 border-b border-gray-700">
                <span className="text-[11px] font-bold uppercase text-gray-500">Nome do Artigo</span>
                <span className="text-[11px] font-bold uppercase text-gray-500">Localização</span>
                <span className="text-[11px] font-bold uppercase text-gray-500">Disponível</span>
            </div>

            {/* LINHAS */}
            {itens.map((item, idx) => (
                <div
                    key={item.id}
                    onClick={() => setItemSelecionado(item)}
                    className={`grid grid-cols-3 px-6 py-4 cursor-pointer hover:bg-gray-700/50 transition ${
                    idx !== itens.length - 1 ? 'border-b border-gray-700/50' : ''
                }`}
                >
                <div>
                    <p className="font-medium text-gray-100">{item.nomeArtigo}</p>
                    {(item.cor || item.tamanho) && (
                        <p className="text-xs text-gray-500">
                        {item.cor} {item.cor && item.tamanho ? '•' : ''} {item.tamanho}
                        </p>
                    )}
                </div>
                <div className="flex items-center">
                    <span className="text-sm text-gray-400">{item.localizacao || '—'}</span>
                </div>
                <div className="flex items-center">
                    {item.disponivel ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                            Disponível
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
                            Indisponível
                        </span>
                    )}
                </div>
                </div>
            ))}
        </div>
    )}

    {/* PAGINAÇÃO */}
    {totalPaginas > 1 && (
        <div className="mt-6 flex justify-center gap-2">
            <button
                disabled={paginaAtual === 0}
                onClick={() => carregarItens(paginaAtual - 1)}
                className="px-4 py-2 bg-gray-800 rounded disabled:opacity-30"
            >
                Anterior
            </button>
        <span className="px-4 py-2 text-gray-400">Página {paginaAtual + 1} de {totalPaginas}</span>
            <button
                disabled={paginaAtual >= totalPaginas - 1}
                onClick={() => carregarItens(paginaAtual + 1)}
                className="px-4 py-2 bg-gray-800 rounded disabled:opacity-30">
                Próxima
            </button>
        </div>
    )}

    {/* MODAL DETALHES */}
    {itemSelecionado && !modalEditarAberto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setItemSelecionado(null)}>
            <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-bold text-blue-400">{itemSelecionado.nomeArtigo}</h2>
                    <button onClick={() => setItemSelecionado(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="space-y-4">
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Localização</span>
                            <span>{itemSelecionado.localizacao || '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Disponível</span>
                            {itemSelecionado.disponivel ? (
                                <span className="text-green-400 font-bold">Sim</span>
                            ) : (
                                <span className="text-red-400 font-bold">Não</span>
                            )}
                        </div>
                    </div>

                    {itemSelecionado.descricao && (
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Descrição</p>
                            <p className="text-sm text-gray-300">{itemSelecionado.descricao}</p>
                        </div>
                    )}

                    {itemSelecionado.notas && (
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Notas</p>
                            <p className="text-sm text-gray-300">{itemSelecionado.notas}</p>
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => abrirEditar(itemSelecionado)}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 py-2 rounded-lg font-bold text-sm transition"
                            >
                            Editar
                        </button>
                        <button
                            onClick={() => handleRemover(itemSelecionado.id)}
                            className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-bold text-sm transition"
                            >
                            Remover
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* MODAL EDITAR */}
    {modalEditarAberto && itemSelecionado && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setModalEditarAberto(false)}>
        <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-bold text-blue-400">Editar Item</h2>
                <button onClick={() => setModalEditarAberto(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome</label>
                    <input
                    value={form.nome}
                    onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))}
                    className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Descrição</label>
                    <textarea
                        value={form.descricao}
                        onChange={(e) => setForm(p => ({ ...p, descricao: e.target.value }))}
                        placeholder="Descrição detalhada do item..."
                        className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-20"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Localização</label>
                    <input
                        value={form.localizacao}
                        onChange={(e) => setForm(p => ({ ...p, localizacao: e.target.value }))}
                        placeholder="Ex: Armazém A, Prateleira 2"
                        className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Notas</label>
                    <textarea
                        value={form.notas}
                        onChange={(e) => setForm(p => ({ ...p, notas: e.target.value }))}
                        placeholder="Observações sobre o artigo..."
                        className="w-full bg-gray-700 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-24"
                    />
                </div>

                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                    <span className="text-sm font-medium">Disponível</span>
                    <button
                        onClick={() => setForm(p => ({ ...p, disponivel: !p.disponivel }))}
                        className={`relative w-12 h-6 rounded-full transition-colors ${form.disponivel ? 'bg-green-500' : 'bg-red-500'}`}
                    >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.disponivel ? 'left-7' : 'left-1'}`}></span>
                    </button>
                </div>

                {erro && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-2 rounded border border-red-500/20">{erro}</p>}

                <div className="flex gap-3 pt-2">
                    <button onClick={() => setModalEditarAberto(false)} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold hover:bg-gray-600 transition">
                        Cancelar
                    </button>
                    <button onClick={handleSalvar} disabled={loadingSalvar} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition disabled:opacity-50">
                        {loadingSalvar ? 'A guardar...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    </div>
    )}

    {/* MODAL ADICIONAR */}
    {modalAdicionarAberto && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setModalAdicionarAberto(false)}>
        <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-blue-400">Novo Artigo no Inventário</h2>
            <button onClick={() => setModalAdicionarAberto(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="space-y-4">
            <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome do Artigo</label>
            <input 
                value={formAdicionar.nome} 
                onChange={e => setFormAdicionar(p => ({...p, nome: e.target.value}))}
                placeholder="Ex: Projetor Epson X24"
                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white outline-none focus:border-blue-500" 
            />
            </div>

            <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Descrição / Especificações</label>
            <textarea 
                value={formAdicionar.descricao} 
                onChange={e => setFormAdicionar(p => ({...p, descricao: e.target.value}))}
                placeholder="Detalhes técnicos ou descrição do item..."
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white outline-none focus:border-blue-500" 
            />
            </div>

            <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Localização</label>
                <input 
                value={formAdicionar.localizacao} 
                onChange={e => setFormAdicionar(p => ({...p, localizacao: e.target.value}))}
                placeholder="Ex: Sala 202"
                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white outline-none focus:border-blue-500" 
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Estado Base</label>
                <select 
                disabled
                className="w-full bg-gray-700 border border-gray-700 p-3 rounded-lg text-gray-400 outline-none appearance-none"
                >
                    <option>Inventário (Fixo)</option>
                </select>
            </div>
            </div>

            <div>
            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Notas Internas</label>
            <textarea 
                value={formAdicionar.notas} 
                onChange={e => setFormAdicionar(p => ({...p, notas: e.target.value}))}
                placeholder="Ex: Comprado em 2023, garantia ativa." 
                rows={2}
                className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white outline-none focus:border-blue-500" 
            />
            </div>

            <div className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
            <span className="text-sm font-medium">Disponível para uso</span>
            <button onClick={() => setFormAdicionar(p => ({...p, disponivel: !p.disponivel}))}
                className={`relative w-12 h-6 rounded-full transition-colors ${formAdicionar.disponivel ? 'bg-green-500' : 'bg-red-500'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formAdicionar.disponivel ? 'left-7' : 'left-1'}`}></span>
            </button>
            </div>
        </div>

        {erro && <p className="text-red-500 text-xs font-bold bg-red-500/10 p-2 rounded border border-red-500/20 mt-3">{erro}</p>}

        <div className="flex gap-3 mt-6">
            <button onClick={() => setModalAdicionarAberto(false)} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold hover:bg-gray-600 transition">Cancelar</button>
            <button onClick={handleAdicionar} disabled={loadingAdicionar} className="flex-1 bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition disabled:opacity-50">
            {loadingAdicionar ? 'A adicionar...' : 'Adicionar Artigo'}
            </button>
        </div>
        </div>
    </div>
    )}
    </main>
);
}