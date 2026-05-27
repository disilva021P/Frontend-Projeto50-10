'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Modalidade {
  id: string;
  nome: string;
  descricao?: string;
}

interface Estudio {
  id: string;
  nome: string;
  descricao?: string;
  modalidades?: Modalidade[];
}

interface ProfessorDto {
    utilizadores: {
      id: string; // O ID hash que vem do backend
      nome: string;
    };
    valorHora: number;
    professorExterno: boolean;
    modalidades?: Modalidade[]; // Mudei de modalidadesIds para modalidades para bater certo com o .map
  }

type Tab = 'estudios' | 'modalidades' | 'professores';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function isCoordenacao() {
  return getUser()?.tipoUtilizadorId === 'COORDENACAO';
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Btn({
  onClick,
  children,
  variant = 'primary',
  small = false,
  disabled = false,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'ghost' | 'success';
  small?: boolean;
  disabled?: boolean;
}) {
  const colors: Record<string, string> = {
    primary: 'background:#c8a84b;color:#1a1207;',
    danger: 'background:rgba(220,38,38,0.15);color:#f87171;border:1px solid rgba(220,38,38,0.3);',
    ghost: 'background:rgba(255,255,255,0.06);color:#d4b896;border:1px solid rgba(255,255,255,0.1);',
    success: 'background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3);',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '0.3rem 0.75rem' : '0.55rem 1.2rem',
        borderRadius: '6px',
        fontSize: small ? '0.75rem' : '0.82rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.15s',
        fontFamily: 'sans-serif',
        letterSpacing: '0.04em',
        ...Object.fromEntries(
          colors[variant]
            .split(';')
            .filter(Boolean)
            .map((s) => {
              const [k, v] = s.split(':');
              const camel = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
              return [camel, v.trim()];
            })
        ),
      }}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1e1709',
          border: '1px solid rgba(200,168,75,0.25)',
          borderRadius: '12px',
          padding: '2rem',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#c8a84b', fontSize: '1.1rem', fontWeight: 600, margin: 0, fontFamily: 'Georgia, serif' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(200,168,75,0.7)', marginBottom: '0.4rem', fontFamily: 'sans-serif' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.7rem 0.9rem',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(200,168,75,0.2)',
          borderRadius: '7px',
          color: '#f0e8d8',
          fontSize: '0.9rem',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'sans-serif',
        }}
      />
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.2rem 0.6rem',
      background: 'rgba(200,168,75,0.12)',
      border: '1px solid rgba(200,168,75,0.25)',
      borderRadius: '20px',
      fontSize: '0.72rem',
      color: '#c8a84b',
      fontFamily: 'sans-serif',
      marginRight: '0.35rem',
      marginBottom: '0.35rem',
    }}>
      {label}
    </span>
  );
}

// ─── ESTUDIOS TAB ─────────────────────────────────────────────────────────────

function EstudiosTab({ modalidades }: { modalidades: Modalidade[] }) {
  const [estudios, setEstudios] = useState<Estudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Estudio | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '' });
  const [assocModal, setAssocModal] = useState<Estudio | null>(null);
  const [selectedModalidade, setSelectedModalidade] = useState('');
  const coordenacao = isCoordenacao();

  const load = useCallback(async () => {
    try {
      const res = await api.get('/estudios');
      setEstudios(res.data);
    } catch {
      setEstudios([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ nome: '', descricao: '' }); setEditing(null); setShowForm(true); };
  const openEdit = (e: Estudio) => { setForm({ nome: e.nome, descricao: e.descricao || '' }); setEditing(e); setShowForm(true); };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/estudios/${editing.id}`, form);
      } else {
        await api.post('/estudios', form);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      alert('Erro: ' + (err.response?.data || err.message));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Eliminar estúdio?')) return;
    try { await api.delete(`estudios/${id}`); load(); } catch (err: any) { alert('Erro ao eliminar'); }
  };

  const addModalidade = async () => {
    if (!assocModal || !selectedModalidade) return;
    try {
      await api.post(`estudios/${assocModal.id}/modalidade/${selectedModalidade}`);
      setAssocModal(null);
      load();
    } catch (err: any) { alert('Erro: ' + (err.response?.data || err.message)); }
  };

  const removeModalidade = async (estudioId: string, modalidadeId: string) => {
    try {
      await api.delete(`estudios/${estudioId}/modalidade/${modalidadeId}`);
      load();
    } catch (err: any) { alert('Erro ao remover'); }
  };

  if (loading) return <p style={{ color: '#888', fontFamily: 'sans-serif' }}>A carregar...</p>;

  return (
    <div>
      {coordenacao && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Btn onClick={openCreate}>+ Novo Estúdio</Btn>
        </div>
      )}

      {estudios.length === 0 && <p style={{ color: '#666', fontFamily: 'sans-serif' }}>Nenhum estúdio encontrado.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {estudios.map((e) => (
          <div key={e.id} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(200,168,75,0.15)',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ color: '#f0e8d8', fontWeight: 600, fontSize: '1rem', fontFamily: 'Georgia, serif' }}>{e.nome}</div>
                {e.descricao && <div style={{ color: '#888', fontSize: '0.83rem', marginTop: '0.25rem', fontFamily: 'sans-serif' }}>{e.descricao}</div>}
                <div style={{ marginTop: '0.75rem' }}>
                  {(e.modalidades || []).map((m) => (
                    <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.35rem', marginBottom: '0.35rem' }}>
                      <Badge label={m.nome} />
                      {coordenacao && (
                        <button onClick={() => removeModalidade(e.id, m.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>✕</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              {coordenacao && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Btn small variant="ghost" onClick={() => { setAssocModal(e); setSelectedModalidade(''); }}>+ Modalidade</Btn>
                  <Btn small variant="ghost" onClick={() => openEdit(e)}>Editar</Btn>
                  <Btn small variant="danger" onClick={() => remove(e.id)}>Eliminar</Btn>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <Modal title={editing ? 'Editar Estúdio' : 'Novo Estúdio'} onClose={() => setShowForm(false)}>
          <Field label="Nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} placeholder="Nome do estúdio" />
          <Field label="Descrição" value={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} placeholder="Descrição (opcional)" />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </Modal>
      )}

      {/* Assoc Modal */}
      {assocModal && (
        <Modal title={`Associar Modalidade → ${assocModal.nome}`} onClose={() => setAssocModal(null)}>
          <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(200,168,75,0.7)', marginBottom: '0.4rem', fontFamily: 'sans-serif' }}>
            Modalidade
          </label>
          <select
            value={selectedModalidade}
            onChange={(e) => setSelectedModalidade(e.target.value)}
            style={{
              width: '100%',
              padding: '0.7rem 0.9rem',
              background: '#1a1207',
              border: '1px solid rgba(200,168,75,0.2)',
              borderRadius: '7px',
              color: '#f0e8d8',
              fontSize: '0.9rem',
              outline: 'none',
              marginBottom: '1.5rem',
              fontFamily: 'sans-serif',
            }}
          >
            <option value="">Selecionar...</option>
            {modalidades
              .filter((m) => !(assocModal.modalidades || []).find((am) => am.id === m.id))
              .map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setAssocModal(null)}>Cancelar</Btn>
            <Btn onClick={addModalidade} disabled={!selectedModalidade}>Associar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MODALIDADES TAB ──────────────────────────────────────────────────────────

function ModalidadesTab({ onReload }: { onReload: () => void }) {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Modalidade | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '' });
  const coordenacao = isCoordenacao();

  const load = useCallback(async () => {
    try {
      const res = await api.get('modalidades');
      setModalidades(res.data);
      onReload();
    } catch {
      setModalidades([]);
    } finally {
      setLoading(false);
    }
  }, [onReload]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ nome: '', descricao: '' }); setEditing(null); setShowForm(true); };
  const openEdit = (m: Modalidade) => { setForm({ nome: m.nome, descricao: m.descricao || '' }); setEditing(m); setShowForm(true); };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`modalidades/${editing.id}`, form);
      } else {
        await api.post('modalidades', form);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      alert('Erro: ' + (err.response?.data || err.message));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Eliminar modalidade?')) return;
    try { await api.delete(`modalidades/${id}`); load(); } catch { alert('Erro ao eliminar'); }
  };

  if (loading) return <p style={{ color: '#888', fontFamily: 'sans-serif' }}>A carregar...</p>;

  return (
    <div>
      {coordenacao && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Btn onClick={openCreate}>+ Nova Modalidade</Btn>
        </div>
      )}

      {modalidades.length === 0 && <p style={{ color: '#666', fontFamily: 'sans-serif' }}>Nenhuma modalidade encontrada.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {modalidades.map((m) => (
          <div key={m.id} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(200,168,75,0.15)',
            borderRadius: '10px',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <div>
              <div style={{ color: '#f0e8d8', fontWeight: 600, fontFamily: 'Georgia, serif' }}>{m.nome}</div>
              {m.descricao && <div style={{ color: '#888', fontSize: '0.83rem', marginTop: '0.2rem', fontFamily: 'sans-serif' }}>{m.descricao}</div>}
            </div>
            {coordenacao && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Btn small variant="ghost" onClick={() => openEdit(m)}>Editar</Btn>
                <Btn small variant="danger" onClick={() => remove(m.id)}>Eliminar</Btn>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar Modalidade' : 'Nova Modalidade'} onClose={() => setShowForm(false)}>
          <Field label="Nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} placeholder="Nome da modalidade" />
          <Field label="Descrição" value={form.descricao} onChange={(v) => setForm({ ...form, descricao: v })} placeholder="Descrição (opcional)" />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Btn>
            <Btn onClick={save}>Guardar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PROFESSORES TAB ──────────────────────────────────────────────────────────

function ProfessoresTab({ modalidades }: { modalidades: Modalidade[] }) {
  const [professores, setProfessores] = useState<ProfessorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [assocModal, setAssocModal] = useState<ProfessorDto | null>(null);
  const [selectedModalidade, setSelectedModalidade] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const coordenacao = isCoordenacao();

  const load = useCallback(async () => {
    try {
      const res = await api.get(`professores?page=${page}&size=10`);
      // handle both pageable and plain list
      if (res.data?.content) {
        setProfessores(res.data.content);
        setTotalPages(res.data.totalPages);
      } else {
        setProfessores(res.data);
      }
    } catch {
      setProfessores([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const addModalidade = async () => {
    if (!assocModal || !selectedModalidade) return;
    try {
      await api.post(`professores/${assocModal.utilizadores.id}/modalidade/${selectedModalidade}`);
      setAssocModal(null);
      load();
    } catch (err: any) { alert('Erro: ' + (err.response?.data || err.message)); }
  };

  const removeModalidade = async (professorId: string, modalidadeId: string) => {
    try {
      await api.delete(`professores/${professorId}/modalidade/${modalidadeId}`);
      load();
    } catch { alert('Erro ao remover'); }
  };

  if (loading) return <p style={{ color: '#888', fontFamily: 'sans-serif' }}>A carregar...</p>;

  return (
    <div>
      {professores.length === 0 && <p style={{ color: '#666', fontFamily: 'sans-serif' }}>Nenhum professor encontrado.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {professores.map((p) => (
  <div key={p.utilizadores.id} style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(200,168,75,0.15)',
    borderRadius: '10px',
    padding: '1.25rem 1.5rem',
    marginBottom: '1rem'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        {/* Adicionado o Nome do Professor que faltava */}
        <div style={{ color: '#f0e8d8', fontWeight: 600, fontSize: '1rem', fontFamily: 'Georgia, serif' }}>
          {p.utilizadores.nome}
        </div>
        <div style={{ color: '#888', fontSize: '0.75rem', fontFamily: 'sans-serif' }}>
          {p.professorExterno ? 'Professor Externo' : 'Professor Interno'} • {p.valorHora}€/h
        </div>
        
        <div style={{ marginTop: '0.75rem' }}>
          {(p.modalidades || []).map((m) => (
            <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.35rem' }}>
              <Badge label={m.nome} />
              {coordenacao && (
                <button 
                  onClick={() => removeModalidade(p.utilizadores.id, m.id)} 
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}
                >✕</button>
              )}
            </span>
          ))}
        </div>
      </div>
      {coordenacao && (
        <Btn small variant="ghost" onClick={() => { setAssocModal(p); setSelectedModalidade(''); }}>
          + Modalidade
        </Btn>
      )}
    </div>
  </div>
))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <Btn small variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>← Anterior</Btn>
          <span style={{ color: '#888', fontSize: '0.82rem', alignSelf: 'center', fontFamily: 'sans-serif' }}>
            {page + 1} / {totalPages}
          </span>
          <Btn small variant="ghost" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Seguinte →</Btn>
        </div>
      )}

      {assocModal && (
        <Modal title={`Associar Modalidade → ${assocModal.utilizadores.nome}`} onClose={() => setAssocModal(null)}>
          <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(200,168,75,0.7)', marginBottom: '0.4rem', fontFamily: 'sans-serif' }}>
            Modalidade
          </label>
          <select
            value={selectedModalidade}
            onChange={(e) => setSelectedModalidade(e.target.value)}
            style={{
              width: '100%',
              padding: '0.7rem 0.9rem',
              background: '#1a1207',
              border: '1px solid rgba(200,168,75,0.2)',
              borderRadius: '7px',
              color: '#f0e8d8',
              fontSize: '0.9rem',
              outline: 'none',
              marginBottom: '1.5rem',
              fontFamily: 'sans-serif',
            }}
          >
            <option value="">Selecionar...</option>
            {modalidades
              .filter((m) => !(assocModal.modalidades || []).find((am) => am.id === m.id))
              .map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setAssocModal(null)}>Cancelar</Btn>
            <Btn onClick={addModalidade} disabled={!selectedModalidade}>Associar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function GestaoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('estudios');
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);

  const loadModalidades = useCallback(async () => {
    try {
      const res = await api.get('modalidades');
      setModalidades(res.data);
    } catch {
      setModalidades([]);
    }
  }, []);

  useEffect(() => { loadModalidades(); }, [loadModalidades]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'estudios', label: 'Estúdios' },
    { key: 'modalidades', label: 'Modalidades' },
    { key: 'professores', label: 'Professores' },
  ];

  const user = getUser();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#110e05',
      color: '#f0e8d8',
      padding: '2rem 1.5rem',
    }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-block',
            border: '1px solid rgba(200,168,75,0.35)',
            borderRadius: '4px',
            padding: '0.25rem 0.8rem',
            fontSize: '0.68rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#c8a84b',
            fontFamily: 'sans-serif',
            marginBottom: '0.8rem',
          }}>
            Escola de Artes · Gestão
          </div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '2rem',
            fontWeight: 400,
            color: '#f0e8d8',
            margin: 0,
          }}>
            Painel de Administração
          </h1>
          {user?.nome && (
            <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.4rem', fontFamily: 'sans-serif' }}>
              Olá, <span style={{ color: '#c8a84b' }}>{user.nome}</span>
              {isCoordenacao() && ' · Coordenação'}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(200,168,75,0.15)',
          marginBottom: '2rem',
          gap: '0',
        }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === t.key ? '2px solid #c8a84b' : '2px solid transparent',
                color: activeTab === t.key ? '#c8a84b' : '#666',
                padding: '0.7rem 1.4rem',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: activeTab === t.key ? 600 : 400,
                fontFamily: 'sans-serif',
                letterSpacing: '0.04em',
                transition: 'color 0.15s',
                marginBottom: '-1px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'estudios' && <EstudiosTab modalidades={modalidades} />}
        {activeTab === 'modalidades' && <ModalidadesTab onReload={loadModalidades} />}
        {activeTab === 'professores' && <ProfessoresTab modalidades={modalidades} />}
      </div>
    </div>
  );
}