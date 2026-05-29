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

export default function InventarioPage() {
    const [itens, setItens] = useState<InventarioItem[]>([]);
    const [paginaAtual, setPaginaAtual] = useState(0);
    const [totalPaginas, setTotalPaginas] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Filtros de Pesquisa
    const [pesquisa, setPesquisa] = useState('');
    const [pesquisaLocalizacao, setPesquisaLocalizacao] = useState('');
    const [filtroDisponibilidade, setFiltroDisponibilidade] = useState<string>('todos');

    const [itemSelecionado, setItemSelecionado] = useState<InventarioItem | null>(null);
    const [modalEditarAberto, setModalEditarAberto] = useState(false);
    const [loadingSalvar, setLoadingSalvar] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const [modalAdicionarAberto, setModalAdicionarAberto] = useState(false);
    const [loadingAdicionar, setLoadingAdicionar] = useState(false);

    const [form, setForm] = useState({
        nome: '',
        descricao: '',
        disponivel: true,
        localizacao: '',
        notas: '',
    });

    const [formAdicionar, setFormAdicionar] = useState({
        nome: '', 
        descricao: '', 
        donoUtilizadorId: 1, 
        estadoId: 9,         
        disponivel: true, 
        localizacao: '', 
        notas: '',
    });

    // Função de carregamento adaptada com paginação dinâmica e múltiplos filtros
    const carregarItens = async (pagina: number) => {
        setLoading(true);
        try {
            // O teu backend aceita page, size, sortBy, direction e parâmetros de filtro opcionais
            const params: any = { 
                page: pagina, 
                size: 12, // Reduzido de 20 para 12 para casar esteticamente com o layout do Marketplace
                sortBy: 'criadoEm', 
                direction: 'desc' 
            };
            
            if (pesquisa.trim()) params.nome = pesquisa.trim();
            
            // Adiciona filtro local se a API não possuir @RequestParam nativo de localização,
            // ou passa diretamente para o backend caso tenhas customizado o repositório
            if (pesquisaLocalizacao.trim()) params.localizacao = pesquisaLocalizacao.trim();

            const response = await api.get<PaginaResponse>('/inventario', { params });
            
            let dadosFiltrados = response.data.content || [];

            // Filtragem complementar no front-end para a Disponibilidade e Localização (garante funcionamento imediato)
            if (filtroDisponibilidade !== 'todos') {
                const querDisponivel = filtroDisponibilidade === 'disponivel';
                dadosFiltrados = dadosFiltrados.filter(item => item.disponivel === querDisponivel);
            }
            if (pesquisaLocalizacao.trim()) {
                dadosFiltrados = dadosFiltrados.filter(item => 
                    item.localizacao?.toLowerCase().includes(pesquisaLocalizacao.toLowerCase())
                );
            }

            setItens(dadosFiltrados);
            setTotalPaginas(response.data.totalPages);
            setPaginaAtual(response.data.number);
        } catch (error) {
            console.error('Erro ao carregar inventário:', error);
        } finally {
            setLoading(false);
        }
    };

    // Debounce/Gatilho de pesquisa para não sobrecarregar o backend ao digitar
    useEffect(() => {
        const handler = setTimeout(() => {
            carregarItens(0);
        }, 300);
        return () => clearTimeout(handler);
    }, [pesquisa, pesquisaLocalizacao, filtroDisponibilidade]);

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
            setErro('Erro ao guardar os dados. Tente novamente.');
        } finally {
            setLoadingSalvar(false);
        }
    };

    const handleRemover = async (id: string) => {
        if (!confirm('Tem a certeza que deseja remover este item do inventário escolar?')) return;
        try {
            await api.delete(`/inventario/${id}`);
            setItemSelecionado(null);
            carregarItens(paginaAtual);
        } catch {
            alert('Erro ao remover item do inventário.');
        }
    };

    const handleAdicionar = async () => {
        if (!formAdicionar.nome.trim()) { setErro('O nome do artigo é obrigatório.'); return; }
        setLoadingAdicionar(true); 
        setErro(null);
        try {
            await api.post('/inventario', formAdicionar);
            setModalAdicionarAberto(false);
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
        <div style={{ paddingBottom: '40px' }}>
            {/* INTRODUÇÃO / HEADER */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <p style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>
                        Área de Gestão Interna
                    </p>
                    <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', color: 'var(--panel-dark)', fontWeight: 400, margin: 0 }}>
                        Inventário Escolar
                    </h1>
                </div>

                {/* BOTÃO ADICIONAR: Ajustado para tom mais visível e elegante (Coesivo com o Marketplace) */}
                <button
                    onClick={() => { setErro(null); setModalAdicionarAberto(true); }}
                    style={{
                        background: 'var(--panel-dark)',
                        border: '1px solid var(--panel-dark)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        padding: '10px 22px',
                        fontSize: '11px',
                        color: 'var(--accent-gold)',
                        letterSpacing: '.8px',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(44, 42, 41, 0.9)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--panel-dark)'; }}
                >
                    + Adicionar Artigo Novo
                </button>
            </div>

            {/* SEPARADOR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                    Artigos e Equipamentos
                </span>
                <div style={{ flex: 1, borderBottom: '2px solid var(--border-warm)', opacity: 0.5 }} />
            </div>

            {/* BARRA DE PESQUISA & SISTEMA DE FILTRAGEM AVANÇADO (Estilo Grid do Marketplace) */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '2fr 1fr 1fr', 
                gap: '12px', 
                marginBottom: '24px', 
                background: '#FBF7F2', 
                padding: '16px', 
                border: '1px solid var(--border-warm)', 
                borderRadius: '6px' 
            }}>
                <div>
                    <label style={{ fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, color: 'var(--accent-muted)', display: 'block', marginBottom: '6px'}}>
                        Nome do Artigo
                    </label>
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou palavra-chave..."
                        value={pesquisa}
                        onChange={(e) => setPesquisa(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            background: '#FFF',
                            border: '1px solid var(--border-warm)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: 'var(--panel-dark)',
                            outline: 'none',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, color: 'var(--accent-muted)', display: 'block', marginBottom: '6px'}}>
                        Localização / Sala
                    </label>
                    <input
                        type="text"
                        placeholder="Ex: Sala 202, Bloco A..."
                        value={pesquisaLocalizacao}
                        onChange={(e) => setPesquisaLocalizacao(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            background: '#FFF',
                            border: '1px solid var(--border-warm)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: 'var(--panel-dark)',
                            outline: 'none',
                            fontFamily: 'inherit',
                        }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, color: 'var(--accent-muted)', display: 'block', marginBottom: '6px'}}>
                        Estado de Disponibilidade
                    </label>
                    <select
                        value={filtroDisponibilidade}
                        onChange={(e) => setFiltroDisponibilidade(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '9px 12px',
                            background: '#FFF',
                            border: '1px solid var(--border-warm)',
                            borderRadius: '4px',
                            fontSize: '13px',
                            color: 'var(--panel-dark)',
                            outline: 'none',
                            fontFamily: 'inherit',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="todos">Todos os artigos</option>
                        <option value="disponivel">Disponível</option>
                        <option value="indisponivel">Indisponível</option>
                    </select>
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL (TABELA DINÂMICA OU CARREGAMENTO) */}
            {loading ? (
                <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderRadius: '8px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-warm)', borderTopColor: 'var(--accent-gold)', animation: 'spin 0.8s linear infinite' }} />
                </div>
            ) : itens.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--border-warm)', borderRadius: '8px', background: 'rgba(160,133,96,0.03)' }}>
                    <p style={{ fontSize: '14px', color: 'var(--panel-dark)', fontWeight: 400, fontFamily: 'var(--font-playfair)', marginBottom: '4px' }}>
                        Nenhum item localizado
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300, maxWidth: '320px' }}>
                        Não existem registos de equipamentos ou artigos correspondentes aos critérios de pesquisa aplicados.
                    </p>
                </div>
            ) : (
                <div style={{ background: '#FFFCF8', border: '1px solid var(--border-warm)', borderRadius: '8px', position: 'relative', overflow: 'hidden', padding: '12px' }}>
                    
                    {/* ENCABEÇADO DE COLUNAS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 14px', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-warm)' }}>
                        <span>Nome do Artigo</span>
                        <span>Localização</span>
                        <span style={{ textAlign: 'right' }}>Disponibilidade</span>
                    </div>

                    {/* LISTAGEM DOS ITENS */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {itens.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => setItemSelecionado(item)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1fr 1fr',
                                    padding: '14px',
                                    alignItems: 'center',
                                    borderBottom: '1px solid rgba(180,140,80,0.12)',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s ease',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(160,133,96,0.03)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div>
                                    <p style={{ fontSize: '13px', color: 'var(--panel-dark)', fontWeight: 500, margin: 0 }}>
                                        {item.nomeArtigo}
                                    </p>
                                    {(item.cor || item.tamanho) && (
                                        <p style={{ fontSize: '11px', color: 'var(--accent-muted)', fontWeight: 300, marginTop: '2px', margin: 0 }}>
                                            {item.cor} {item.cor && item.tamanho ? '·' : ''} {item.tamanho}
                                        </p>
                                    )}
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--panel-dark)', fontWeight: 300 }}>
                                    {item.localizacao || '—'}
                                </span>
                                <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: 400 }}>
                                    {item.disponivel ? (
                                        <span style={{ color: '#2E7D32', background: 'rgba(46,125,50,0.08)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>Disponível</span>
                                    ) : (
                                        <span style={{ color: '#C62828', background: 'rgba(198,40,40,0.08)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>Indisponível</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CONTROLO DE PAGINAÇÃO (Pageable Reativo integrado) */}
            {totalPaginas > 1 && (
                <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--border-warm)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--accent-muted)', fontWeight: 300 }}>
                        Página {paginaAtual + 1} de {totalPaginas}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={paginaAtual === 0}
                            onClick={() => carregarItens(paginaAtual - 1)}
                            style={{ background: 'none', border: 'none', cursor: paginaAtual === 0 ? 'default' : 'pointer', fontSize: '12px', color: 'var(--accent-muted)', opacity: paginaAtual === 0 ? 0.3 : 1 }}
                        >
                            ← Anterior
                        </button>
                        <button
                            disabled={paginaAtual >= totalPaginas - 1}
                            onClick={() => carregarItens(paginaAtual + 1)}
                            style={{ background: 'none', border: 'none', cursor: paginaAtual >= totalPaginas - 1 ? 'default' : 'pointer', fontSize: '12px', color: 'var(--accent-muted)', opacity: paginaAtual >= totalPaginas - 1 ? 0.3 : 1 }}
                        >
                            Próxima →
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DETALHES COMPLETO */}
            {itemSelecionado && !modalEditarAberto && (
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setItemSelecionado(null)}>
                    <div style={{ background: '#FFFBF7', border: '1px solid var(--border-warm)', borderRadius: '8px', width: '90%', maxWidth: '440px', padding: '24px', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
                        
                        {/* Linha Lateral Esquerda de Efeito Estético */}
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: 'var(--panel-dark)', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }} />

                        <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>Consulta de Stock</p>
                        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '16px' }}>{itemSelecionado.nomeArtigo}</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-warm)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--accent-muted)' }}>Localização:</span>
                                <span style={{ color: 'var(--panel-dark)', fontWeight: 500 }}>{itemSelecionado.localizacao || '—'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-warm)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--accent-muted)' }}>Disponibilidade:</span>
                                <span style={{ fontWeight: 500, color: itemSelecionado.disponivel ? '#2E7D32' : '#C62828' }}>{itemSelecionado.disponivel ? 'Disponível para uso' : 'Indisponível'}</span>
                            </div>
                            {itemSelecionado.descricao && (
                                <div style={{ fontSize: '13px', borderBottom: '1px solid var(--border-warm)', paddingBottom: '8px' }}>
                                    <span style={{ color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Descrição Física:</span>
                                    <span style={{ color: 'var(--panel-dark)', lineHeight: 1.4 }}>{itemSelecionado.descricao}</span>
                                </div>
                            )}
                            {itemSelecionado.notas && (
                                <div style={{ fontSize: '12px', background: 'rgba(160,133,96,0.04)', padding: '10px', borderRadius: '4px', borderLeft: '3px solid var(--accent-gold)' }}>
                                    <span style={{ color: 'var(--panel-dark)', display: 'block', fontWeight: 500, marginBottom: '2px' }}>Notas de Coordenação:</span>
                                    <span style={{ color: 'var(--accent-muted)' }}>{itemSelecionado.notas}</span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => abrirEditar(itemSelecionado)} style={{ flex: 1, padding: '10px', background: 'var(--panel-dark)', border: 'none', borderRadius: '4px', color: '#FFF', fontSize: '12px', cursor: 'pointer', fontWeight: 400 }}>Editar Item</button>
                            <button onClick={() => handleRemover(itemSelecionado.id)} style={{ padding: '10px 14px', background: 'transparent', border: '1px solid #C62828', borderRadius: '4px', color: '#C62828', fontSize: '12px', cursor: 'pointer' }}>Remover</button>
                            <button onClick={() => setItemSelecionado(null)} style={{ padding: '10px 14px', background: 'transparent', border: '1px solid var(--border-warm)', borderRadius: '4px', color: 'var(--accent-muted)', fontSize: '12px', cursor: 'pointer' }}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDITAR ARTIGO (Atualizado com Visual Lateral de 4px & Botão Customizado) */}
            {modalEditarAberto && itemSelecionado && (
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setModalEditarAberto(false)}>
                    <div style={{ background: '#FFFBF7', border: '1px solid var(--border-warm)', borderRadius: '8px', width: '90%', maxWidth: '440px', padding: '24px', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
                        
                        {/* MELHORIA SOLICITADA: Barra estética de 4px na lateral esquerda para looks */}
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: 'var(--panel-dark)', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }} />
                        
                        <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px', paddingLeft: '6px' }}>Modificação</p>
                        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '18px', paddingLeft: '6px' }}>Editar Artigo</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px', paddingLeft: '6px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Nome do Artigo</label>
                                <input type="text" value={form.nome} onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Descrição Física</label>
                                <textarea value={form.descricao} onChange={(e) => setForm(p => ({ ...p, descricao: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none', height: '60px', resize: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Localização em Stock</label>
                                <input type="text" value={form.localizacao} onChange={(e) => setForm(p => ({ ...p, localizacao: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Notas Administrativas</label>
                                <textarea value={form.notas} onChange={(e) => setForm(p => ({ ...p, notas: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none', height: '60px', resize: 'none' }} />
                            </div>
                            
                            {/* MELHORIA SOLICITADA: Botão de alternância Sim/Não muito mais bonito e estilizado */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 6px 0', borderTop: '1px solid var(--border-warm)' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--panel-dark)' }}>Disponível para atribuição imediata?</span>
                                <button
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, disponivel: !p.disponivel }))}
                                    style={{
                                        background: form.disponivel ? '#E8F5E9' : '#FFEBEE',
                                        border: form.disponivel ? '1px solid #2E7D32' : '1px solid #C62828',
                                        borderRadius: '20px',
                                        color: form.disponivel ? '#2E7D32' : '#C62828',
                                        padding: '6px 16px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.3px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                                    }}
                                >
                                    <span style={{ 
                                        display: 'inline-block', 
                                        width: '6px', 
                                        height: '6px', 
                                        borderRadius: '50%', 
                                        backgroundColor: form.disponivel ? '#2E7D32' : '#C62828' 
                                    }} />
                                    {form.disponivel ? 'SIM' : 'NÃO'}
                                </button>
                            </div>
                        </div>

                        {erro && <p style={{ color: '#C62828', fontSize: '12px', margin: '0 0 14px 0', paddingLeft: '6px' }}>{erro}</p>}

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                            <button onClick={() => setModalEditarAberto(false)} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border-warm)', borderRadius: '4px', color: 'var(--accent-muted)', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleSalvar} disabled={loadingSalvar} style={{ padding: '9px 20px', background: 'var(--panel-dark)', border: 'none', borderRadius: '4px', color: '#FFF', fontSize: '12px', cursor: 'pointer', opacity: loadingSalvar ? 0.6 : 1 }}>
                                {loadingSalvar ? 'A gravar...' : 'Gravar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ADICIONAR NOVO ITEM */}
            {modalAdicionarAberto && (
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setModalAdicionarAberto(false)}>
                    <div style={{ background: '#FFFBF7', border: '1px solid var(--border-warm)', borderRadius: '8px', width: '90%', maxWidth: '460px', padding: '24px', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
                        
                        {/* Visual Lateral para Coesão dos Modais */}
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', backgroundColor: 'var(--panel-dark)', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }} />

                        <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px', paddingLeft: '6px' }}>Inclusão de Item</p>
                        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '18px', paddingLeft: '6px' }}>Novo Artigo de Inventário</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px', paddingLeft: '6px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Nome do Equipamento / Artigo</label>
                                <input type="text" placeholder="Ex: Projetor Epson X24" value={formAdicionar.nome} onChange={e => setFormAdicionar(p => ({...p, nome: e.target.value}))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Descrição Físico-Técnica</label>
                                <textarea placeholder="Detalhes, marcas ou numeração de série..." value={formAdicionar.descricao} onChange={e => setFormAdicionar(p => ({...p, descricao: e.target.value}))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none', height: '50px', resize: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Localização de Destino</label>
                                <input type="text" placeholder="Ex: Sala de Multimédia 202" value={formAdicionar.localizacao} onChange={e => setFormAdicionar(p => ({...p, localizacao: e.target.value}))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: 'var(--accent-muted)', display: 'block', marginBottom: '4px' }}>Notas Internas de Stock</label>
                                <textarea placeholder="Observações adicionais relevantes..." value={formAdicionar.notas} onChange={e => setFormAdicionar(p => ({...p, notas: e.target.value}))} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: '4px', fontSize: '13px', color: 'var(--panel-dark)', outline: 'none', height: '50px', resize: 'none' }} />
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 6px 0', borderTop: '1px solid var(--border-warm)' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--panel-dark)' }}>Disponível Imediatamente?</span>
                                <button
                                    type="button"
                                    onClick={() => setFormAdicionar(p => ({ ...p, disponivel: !p.disponivel }))}
                                    style={{
                                        background: formAdicionar.disponivel ? '#E8F5E9' : '#FFEBEE',
                                        border: formAdicionar.disponivel ? '1px solid #2E7D32' : '1px solid #C62828',
                                        borderRadius: '20px',
                                        color: formAdicionar.disponivel ? '#2E7D32' : '#C62828',
                                        padding: '6px 16px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: formAdicionar.disponivel ? '#2E7D32' : '#C62828' }} />
                                    {formAdicionar.disponivel ? 'SIM' : 'NÃO'}
                                </button>
                            </div>
                        </div>

                        {erro && <p style={{ color: '#C62828', fontSize: '12px', margin: '0 0 14px 0', paddingLeft: '6px' }}>{erro}</p>}

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setModalAdicionarAberto(false)} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border-warm)', borderRadius: '4px', color: 'var(--accent-muted)', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleAdicionar} disabled={loadingAdicionar} style={{ padding: '9px 20px', background: 'var(--panel-dark)', border: 'none', borderRadius: '4px', color: '#FFF', fontSize: '12px', cursor: 'pointer', opacity: loadingAdicionar ? 0.6 : 1 }}>
                                {loadingAdicionar ? 'A processar...' : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}