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
    const [pesquisa, setPesquisa] = useState('');

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
            {/* COMPONENTE DE INTRODUÇÃO / HEADER */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }} className="flex justify-between items-end">
                <div>
                    <p style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>
                        Área de Gestão Interna
                    </p>
                    <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', color: 'var(--panel-dark)', fontWeight: 400 }}>
                        Inventário Escolar
                    </h1>
                </div>

                <button
                    onClick={() => { setErro(null); setModalAdicionarAberto(true); }}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--border-warm)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        padding: '10px 20px',
                        fontSize: '11px',
                        color: 'var(--panel-dark)',
                        letterSpacing: '.5px',
                        fontWeight: 400,
                        textTransform: 'uppercase',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(160,133,96,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                    + Adicionar Artigo Novo
                </button>
            </div>

            {/* SEPARADOR SUTIL IGUAL À LANDING PAGE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                    Artigos e Equipamentos
                </span>
                <div style={{ flex: 1, borderBottom: '2px solid var(--border-warm)', opacity: 0.5 }} />
            </div>

            {/* CAIXA DE PESQUISA INTEGRADA NO DESIGN COESIVO */}
            <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
                <input
                    type="text"
                    placeholder="Pesquisar artigos em stock..."
                    value={pesquisa}
                    onChange={(e) => setPesquisa(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '11px 14px',
                        background: '#FFF',
                        border: '1px solid var(--border-warm)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: 'var(--panel-dark)',
                        outline: 'none',
                        fontFamily: 'inherit',
                    }}
                />
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
                        Não existem registos de equipamentos ou artigos correspondentes à pesquisa efetuada.
                    </p>
                </div>
            ) : (
                <div style={{ background: '#FBF7F2', border: '1px solid var(--border-warm)', borderRadius: '8px', position: 'relative', overflow: 'hidden', padding: '12px' }}>
                    
                    {/* ENCABEÇADO DE COLUNAS DA TABELA INTERNA */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '10px 14px', fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-warm)' }}>
                        <span>Nome do Artigo</span>
                        <span>Localização</span>
                        <span style={{ textAlign: 'right' }}>Disponibilidade</span>
                    </div>

                    {/* LISTAGEM DOS ITENS EM LINHAS FINAIS */}
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
                                className="item-linha-inventario"
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

            {/* CONTROLO DE PAGINAÇÃO SEGUNDO O PADRÃO TEXTUAL */}
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

            {/* MODAL CONFIGURADO DE EDIÇÃO */}
            {modalEditarAberto && itemSelecionado && (
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setModalEditarAberto(false)}>
                    <div style={{ background: '#FFFBF7', border: '1px solid var(--border-warm)', borderRadius: '8px', width: '90%', maxWidth: '440px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
                        
                        <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>Modificação</p>
                        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '18px' }}>Editar Artigo</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
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
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border-warm)' }}>
                                <span style={{ fontSize: '13px', color: 'var(--panel-dark)' }}>Disponível?</span>
                                <button
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, disponivel: !p.disponivel }))}
                                    style={{
                                        background: form.disponivel ? 'var(--panel-dark)' : 'rgba(160,133,96,0.2)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: form.disponivel ? '#FFF' : 'var(--panel-dark)',
                                        padding: '5px 12px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {form.disponivel ? 'SIM' : 'NÃO'}
                                </button>
                            </div>
                        </div>

                        {erro && <p style={{ color: '#C62828', fontSize: '12px', margin: '0 0 14px 0' }}>{erro}</p>}

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setModalEditarAberto(false)} style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border-warm)', borderRadius: '4px', color: 'var(--accent-muted)', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleSalvar} disabled={loadingSalvar} style={{ padding: '9px 20px', background: 'var(--panel-dark)', border: 'none', borderRadius: '4px', color: '#FFF', fontSize: '12px', cursor: 'pointer', opacity: loadingSalvar ? 0.6 : 1 }}>
                                {loadingSalvar ? 'A gravar...' : 'Gravar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIGURADO PARA ADICIONAR NOVO ITEM */}
            {modalAdicionarAberto && (
                <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setModalAdicionarAberto(false)}>
                    <div style={{ background: '#FFFBF7', border: '1px solid var(--border-warm)', borderRadius: '8px', width: '90%', maxWidth: '460px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
                        
                        <p style={{ fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent-muted)', fontWeight: 300, marginBottom: '4px' }}>Inclusão de Item</p>
                        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', color: 'var(--panel-dark)', fontWeight: 400, marginBottom: '18px' }}>Novo Artigo de Inventário</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
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
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border-warm)' }}>
                                <span style={{ fontSize: '13px', color: 'var(--panel-dark)' }}>Disponível Imediatamente</span>
                                <button
                                    type="button"
                                    onClick={() => setFormAdicionar(p => ({ ...p, disponivel: !p.disponivel }))}
                                    style={{
                                        background: formAdicionar.disponivel ? 'var(--panel-dark)' : 'rgba(160,133,96,0.2)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: formAdicionar.disponivel ? '#FFF' : 'var(--panel-dark)',
                                        padding: '5px 12px',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {formAdicionar.disponivel ? 'SIM' : 'NÃO'}
                                </button>
                            </div>
                        </div>

                        {erro && <p style={{ color: '#C62828', fontSize: '12px', margin: '0 0 14px 0' }}>{erro}</p>}

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