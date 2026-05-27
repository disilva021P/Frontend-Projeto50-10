'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Utilizador {
    id: string;
    nome: string;
    email: string;
    nif?: string;
    telefone?: string;
    tipo?: string;
    dataNascimento?: string;
    ativo?: boolean;
}

interface PaginaResponse {
    content: Utilizador[];
    totalPages: number;
    number: number;
    totalElements: number;
}

interface ApiResponse {
    status: number;
    data: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
    'w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white outline-none focus:border-blue-500 transition';

const labelClass = 'text-xs font-bold text-gray-500 uppercase block mb-1';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 space-y-4">
            <h2 className="text-base font-bold text-blue-400">{title}</h2>
            {children}
        </div>
    );
}

function ResponseBox({ response }: { response: ApiResponse | null }) {
    if (!response) return null;
    const ok = response.status >= 200 && response.status < 300;
    return (
        <pre
            className={`text-xs p-3 rounded-lg border whitespace-pre-wrap break-all ${
                ok
                    ? 'bg-green-500/10 border-green-500/20 text-green-300'
                    : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}
        >
            Status: {response.status}{'\n\n'}
            {JSON.stringify(response.data, null, 2)}
        </pre>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UtilizadoresPage() {

    // ── Gerar Token Email ─────────────────────────────────────────────────────
    const [geraTokenEmail, setGeraTokenEmail] = useState('');
    const [respGeraToken, setRespGeraToken] = useState<ApiResponse | null>(null);

    // ── Esqueceu Password ─────────────────────────────────────────────────────
    const [esqEmail, setEsqEmail] = useState('');
    const [esqToken, setEsqToken] = useState('');
    const [esqNovaPwd, setEsqNovaPwd] = useState('');
    const [respEsqueceu, setRespEsqueceu] = useState<ApiResponse | null>(null);

    // ── Listar Todos ──────────────────────────────────────────────────────────
    const [filtroTipo, setFiltroTipo] = useState('');
    const [pagina, setPagina] = useState(0);
    const [tamanho, setTamanho] = useState(10);
    const [respListar, setRespListar] = useState<ApiResponse | null>(null);
    const [listaUtilizadores, setListaUtilizadores] = useState<Utilizador[]>([]);

    // ── Ver Detalhe ───────────────────────────────────────────────────────────
    const [detalheId, setDetalheId] = useState('');
    const [respDetalhe, setRespDetalhe] = useState<ApiResponse | null>(null);

    // ── Criar Utilizador ──────────────────────────────────────────────────────
    const [formCriar, setFormCriar] = useState({
        nome: '', email: '', nif: '', telefone: '',
        id_tipoUtilizador: '', dataNascimento: '', palavraPasseTemporaria: '',
    });
    const [respCriar, setRespCriar] = useState<ApiResponse | null>(null);

    // ── Toggle Ativo ──────────────────────────────────────────────────────────
    const [toggleId, setToggleId] = useState('');
    const [respToggle, setRespToggle] = useState<ApiResponse | null>(null);

    // ── Apagar Utilizador ─────────────────────────────────────────────────────
    const [apagarId, setApagarId] = useState('');
    const [respApagar, setRespApagar] = useState<ApiResponse | null>(null);

    // ── Meu Perfil ────────────────────────────────────────────────────────────
    const [respMeuPerfil, setRespMeuPerfil] = useState<ApiResponse | null>(null);

    // ── Alterar Minha Password ────────────────────────────────────────────────
    const [pwdAtual, setPwdAtual] = useState('');
    const [pwdNova, setPwdNova] = useState('');
    const [pwdConfirmar, setPwdConfirmar] = useState('');
    const [respMinhaPass, setRespMinhaPass] = useState<ApiResponse | null>(null);

    // ── Repor Password ────────────────────────────────────────────────────────
    const [reporId, setReporId] = useState('');
    const [reporNovaPwd, setReporNovaPwd] = useState('');
    const [reporConfirmar, setReporConfirmar] = useState('');
    const [respRepor, setRespRepor] = useState<ApiResponse | null>(null);

    // ── Meus Educandos ────────────────────────────────────────────────────────
    const [respEducandos, setRespEducandos] = useState<ApiResponse | null>(null);

    // ── Disponíveis Grupo ─────────────────────────────────────────────────────
    const [respDisponiveis, setRespDisponiveis] = useState<ApiResponse | null>(null);

    // ── Eliminar Permanente ───────────────────────────────────────────────────
    const [eliminarId, setEliminarId] = useState('');
    const [respEliminar, setRespEliminar] = useState<ApiResponse | null>(null);

    // ── Adicionar / Remover Educando ──────────────────────────────────────────
    const [addEncId, setAddEncId] = useState('');
    const [addAluId, setAddAluId] = useState('');
    const [respAddEducando, setRespAddEducando] = useState<ApiResponse | null>(null);
    const [remEncId, setRemEncId] = useState('');
    const [remAluId, setRemAluId] = useState('');
    const [respRemEducando, setRespRemEducando] = useState<ApiResponse | null>(null);

    // ── Editar Utilizador ─────────────────────────────────────────────────────
    const [formEditar, setFormEditar] = useState({
        id: '', nome: '', email: '', nif: '', telefone: '',
        dataNascimento: '', valorHora: '', professorExterno: '', notasProfessor: '',
    });
    const [respEditar, setRespEditar] = useState<ApiResponse | null>(null);

    // ─── API helper ───────────────────────────────────────────────────────────

    const req = async (
        method: string,
        path: string,
        body?: any,
        setter?: (r: ApiResponse) => void,
    ) => {
        try {
            // O Axios já usa a baseURL de /api, por isso removemos o prefixo se necessário
            // Se o path vier como "/api/utilizadores", o axios pode duplicar. 
            // Ajustamos para garantir que removemos o prefixo redundante:
            const cleanPath = path.replace(/^\/api/, '');
            
            const response = await (api as any)[method.toLowerCase()](cleanPath, body);
            
            const resData = { status: response.status, data: response.data };
            setter?.(resData);
            return resData;
        } catch (e: any) {
            const errorData = { 
                status: e.response?.status || 0, 
                data: e.response?.data || 'Erro de rede ou servidor' 
            };
            setter?.(errorData);
            return errorData;
        }
    };

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const geraToken = () =>
        req('POST', `/utilizadores/geraTokenEmail?email=${encodeURIComponent(geraTokenEmail)}`, undefined, setRespGeraToken);

    const esqueceuPassword = () =>
        req('POST', '/utilizadores/esqueceuPassword', {
            email: esqEmail, token: esqToken, novaPassword: esqNovaPwd,
        }, setRespEsqueceu);

    const listarTodos = async () => {
        let path = `/utilizadores?page=${pagina}&size=${tamanho}`;
        if (filtroTipo) path += `&tipo=${encodeURIComponent(filtroTipo)}`;
        const result = await req('GET', path, undefined, setRespListar);
        if (result?.data?.content) {
            setListaUtilizadores(result.data.content);
        }
    };

    const preencherEditar = (u: Utilizador) => {
        setFormEditar({
            id: u.id ?? '',
            nome: u.nome ?? '',
            email: u.email ?? '',
            nif: u.nif ?? '',
            telefone: u.telefone ?? '',
            dataNascimento: u.dataNascimento ? u.dataNascimento.substring(0, 10) : '',
            valorHora: '',
            professorExterno: '',
            notasProfessor: '',
        });
    };

    const verDetalhe = () =>
        req('GET', `/utilizadores/${detalheId}`, undefined, setRespDetalhe);

    const criarUtilizador = () =>
        req('POST', '/utilizadores', {
            nome: formCriar.nome,
            email: formCriar.email,
            nif: formCriar.nif,
            telefone: formCriar.telefone,
            id_tipoUtilizador: formCriar.id_tipoUtilizador,
            dataNascimento: formCriar.dataNascimento,
            palavraPasseTemporaria: formCriar.palavraPasseTemporaria,
        }, setRespCriar);

    const toggleAtivo = () =>
        req('PATCH', `/utilizadores/${toggleId}/toggle-ativo`, undefined, setRespToggle);

    const apagarUtilizador = () =>
        req('DELETE', `/utilizadores/${apagarId}`, undefined, setRespApagar);

    const verMeuPerfil = () =>
        req('GET', '/utilizadores/meu-perfil', undefined, setRespMeuPerfil);

    const alterarMinhaPassword = () =>
        req('PATCH', '/utilizadores/minha-password', {
            passwordAtual: pwdAtual, novaPassword: pwdNova, confirmarNovaPassword: pwdConfirmar,
        }, setRespMinhaPass);

    const reporPassword = () =>
        req('PATCH', `/utilizadores/${reporId}/repor-password`, {
            novaPassword: reporNovaPwd, confirmarNovaPassword: reporConfirmar,
        }, setRespRepor);

    const meusEducandos = () =>
        req('GET', '/utilizadores/meus-educandos', undefined, setRespEducandos);

    const disponiveisGrupo = () =>
        req('GET', '/utilizadores/disponiveis-grupo', undefined, setRespDisponiveis);

    const eliminaPermanente = () =>
        req('DELETE', `/utilizadores/eliminaPermanente/${eliminarId}`, undefined, setRespEliminar);

    const adicionarEducando = () =>
        req('POST', `/utilizadores/${addEncId}/educandos/${addAluId}`, undefined, setRespAddEducando);

    const removerEducando = () =>
        req('DELETE', `/utilizadores/${remEncId}/educandos/${remAluId}`, undefined, setRespRemEducando);

    const editarUtilizador = () =>
        req('PUT', `/utilizadores/${formEditar.id}/editar`, {
            nome: formEditar.nome,
            email: formEditar.email,
            nif: formEditar.nif,
            telefone: formEditar.telefone,
            dataNascimento: formEditar.dataNascimento || null,
            valorHora: formEditar.valorHora ? parseFloat(formEditar.valorHora) : null,
            professorExterno: formEditar.professorExterno !== '' ? formEditar.professorExterno === 'true' : null,
            notasProfessor: formEditar.notasProfessor || null,
        }, setRespEditar);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <main className="min-h-screen bg-gray-900 text-white p-6 space-y-6">

            {/* HEADER */}
            <div className="mb-2">
                <h1 className="text-3xl font-bold text-blue-400">API Utilizadores</h1>
                <p className="text-gray-500 text-sm">Painel de teste (Sessão gerida automaticamente via lib/api)</p>
            </div>

            {/* 1. GERAR TOKEN EMAIL */}
            <Section title="1. Gerar Token de Recuperação por Email — POST /utilizadores/geraTokenEmail">
                <div>
                    <label className={labelClass}>Email</label>
                    <input type="text" value={geraTokenEmail} onChange={e => setGeraTokenEmail(e.target.value)} className={inputClass} />
                </div>
                <button onClick={geraToken} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Enviar Token por Email
                </button>
                <ResponseBox response={respGeraToken} />
            </Section>

            {/* 2. ESQUECEU PASSWORD */}
            <Section title="2. Alterar Password sem Login — POST /utilizadores/esqueceuPassword">
                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label className={labelClass}>Email</label>
                        <input type="text" value={esqEmail} onChange={e => setEsqEmail(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Token recebido por email</label>
                        <input type="text" value={esqToken} onChange={e => setEsqToken(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Nova Password</label>
                        <input type="password" value={esqNovaPwd} onChange={e => setEsqNovaPwd(e.target.value)} className={inputClass} />
                    </div>
                </div>
                <button onClick={esqueceuPassword} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Alterar Password
                </button>
                <ResponseBox response={respEsqueceu} />
            </Section>

            {/* 3. LISTAR TODOS */}
            <Section title="3. Listar Utilizadores — GET /utilizadores (só COORDENACAO)">
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                        <label className={labelClass}>Filtro por tipo</label>
                        <input type="text" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} placeholder="ex: ALUNO" className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Página</label>
                        <input type="number" value={pagina} onChange={e => setPagina(Number(e.target.value))} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Tamanho</label>
                        <input type="number" value={tamanho} onChange={e => setTamanho(Number(e.target.value))} className={inputClass} />
                    </div>
                </div>
                <button onClick={listarTodos} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Listar
                </button>
                <ResponseBox response={respListar} />
                {listaUtilizadores.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 font-bold uppercase">Clica num utilizador para preencher o formulário de edição:</p>
                        {listaUtilizadores.map(u => (
                            <button
                                key={u.id}
                                onClick={() => preencherEditar(u)}
                                className="block w-full text-left text-sm px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                            >
                                [{u.tipo}] {u.nome} — {u.email}
                            </button>
                        ))}
                    </div>
                )}
            </Section>

            {/* 4. VER DETALHE */}
            <Section title="4. Ver Detalhe de Utilizador — GET /utilizadores/{id} (só COORDENACAO)">
                <div>
                    <label className={labelClass}>ID (hasheado)</label>
                    <input type="text" value={detalheId} onChange={e => setDetalheId(e.target.value)} className={inputClass} />
                </div>
                <button onClick={verDetalhe} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Ver Detalhe
                </button>
                <ResponseBox response={respDetalhe} />
            </Section>

            {/* 5. CRIAR UTILIZADOR */}
            <Section title="5. Criar Utilizador — POST /utilizadores (só COORDENACAO)">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Nome', key: 'nome', type: 'text' },
                        { label: 'Email', key: 'email', type: 'text' },
                        { label: 'NIF', key: 'nif', type: 'text' },
                        { label: 'Telefone', key: 'telefone', type: 'text' },
                        { label: 'ID Tipo Utilizador (hasheado)', key: 'id_tipoUtilizador', type: 'text' },
                        { label: 'Data Nascimento (YYYY-MM-DD)', key: 'dataNascimento', type: 'text' },
                    ].map(f => (
                        <div key={f.key}>
                            <label className={labelClass}>{f.label}</label>
                            <input
                                type={f.type}
                                value={(formCriar as any)[f.key]}
                                onChange={e => setFormCriar(p => ({ ...p, [f.key]: e.target.value }))}
                                className={inputClass}
                            />
                        </div>
                    ))}
                    <div className="col-span-2">
                        <label className={labelClass}>Palavra-passe temporária</label>
                        <input
                            type="password"
                            value={formCriar.palavraPasseTemporaria}
                            onChange={e => setFormCriar(p => ({ ...p, palavraPasseTemporaria: e.target.value }))}
                            className={inputClass}
                        />
                    </div>
                </div>
                <button onClick={criarUtilizador} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Criar
                </button>
                <ResponseBox response={respCriar} />
            </Section>

            {/* 6. TOGGLE ATIVO */}
            <Section title="6. Ativar / Desativar Utilizador — PATCH /utilizadores/{id}/toggle-ativo (só COORDENACAO)">
                <div>
                    <label className={labelClass}>ID (hasheado)</label>
                    <input type="text" value={toggleId} onChange={e => setToggleId(e.target.value)} className={inputClass} />
                </div>
                <button onClick={toggleAtivo} className="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Toggle Ativo
                </button>
                <ResponseBox response={respToggle} />
            </Section>

            {/* 7. APAGAR UTILIZADOR */}
            <Section title="7. Apagar Utilizador (soft delete) — DELETE /utilizadores/{id} (só COORDENACAO)">
                <div>
                    <label className={labelClass}>ID (hasheado)</label>
                    <input type="text" value={apagarId} onChange={e => setApagarId(e.target.value)} className={inputClass} />
                </div>
                <button onClick={apagarUtilizador} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Apagar
                </button>
                <ResponseBox response={respApagar} />
            </Section>

            {/* 8. MEU PERFIL */}
            <Section title="8. Ver Meu Perfil — GET /utilizadores/meu-perfil">
                <button onClick={verMeuPerfil} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Ver Perfil
                </button>
                <ResponseBox response={respMeuPerfil} />
            </Section>

            {/* 9. ALTERAR MINHA PASSWORD */}
            <Section title="9. Alterar Minha Password — PATCH /utilizadores/minha-password">
                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label className={labelClass}>Password Atual</label>
                        <input type="password" value={pwdAtual} onChange={e => setPwdAtual(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Nova Password</label>
                        <input type="password" value={pwdNova} onChange={e => setPwdNova(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Confirmar Nova Password</label>
                        <input type="password" value={pwdConfirmar} onChange={e => setPwdConfirmar(e.target.value)} className={inputClass} />
                    </div>
                </div>
                <button onClick={alterarMinhaPassword} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Alterar
                </button>
                <ResponseBox response={respMinhaPass} />
            </Section>

            {/* 10. REPOR PASSWORD */}
            <Section title="10. Repor Password de Utilizador — PATCH /utilizadores/{id}/repor-password (só COORDENACAO)">
                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label className={labelClass}>ID (hasheado)</label>
                        <input type="text" value={reporId} onChange={e => setReporId(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Nova Password</label>
                        <input type="password" value={reporNovaPwd} onChange={e => setReporNovaPwd(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Confirmar Nova Password</label>
                        <input type="password" value={reporConfirmar} onChange={e => setReporConfirmar(e.target.value)} className={inputClass} />
                    </div>
                </div>
                <button onClick={reporPassword} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Repor
                </button>
                <ResponseBox response={respRepor} />
            </Section>

            {/* 11. MEUS EDUCANDOS */}
            <Section title="11. Meus Educandos — GET /utilizadores/meus-educandos (só ENCARREGADO)">
                <button onClick={meusEducandos} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Ver Educandos
                </button>
                <ResponseBox response={respEducandos} />
            </Section>

            {/* 12. DISPONÍVEIS GRUPO */}
            <Section title="12. Utilizadores Disponíveis para Grupo — GET /utilizadores/disponiveis-grupo">
                <button onClick={disponiveisGrupo} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Listar
                </button>
                <ResponseBox response={respDisponiveis} />
            </Section>

            {/* 13. ELIMINAR PERMANENTE */}
            <Section title="13. Eliminar Utilizador Permanentemente — DELETE /utilizadores/eliminaPermanente/{id} (só COORDENACAO)">
                <div>
                    <label className={labelClass}>ID (hasheado)</label>
                    <input type="text" value={eliminarId} onChange={e => setEliminarId(e.target.value)} className={inputClass} />
                </div>
                <button onClick={eliminaPermanente} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Eliminar Permanentemente
                </button>
                <ResponseBox response={respEliminar} />
            </Section>

            {/* 14. ADICIONAR EDUCANDO */}
            <Section title="14. Adicionar Educando a Encarregado — POST /utilizadores/{encarregadoId}/educandos/{alunoId} (só COORDENACAO)">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>ID Encarregado (hasheado)</label>
                        <input type="text" value={addEncId} onChange={e => setAddEncId(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>ID Aluno (hasheado)</label>
                        <input type="text" value={addAluId} onChange={e => setAddAluId(e.target.value)} className={inputClass} />
                    </div>
                </div>
                <button onClick={adicionarEducando} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Adicionar
                </button>
                <ResponseBox response={respAddEducando} />
            </Section>

            {/* 15. REMOVER EDUCANDO */}
            <Section title="15. Remover Educando de Encarregado — DELETE /utilizadores/{encarregadoId}/educandos/{alunoId} (só COORDENACAO)">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass}>ID Encarregado (hasheado)</label>
                        <input type="text" value={remEncId} onChange={e => setRemEncId(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>ID Aluno (hasheado)</label>
                        <input type="text" value={remAluId} onChange={e => setRemAluId(e.target.value)} className={inputClass} />
                    </div>
                </div>
                <button onClick={removerEducando} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Remover
                </button>
                <ResponseBox response={respRemEducando} />
            </Section>

            {/* 16. EDITAR UTILIZADOR */}
            <Section title="16. Editar Utilizador — PUT /utilizadores/{id}/editar (só COORDENACAO)">
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'ID (hasheado)', key: 'id', type: 'text' },
                        { label: 'Nome', key: 'nome', type: 'text' },
                        { label: 'Email', key: 'email', type: 'text' },
                        { label: 'NIF', key: 'nif', type: 'text' },
                        { label: 'Telefone', key: 'telefone', type: 'text' },
                        { label: 'Data Nascimento (YYYY-MM-DD)', key: 'dataNascimento', type: 'text' },
                        { label: 'Valor/Hora (só Professor)', key: 'valorHora', type: 'number' },
                        { label: 'Notas Professor (só Professor)', key: 'notasProfessor', type: 'text' },
                    ].map(f => (
                        <div key={f.key}>
                            <label className={labelClass}>{f.label}</label>
                            <input
                                type={f.type}
                                step={f.type === 'number' ? '0.01' : undefined}
                                value={(formEditar as any)[f.key]}
                                onChange={e => setFormEditar(p => ({ ...p, [f.key]: e.target.value }))}
                                className={inputClass}
                            />
                        </div>
                    ))}
                    <div>
                        <label className={labelClass}>Professor Externo (só Professor)</label>
                        <select
                            value={formEditar.professorExterno}
                            onChange={e => setFormEditar(p => ({ ...p, professorExterno: e.target.value }))}
                            className={inputClass + ' appearance-none'}
                        >
                            <option value="">--</option>
                            <option value="true">Sim</option>
                            <option value="false">Não</option>
                        </select>
                    </div>
                </div>
                <button onClick={editarUtilizador} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold text-sm transition">
                    Guardar Alterações
                </button>
                <ResponseBox response={respEditar} />
            </Section>

        </main>
    );
}