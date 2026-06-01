'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'ALUNO' | 'COORDENACAO' | 'PROFESSOR' | 'ENCARREGADO';

interface UtilizadoreResumoDto {
  id: string;
  nome: string;
}

interface FaltaDto {
  id: string;
  aula?: AulaDto;
  utilizadorId?: UtilizadoreResumoDto | null;
  justificado: boolean;
  motivo?: string;
  estado: string;
  marcardo_por?: UtilizadoreResumoDto;
  criadoEm?: string;
  justificadoEm?: string;
}

interface FaltaResumoDto {
  total: number;
  justificadas: number;
  pendentes: number;
  injustificadas: number;
}

interface EstudioDto {
  id: string;
  nome: string;
}

interface EstadoAulaDto {
  id: string;
  nome: string;
}

interface HorarioTurmaDto {
  id: string;
  nome?: string;
}

interface AulaDto {
  id: string;
  titulo?: string;
  horaInicio?: string;
  horaFim?: string;
  dataAula?: string;
  duracaoMinutos?: number;
  maxAlunos?: number;
  estudio?: EstudioDto;
  estado?: EstadoAulaDto;
  idHorario?: HorarioTurmaDto;
}

interface AlunoResumoDto {
  id: string;
  nome: string;
}

interface PageAulas {
  content: AulaDto[];
  totalPages: number;
  totalElements: number;
  number: number;
}

const BASE_URL = 'http://localhost:8080';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

const fmtHora = (h?: string) => h ? h.substring(0, 5) : '—';
const fmtData = (d?: string) => {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return d;
};

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

// ─── BADGE ESTADO ─────────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    PENDENTE:      { bg: '#FFF8E1', color: '#F57F17', label: 'Pendente' },
    APROVADA:      { bg: '#E8F5E9', color: '#2E7D32', label: 'Aprovada' },
    JUSTIFICADA:   { bg: '#E8F5E9', color: '#2E7D32', label: 'Justificada' },
    INJUSTIFICADA: { bg: '#FFEBEE', color: '#C62828', label: 'Injustificada' },
  };
  const s = map[estado?.toUpperCase()] ?? { bg: '#F5F5F5', color: '#616161', label: estado };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// ─── MODAL JUSTIFICAÇÃO ───────────────────────────────────────────────────────
interface ModalJustificacaoProps {
  faltaId: string;
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  onToast?: (msg: string, tipo: 'ok' | 'erro') => void;
}
function ModalJustificacao({ faltaId, onClose, onSuccess, token, onToast }: ModalJustificacaoProps) {
  const [motivo, setMotivo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async () => {
    if (!motivo.trim()) { setErro('Insira um motivo.'); return; }
    if (!file) { setErro('Anexe um ficheiro PDF.'); return; }
    setLoading(true);
    setErro('');
    const fd = new FormData();
    fd.append('pdf', file);
    fd.append('motivo', motivo);
    try {
      const res = await fetch(`${BASE_URL}/api/faltas/${faltaId}/justificar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) { onToast?.('Justificação enviada com sucesso!', 'ok'); onSuccess(); onClose(); }
      else { const t = await res.text(); setErro(t || 'Erro ao submeter.'); }
    } catch { setErro('Erro de rede.'); }
    finally { setLoading(false); }
  };

  const estiloInput = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border-warm, #e5dec9)',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
    backgroundColor: '#FFF',
    color: 'var(--panel-dark, #3d4f5c)',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    boxShadow: 'rgba(0,0,0,0.02) 0px 1px 3px 0px, rgba(27,31,35,0.15) 0px 0px 0px 1px inset',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(24,23,21,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', background: '#fff', borderRadius: '12px', padding: '30px', width: '460px', maxWidth: '95vw', border: '1px solid var(--border-warm, #e5dec9)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '5px', background: 'var(--panel-dark, #3d4f5c)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <h2 style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', fontSize: '20px', margin: 0, color: 'var(--panel-dark, #3d4f5c)', fontWeight: 400 }}>Submeter Justificação</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#aaa', lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--accent-muted, #888)', margin: '0 0 24px', letterSpacing: '0.3px' }}>
          Preenche o motivo e anexa o documento comprovativo.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted, #888)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Motivo da ausência</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo da falta..."
              style={{ ...estiloInput, resize: 'vertical' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-muted, #888)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Documento comprovativo (PDF)</label>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: '12px', width: '100%' }} />
          </div>
          {erro && <p style={{ color: '#C62828', fontSize: '12px', margin: 0 }}>⚠ {erro}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button onClick={onClose} style={{ padding: '10px 18px', border: '1px solid var(--border-warm, #e5dec9)', background: 'transparent', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--panel-dark, #3d4f5c)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={loading} style={{ background: 'var(--panel-dark, #3d4f5c)', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              {loading ? 'A enviar...' : 'Submeter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CARDS DE RESUMO ──────────────────────────────────────────────────────────
function ResumoCards({ resumo }: { resumo: FaltaResumoDto | null }) {
  if (!resumo) return null;
  const cards = [
    { label: 'Total', value: resumo.total, cor: '#3d4f5c', bg: '#F5EFE6', borda: '#e5dec9' },
    { label: 'Justificadas', value: resumo.justificadas, cor: '#2E7D32', bg: '#F1F8F2', borda: '#A5D6A7' },
    { label: 'Pendentes', value: resumo.pendentes, cor: '#B58100', bg: '#FFF8E1', borda: '#FFE082' },
    { label: 'Injustificadas', value: resumo.injustificadas, cor: '#C62828', bg: '#FFF5F5', borda: '#FFCDD2' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.borda}`, borderLeft: `4px solid ${c.cor}`, borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: c.cor, lineHeight: 1 }}>{c.value}</p>
          <p style={{ margin: 0, fontSize: '11px', color: c.cor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>{c.label}</p>
        </div>
      ))}
    </div>
  );
}


// ─── MODAL DETALHE FALTA ──────────────────────────────────────────────────────
interface ModalDetalheFaltaProps {
  falta: FaltaDto;
  onClose: () => void;
  token: string;
}
function ModalDetalheFalta({ falta, onClose, token }: ModalDetalheFaltaProps) {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'erro' | 'ok' } | null>(null);

  const mostrarToast = (msg: string, tipo: 'erro' | 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const abrirPdf = async () => {
    setLoadingPdf(true);
    try {
      const res = await fetch(`${BASE_URL}/api/faltas/${falta.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        mostrarToast('Documento aberto com sucesso.', 'ok');
      } else if (res.status === 404) {
        mostrarToast('Esta falta não tem documento anexado.', 'erro');
      } else if (res.status === 403) {
        mostrarToast('Sem permissão para ver este documento.', 'erro');
      } else {
        mostrarToast('Erro ao obter o documento.', 'erro');
      }
    } catch {
      mostrarToast('Erro de rede ao tentar abrir o documento.', 'erro');
    } finally { setLoadingPdf(false); }
  };

  const dataFmt = (d?: string) => d ? new Date(d).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtHora = (h?: string) => h ? h.substring(0, 5) : '—';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(24,23,21,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', background: '#fff', borderRadius: '12px', padding: '30px', width: '480px', maxWidth: '95vw', border: '1px solid var(--border-warm, #e5dec9)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

        {toast && (
          <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: toast.tipo === 'erro' ? '#C62828' : '#2E7D32', color: '#fff', padding: '8px 18px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {toast.tipo === 'erro' ? '⚠ ' : '✓ '}{toast.msg}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '10px', letterSpacing: '2px', color: '#aaa' }}>DETALHE DA FALTA</p>
            <h2 style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', fontSize: '20px', margin: 0, color: 'var(--panel-dark, #3d4f5c)', fontWeight: 400 }}>
              {falta.aula?.titulo || 'Aula'}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#aaa', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Aluno */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FAF6F0', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>Aluno</span>
            <span style={{ fontSize: '13px', color: 'var(--panel-dark, #3d4f5c)', fontWeight: 500 }}>{falta.utilizadorId?.nome || '—'}</span>
          </div>

          {/* Aula info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FAF6F0', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>Data</span>
            <span style={{ fontSize: '13px', color: 'var(--panel-dark, #3d4f5c)' }}>{falta.aula?.dataAula || '—'} {falta.aula?.horaInicio && `· ${fmtHora(falta.aula.horaInicio)}–${fmtHora(falta.aula.horaFim)}`}</span>
          </div>

          {/* Estado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#FAF6F0', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>Estado</span>
            <EstadoBadge estado={falta.estado} />
          </div>

          {/* Motivo */}
          {falta.motivo && (
            <div style={{ padding: '10px 14px', background: '#FAF6F0', borderRadius: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Motivo</span>
              <span style={{ fontSize: '13px', color: '#555' }}>{falta.motivo}</span>
            </div>
          )}

          {/* Marcado por */}
          {falta.marcardo_por && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FAF6F0', borderRadius: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>Marcado por</span>
              <span style={{ fontSize: '13px', color: '#555' }}>{falta.marcardo_por.nome}</span>
            </div>
          )}

          {/* Datas */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#FAF6F0', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>Registado em</span>
            <span style={{ fontSize: '13px', color: '#555' }}>{dataFmt(falta.criadoEm)}</span>
          </div>

          {/* Justificação */}
          {(() => {
            const aprovada = falta.estado === 'APROVADA';
            const rejeitada = falta.estado === 'INJUSTIFICADA';
            const temJustificacao = aprovada || rejeitada || !!falta.justificadoEm;
            if (!temJustificacao && falta.estado === 'PENDENTE') {
              // Falta pendente sem justificação — mostra só botão "Ver Documento" cinza
              return (
                <button
                  onClick={abrirPdf}
                  disabled={loadingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '6px', border: '1px solid #e5dec9', background: '#FAF6F0', color: '#aaa', fontSize: '12px', fontWeight: 500, cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                >
                  <i className="ti ti-file-description" />
                  {loadingPdf ? 'A verificar…' : 'Ver Documento'}
                </button>
              );
            }
            const bg = aprovada ? '#F1F8F2' : rejeitada ? '#FFF5F5' : '#FFF8E1';
            const borda = aprovada ? '#A5D6A7' : rejeitada ? '#FFCDD2' : '#FFE082';
            const cor = aprovada ? '#2E7D32' : rejeitada ? '#C62828' : '#B58100';
            const label = aprovada ? 'Justificação Aprovada' : rejeitada ? 'Justificação Rejeitada' : 'Aguarda Validação';
            return (
              <div style={{ padding: '12px 14px', background: bg, border: `1px solid ${borda}`, borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: cor, letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>
                      {label}
                    </span>
                    {falta.justificadoEm && (
                      <span style={{ fontSize: '12px', color: '#555' }}>Submetida em {dataFmt(falta.justificadoEm)}</span>
                    )}
                  </div>
                  <button
                    onClick={abrirPdf}
                    disabled={loadingPdf}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: `1px solid ${borda}`, background: '#fff', color: cor, fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <i className="ti ti-file-type-pdf" />
                    {loadingPdf ? 'A abrir…' : 'Ver Documento'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── TABELA DE FALTAS ─────────────────────────────────────────────────────────
interface TabelaFaltasProps {
  faltas: FaltaDto[];
  token: string;
  mostrarJustificar?: boolean;
  mostrarEliminar?: boolean;
  mostrarValidar?: boolean;
  onJustificar?: (id: string) => void;
  onEliminar?: (id: string) => void;
  onValidar?: (id: string, aprovada: boolean) => void;
}
function TabelaFaltas({ faltas, token, mostrarJustificar, mostrarEliminar, mostrarValidar, onJustificar, onEliminar, onValidar }: TabelaFaltasProps) {
  const [faltaSelecionada, setFaltaSelecionada] = useState<FaltaDto | null>(null);
  if (faltas.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--accent-muted, #aaa)', fontSize: '13px' }}>
        <i className="ti ti-mood-empty" style={{ fontSize: '28px', display: 'block', marginBottom: '10px', opacity: 0.4 }} />
        Sem faltas a apresentar para os critérios selecionados.
      </div>
    );
  }
  const temAcoes = mostrarJustificar || mostrarEliminar || mostrarValidar;
  return (
    <>
    {faltaSelecionada && <ModalDetalheFalta falta={faltaSelecionada} token={token} onClose={() => setFaltaSelecionada(null)} />}
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead style={{ background: '#FAF6F0', color: 'var(--accent-muted, #aaa)' }}>
          <tr>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aluno</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aula</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Motivo</th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estado</th>
            {temAcoes && <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {faltas.map(f => (
            <tr key={f.id} onClick={() => setFaltaSelecionada(f)} style={{ borderTop: '1px solid #F5EFE6', color: 'var(--panel-dark, #3d4f5c)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <td style={{ padding: '12px 14px', fontWeight: 500 }}>{f.utilizadorId?.nome || '—'}</td>
              <td style={{ padding: '12px 14px', color: '#555', fontSize: '12px' }}>{f.aula?.titulo || '—'}</td>
              <td style={{ padding: '12px 14px', color: '#555', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.motivo || '—'}</td>
              <td style={{ padding: '12px 14px' }}><EstadoBadge estado={f.estado} /></td>
              {temAcoes && (
                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    {mostrarJustificar && f.estado === 'PENDENTE' && (
                      <button onClick={() => onJustificar?.(f.id)} style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-warm, #e5dec9)', color: 'var(--panel-dark, #3d4f5c)', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>
                        Justificar
                      </button>
                    )}
                    {mostrarValidar && f.estado === 'PENDENTE' && (
                      <>
                        <button onClick={() => onValidar?.(f.id, true)} style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #A5D6A7', color: '#2E7D32', background: 'rgba(52,168,83,0.08)', cursor: 'pointer', fontWeight: 500 }}>
                          <i className="ti ti-check" /> Aceitar
                        </button>
                        <button onClick={() => onValidar?.(f.id, false)} style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #FFCDD2', color: '#C62828', background: 'rgba(198,40,40,0.06)', cursor: 'pointer', fontWeight: 500 }}>
                          <i className="ti ti-x" /> Recusar
                        </button>
                      </>
                    )}
                    {mostrarEliminar && (
                      <button onClick={() => onEliminar?.(f.id)} style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #eee', color: '#bbb', background: 'transparent', cursor: 'pointer' }} title="Eliminar">
                        <i className="ti ti-trash" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ─── SECÇÃO ALUNO / ENCARREGADO ───────────────────────────────────────────────
function SecaoAluno({ token, role }: { token: string; role: Role }) {
  const [faltas, setFaltas] = useState<FaltaDto[]>([]);
  const [resumo, setResumo] = useState<FaltaResumoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [faltaParaJustificar, setFaltaParaJustificar] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [globalToast, setGlobalToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);

  const mostrarToastGlobal = (msg: string, tipo: 'ok' | 'erro') => {
    setGlobalToast({ msg, tipo });
    setTimeout(() => setGlobalToast(null), 3500);
  };

  const isEncarregado = role === 'ENCARREGADO';

  const carregar = useCallback(async () => {
    const faltasUrl = isEncarregado
      ? `${BASE_URL}/api/faltas/encarregado/educandos/faltas`
      : `${BASE_URL}/api/faltas/meu-perfil/detalhe`;
    const resumoUrl = isEncarregado
      ? `${BASE_URL}/api/faltas/encarregado/educandos/estatisticas`
      : `${BASE_URL}/api/faltas/meu-perfil/estatisticas`;
    try {
      const [rf, rr] = await Promise.all([
        fetch(faltasUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(resumoUrl, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rf.ok) setFaltas(await rf.json());
      if (rr.ok) setResumo(await rr.json());
      setUltimaAtualizacao(new Date());
    } finally { setLoading(false); }
  }, [token, isEncarregado]);

  useEffect(() => {
    carregar();
    intervalRef.current = setInterval(carregar, REFRESH_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [carregar]);

  if (loading) return <p style={{ color: '#aaa', fontSize: '13px' }}>A carregar faltas…</p>;

  return (
    <div style={{ position: 'relative' }}>
      {globalToast && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: globalToast.tipo === 'erro' ? '#C62828' : '#2E7D32', color: '#fff', padding: '12px 24px', borderRadius: '24px', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', zIndex: 500, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className={`ti ti-${globalToast.tipo === 'ok' ? 'circle-check' : 'alert-triangle'}`} />
          {globalToast.msg}
        </div>
      )}
      <ResumoCards resumo={resumo} />
      <div style={{ background: '#FFF', border: '1px solid var(--border-warm, #e5dec9)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5EFE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--panel-dark, #3d4f5c)' }}>
            {isEncarregado ? 'Faltas dos Educandos' : 'As Minhas Faltas'}
          </h3>
          {ultimaAtualizacao && (
            <span style={{ fontSize: '11px', color: '#bbb' }}>
              Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <TabelaFaltas faltas={faltas} token={token} mostrarJustificar onJustificar={id => setFaltaParaJustificar(id)} />
      </div>
      {faltaParaJustificar && (
        <ModalJustificacao faltaId={faltaParaJustificar} token={token} onClose={() => setFaltaParaJustificar(null)} onSuccess={carregar} onToast={mostrarToastGlobal} />
      )}
    </div>
  );
}

// ─── SECÇÃO PROFESSOR ─────────────────────────────────────────────────────────
function SecaoProfessor({ token, professorId }: { token: string; professorId: string }) {
  const [tab, setTab] = useState<'marcar' | 'historico'>('marcar');

  // Aulas (pageable)
  const [aulas, setAulas] = useState<AulaDto[]>([]);
  const [paginaAulas, setPaginaAulas] = useState(0);
  const [totalPaginasAulas, setTotalPaginasAulas] = useState(1);
  const [loadingAulas, setLoadingAulas] = useState(false);

  // Chamada
  const [aulaExpandidaId, setAulaExpandidaId] = useState<string | null>(null);
  const [alunosDaAula, setAlunosDaAula] = useState<AlunoResumoDto[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [alunosSelecionados, setAlunosSelecionados] = useState<Set<string>>(new Set());
  const [alunosComFalta, setAlunosComFalta] = useState<Set<string>>(new Set());
  const [motivoGlobal, setMotivoGlobal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erroLocal, setErroLocal] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Histórico
  const [faltas, setFaltas] = useState<FaltaDto[]>([]);
  const [resumo, setResumo] = useState<FaltaResumoDto | null>(null);
  const [faltaParaJustificar, setFaltaParaJustificar] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [globalToast, setGlobalToast] = useState<{ msg: string; tipo: 'ok' | 'erro' } | null>(null);

  const mostrarToastGlobal = (msg: string, tipo: 'ok' | 'erro') => {
    setGlobalToast({ msg, tipo });
    setTimeout(() => setGlobalToast(null), 3500);
  };

  const carregarAulas = useCallback(async (pagina: number) => {
    setLoadingAulas(true);
    try {
      const res = await fetch(`${BASE_URL}/api/horario/professor/todasaulasPassadas?page=${pagina}&size=6&sort=dataAula,desc`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Suporta tanto Page<AulaDto> como List<AulaDto> simples
        if (Array.isArray(data)) {
          setAulas(data);
          setTotalPaginasAulas(1);
          setPaginaAulas(0);
        } else {
          setAulas(data.content ?? []);
          setTotalPaginasAulas(data.totalPages ?? 1);
          setPaginaAulas(data.number ?? pagina);
        }
      }
    } finally { setLoadingAulas(false); }
  }, [token]);

  const carregarHistorico = useCallback(async () => {
    const [rf, rr] = await Promise.all([
      fetch(`${BASE_URL}/api/faltas/meu-perfil/detalhe`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BASE_URL}/api/faltas/meu-perfil/estatisticas`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (rf.ok) setFaltas(await rf.json());
    if (rr.ok) setResumo(await rr.json());
    setUltimaAtualizacao(new Date());
  }, [token]);

  useEffect(() => {
    carregarAulas(0);
    carregarHistorico();
    intervalRef.current = setInterval(() => {
      carregarAulas(paginaAulas);
      carregarHistorico();
    }, REFRESH_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [carregarAulas, carregarHistorico]);

  const handleToggleAula = async (aulaId: string) => {
    setErroLocal(''); setSuccessMsg('');
    if (aulaExpandidaId === aulaId) {
      setAulaExpandidaId(null); setAlunosDaAula([]); setAlunosSelecionados(new Set()); setAlunosComFalta(new Set());
      return;
    }
    setAulaExpandidaId(aulaId); setAlunosDaAula([]); setAlunosSelecionados(new Set()); setAlunosComFalta(new Set());
    setLoadingAlunos(true);
    try {
      const [resAlunos, resFaltas] = await Promise.all([
        fetch(`${BASE_URL}/api/horario/${aulaId}/alunos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE_URL}/api/faltas/professor/${aulaId}/faltas`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (resAlunos.ok) setAlunosDaAula(await resAlunos.json());
      else setErroLocal('Não foi possível carregar os alunos desta turma.');
      if (resFaltas.ok) {

        const faltas: FaltaDto[] = await resFaltas.json();
          setAlunosComFalta(
            new Set(
              faltas
                .map(f =>
                  typeof f.utilizadorId === "object"
                    ? f.utilizadorId?.id
                    : f.utilizadorId
                )
                .filter((id): id is string => Boolean(id))
            )
          );
          
      }
    } catch { setErroLocal('Erro de rede.'); }
    finally { setLoadingAlunos(false); }
  };

  const toggleAluno = (id: string) => {
    setAlunosSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSubmeterFaltas = async (aulaId: string) => {
    if (alunosSelecionados.size === 0) { setErroLocal('Selecione pelo menos um aluno.'); return; }
    setSubmitting(true); setErroLocal('');
    const requests = Array.from(alunosSelecionados).map(idAluno =>
      fetch(`${BASE_URL}/api/faltas/marcar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aulaId, utilizadorId: idAluno, motivo: motivoGlobal || 'Falta marcada na chamada.', justificado: false }),
      })
    );
    try {
      const results = await Promise.all(requests);
      const falhou = results.filter(r => !r.ok);
      if (falhou.length === 0) {
        setSuccessMsg(`${alunosSelecionados.size} falta(s) registada(s) com sucesso!`);
        setAulaExpandidaId(null); setAlunosDaAula([]); setAlunosSelecionados(new Set()); setMotivoGlobal('');
        carregarHistorico();
      } else { setErroLocal(`${falhou.length} falta(s) não puderam ser registadas.`); }
    } catch { setErroLocal('Erro de rede.'); }
    finally { setSubmitting(false); }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: active ? 600 : 400,
    background: active ? 'var(--panel-dark, #3d4f5c)' : 'transparent',
    color: active ? '#ffffff' : '#888',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ position: 'relative' }}>
      {globalToast && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: globalToast.tipo === 'erro' ? '#C62828' : '#2E7D32', color: '#fff', padding: '12px 24px', borderRadius: '24px', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', zIndex: 500, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className={`ti ti-${globalToast.tipo === 'ok' ? 'circle-check' : 'alert-triangle'}`} />
          {globalToast.msg}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button style={{ padding: '10px 22px', borderRadius: '8px', border: tab === 'marcar' ? 'none' : '1px solid var(--border-warm, #e5dec9)', cursor: 'pointer', fontSize: '13px', fontWeight: tab === 'marcar' ? 600 : 500, background: tab === 'marcar' ? 'var(--panel-dark, #3d4f5c)' : '#fff', color: tab === 'marcar' ? '#ffffff' : '#555', transition: 'all 0.2s', boxShadow: tab === 'marcar' ? '0 2px 8px rgba(61,79,92,0.25)' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setTab('marcar')}><i className="ti ti-edit" />Marcar Faltas</button>
        <button style={{ padding: '10px 22px', borderRadius: '8px', border: tab === 'historico' ? 'none' : '1px solid var(--border-warm, #e5dec9)', cursor: 'pointer', fontSize: '13px', fontWeight: tab === 'historico' ? 600 : 500, background: tab === 'historico' ? 'var(--panel-dark, #3d4f5c)' : '#fff', color: tab === 'historico' ? '#ffffff' : '#555', transition: 'all 0.2s', boxShadow: tab === 'historico' ? '0 2px 8px rgba(61,79,92,0.25)' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setTab('historico')}><i className="ti ti-list" />Histórico</button>
      </div>

      {/* TAB MARCAR */}
      {tab === 'marcar' && (
        <div style={{ background: '#FFF', border: '1px solid var(--border-warm, #e5dec9)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5EFE6' }}>
            <p style={{ margin: '0 0 2px', fontSize: '10px', letterSpacing: '2px', color: 'var(--accent-muted, #aaa)' }}>CHAMADA DE ALUNOS</p>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, fontFamily: 'var(--font-playfair, Georgia, serif)', color: 'var(--panel-dark, #3d4f5c)' }}>As Minhas Aulas</h3>
          </div>

          {successMsg && (
            <div style={{ margin: '16px 20px', background: 'rgba(52,168,83,0.08)', border: '1px solid #A5D6A7', color: '#2E7D32', padding: '10px 14px', borderRadius: '6px', fontSize: '13px' }}>
              <i className="ti ti-circle-check" style={{ marginRight: 6 }} />{successMsg}
            </div>
          )}

          <div style={{ padding: '16px 20px' }}>
            {loadingAulas ? (
              <p style={{ color: '#aaa', fontSize: '13px' }}>A carregar aulas…</p>
            ) : aulas.length === 0 ? (
              <p style={{ color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>Nenhuma aula encontrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aulas.map(aula => {
                  const expandida = aulaExpandidaId === aula.id;
                  return (
                    <div key={aula.id} style={{ border: expandida ? '1px solid var(--panel-dark, #3d4f5c)' : '1px solid var(--border-warm, #e5dec9)', borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                      {/* Header */}
                      <div onClick={() => handleToggleAula(aula.id)} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: expandida ? '#FAF6F0' : '#fff', transition: 'background 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ background: 'var(--panel-dark, #3d4f5c)', color: '#ffffff', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }}>
                            {aula.estudio?.nome || 'Estúdio'}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--panel-dark, #3d4f5c)' }}>
                            {aula.titulo || 'Aula'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#bbb' }}>{fmtData(aula.dataAula)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>{fmtHora(aula.horaInicio)} – {fmtHora(aula.horaFim)}</span>
                          <i className={`ti ti-chevron-${expandida ? 'up' : 'down'}`} style={{ color: '#aaa', fontSize: '14px' }} />
                        </div>
                      </div>

                      {/* Painel de chamada */}
                      {expandida && (
                        <div style={{ padding: '18px', borderTop: '1px solid #F5EFE6' }}>
                          <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-muted, #aaa)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Selecione os alunos ausentes:
                          </p>
                          {loadingAlunos ? (
                            <p style={{ color: '#aaa', fontSize: '13px' }}>A carregar alunos…</p>
                          ) : alunosDaAula.length === 0 ? (
                            <p style={{ color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>Nenhum aluno matriculado nesta turma.</p>
                          ) : (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                                {alunosDaAula.map(aluno => {
                                  const sel = alunosSelecionados.has(aluno.id);
                                  const jaTemFalta = alunosComFalta.has(aluno.id);
                                  return (
                                    <div
                                      key={aluno.id}
                                      onClick={() => !jaTemFalta && toggleAluno(aluno.id)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '10px 14px',
                                        border: jaTemFalta ? '1px solid #FFCDD2' : sel ? '1px solid var(--panel-dark, #3d4f5c)' : '1px solid var(--border-warm, #e5dec9)',
                                        borderRadius: '6px',
                                        background: jaTemFalta ? '#FFF5F5' : sel ? '#FAF6F0' : '#FAFAF8',
                                        cursor: jaTemFalta ? 'default' : 'pointer',
                                        transition: 'all 0.15s',
                                        userSelect: 'none',
                                        opacity: jaTemFalta ? 0.75 : 1,
                                      }}
                                    >
                                      <div style={{
                                        width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                                        border: jaTemFalta ? '2px solid #EF9A9A' : sel ? '2px solid var(--panel-dark, #3d4f5c)' : '2px solid #ddd',
                                        background: jaTemFalta ? '#FFCDD2' : sel ? 'var(--panel-dark, #3d4f5c)' : '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.15s',
                                      }}>
                                        {jaTemFalta && <i className="ti ti-alert-triangle" style={{ color: '#C62828', fontSize: '11px' }} />}
                                        {!jaTemFalta && sel && <i className="ti ti-check" style={{ color: '#ffffff', fontSize: '12px' }} />}
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '13px', color: jaTemFalta ? '#C62828' : sel ? 'var(--panel-dark, #3d4f5c)' : '#666', fontWeight: sel || jaTemFalta ? 500 : 400 }}>
                                          {aluno.nome}
                                        </span>
                                        {jaTemFalta && <span style={{ fontSize: '10px', color: '#EF5350', letterSpacing: '0.3px' }}>Falta já registada</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <input
                                type="text"
                                value={motivoGlobal}
                                onChange={e => setMotivoGlobal(e.target.value)}
                                placeholder="Observação / motivo opcional (aplica-se a todos os selecionados)…"
                                style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--border-warm, #e5dec9)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', color: '#333', outline: 'none', marginBottom: '14px' }}
                              />

                              {erroLocal && (
                                <div style={{ background: 'rgba(198,40,40,0.06)', border: '1px solid #FFCDD2', color: '#C62828', padding: '8px 14px', borderRadius: '5px', fontSize: '12px', marginBottom: '12px' }}>
                                  ⚠ {erroLocal}
                                </div>
                              )}

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #F5EFE6' }}>
                                <span style={{ fontSize: '12px', color: '#aaa' }}>
                                  {alunosSelecionados.size === 0 ? 'Nenhum aluno selecionado' : `${alunosSelecionados.size} ausente(s) marcado(s)`}
                                </span>
                                <button
                                  onClick={() => handleSubmeterFaltas(aula.id)}
                                  disabled={submitting || alunosSelecionados.size === 0}
                                  style={{
                                    padding: '9px 22px', borderRadius: '6px', border: 'none',
                                    background: alunosSelecionados.size === 0 ? '#F5EFE6' : 'var(--panel-dark, #3d4f5c)',
                                    color: alunosSelecionados.size === 0 ? '#bbb' : '#ffffff',
                                    cursor: alunosSelecionados.size === 0 ? 'not-allowed' : 'pointer',
                                    fontSize: '13px', fontWeight: 500,
                                  }}
                                >
                                  {submitting ? 'A registar…' : 'Registar Chamada'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginação */}
            {totalPaginasAulas > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                <button onClick={() => carregarAulas(paginaAulas - 1)} disabled={paginaAulas === 0} style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid var(--border-warm, #e5dec9)', background: 'transparent', cursor: paginaAulas === 0 ? 'not-allowed' : 'pointer', color: paginaAulas === 0 ? '#ccc' : 'var(--panel-dark, #3d4f5c)', fontSize: '13px' }}>
                  ← Anterior
                </button>
                <span style={{ fontSize: '12px', color: '#aaa' }}>Página {paginaAulas + 1} de {totalPaginasAulas}</span>
                <button onClick={() => carregarAulas(paginaAulas + 1)} disabled={paginaAulas >= totalPaginasAulas - 1} style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid var(--border-warm, #e5dec9)', background: 'transparent', cursor: paginaAulas >= totalPaginasAulas - 1 ? 'not-allowed' : 'pointer', color: paginaAulas >= totalPaginasAulas - 1 ? '#ccc' : 'var(--panel-dark, #3d4f5c)', fontSize: '13px' }}>
                  Seguinte →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB HISTÓRICO */}
      {tab === 'historico' && (
        <div>
          <ResumoCards resumo={resumo} />
          <div style={{ background: '#FFF', border: '1px solid var(--border-warm, #e5dec9)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5EFE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--panel-dark, #3d4f5c)' }}>As Minhas Faltas</h3>
              {ultimaAtualizacao && <span style={{ fontSize: '11px', color: '#bbb' }}>Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            <TabelaFaltas faltas={faltas} token={token} mostrarJustificar onJustificar={id => setFaltaParaJustificar(id)} />
          </div>
        </div>
      )}

      {faltaParaJustificar && (
        <ModalJustificacao faltaId={faltaParaJustificar} token={token} onClose={() => setFaltaParaJustificar(null)} onSuccess={carregarHistorico} onToast={mostrarToastGlobal} />
      )}
    </div>
  );
}

// ─── MODAL MARCAR FALTA (COORDENAÇÃO) ────────────────────────────────────────
interface ModalMarcarFaltaCoordenacaoProps {
  utilizador: { id: string; nome: string };
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}
function ModalMarcarFaltaCoordenacao({ utilizador, token, onClose, onSuccess }: ModalMarcarFaltaCoordenacaoProps) {
  const [dataEscolhida, setDataEscolhida] = useState('');
  const [aulas, setAulas] = useState<AulaDto[]>([]);
  const [loadingAulas, setLoadingAulas] = useState(false);
  const [aulaEscolhida, setAulaEscolhida] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const buscarAulasDoDia = async (data: string) => {
    if (!data) return;
    setLoadingAulas(true);
    setAulas([]);
    setAulaEscolhida(null);
    setErro('');
    try {
      const res = await fetch(`${BASE_URL}/api/horario/aulas/por-data?data=${data}&utilizadorId=${utilizador.id}&size=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setAulas(Array.isArray(d) ? d : (d.content ?? []));
      } else {
        setErro('Não foi possível carregar as aulas deste dia.');
      }
    } catch { setErro('Erro de rede.'); }
    finally { setLoadingAulas(false); }
  };

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDataEscolhida(e.target.value);
    buscarAulasDoDia(e.target.value);
  };

  const handleMarcar = async () => {
    if (!aulaEscolhida) { setErro('Selecione uma aula.'); return; }
    setSubmitting(true); setErro('');
    try {
      const res = await fetch(`${BASE_URL}/api/faltas/marcar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ aulaId: aulaEscolhida, utilizadorId: utilizador.id, motivo: motivo || 'Falta marcada pela coordenação.', justificado: false }),
      });
      if (res.ok) {
        setSucesso('Falta marcada com sucesso!');
        setTimeout(() => { onSuccess(); onClose(); }, 1200);
      } else {
        const t = await res.text();
        setErro(t || 'Erro ao marcar falta.');
      }
    } catch { setErro('Erro de rede.'); }
    finally { setSubmitting(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 14px', border: '1px solid var(--border-warm, #e5dec9)',
    borderRadius: '6px', fontSize: '13px', outline: 'none', backgroundColor: '#FFF',
    color: 'var(--panel-dark, #3d4f5c)', fontFamily: 'inherit', boxSizing: 'border-box',
    boxShadow: 'rgba(0,0,0,0.02) 0px 1px 3px 0px, rgba(27,31,35,0.15) 0px 0px 0px 1px inset',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(24,23,21,0.5)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', background: '#fff', borderRadius: '12px', padding: '30px', width: '500px', maxWidth: '95vw', border: '1px solid var(--border-warm, #e5dec9)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '5px', background: 'var(--panel-dark, #3d4f5c)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '10px', letterSpacing: '2px', color: '#aaa' }}>COORDENAÇÃO</p>
            <h2 style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', fontSize: '20px', margin: 0, color: 'var(--panel-dark, #3d4f5c)', fontWeight: 400 }}>
              Marcar Falta
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#aaa', lineHeight: 1 }}>✕</button>
        </div>

        {/* Utilizador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#FAF6F0', borderRadius: '6px', marginBottom: '20px', marginTop: '16px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--panel-dark, #3d4f5c)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
            {utilizador.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--panel-dark, #3d4f5c)' }}>{utilizador.nome}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#aaa' }}>Utilizador selecionado</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Data */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#888', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              Dia da aula
            </label>
            <input type="date" value={dataEscolhida} onChange={handleDataChange} style={inputStyle} />
          </div>

          {/* Lista de aulas do dia */}
          {dataEscolhida && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#888', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                Aulas de {new Date(dataEscolhida + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' })}
              </label>
              {loadingAulas ? (
                <p style={{ color: '#aaa', fontSize: '13px', padding: '12px 0' }}>A carregar aulas…</p>
              ) : aulas.length === 0 ? (
                <p style={{ color: '#bbb', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>Nenhuma aula encontrada neste dia.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {aulas.map(aula => {
                    const sel = aulaEscolhida === aula.id;
                    return (
                      <div
                        key={aula.id}
                        onClick={() => setAulaEscolhida(aula.id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 14px', borderRadius: '6px', cursor: 'pointer',
                          border: sel ? '1px solid var(--panel-dark, #3d4f5c)' : '1px solid var(--border-warm, #e5dec9)',
                          background: sel ? '#F5F2EE' : '#FAFAF8',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#F5EFE6'; }}
                        onMouseLeave={e => { if (!sel) e.currentTarget.style.background = '#FAFAF8'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                            border: sel ? '2px solid var(--panel-dark, #3d4f5c)' : '2px solid #ddd',
                            background: sel ? 'var(--panel-dark, #3d4f5c)' : '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {sel && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff' }} />}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: sel ? 600 : 400, color: 'var(--panel-dark, #3d4f5c)' }}>
                              {aula.titulo || 'Aula sem título'}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#aaa' }}>
                              {aula.estudio?.nome && `${aula.estudio.nome} · `}{fmtHora(aula.horaInicio)} – {fmtHora(aula.horaFim)}
                            </p>
                          </div>
                        </div>
                        {sel && <i className="ti ti-circle-check" style={{ color: 'var(--panel-dark, #3d4f5c)', fontSize: '16px' }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Motivo opcional */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#888', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              Observação <span style={{ color: '#bbb', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
            </label>
            <input
              type="text"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Motivo ou observação…"
              style={inputStyle}
            />
          </div>

          {erro && <p style={{ color: '#C62828', fontSize: '12px', margin: 0 }}>⚠ {erro}</p>}
          {sucesso && (
            <div style={{ background: 'rgba(52,168,83,0.08)', border: '1px solid #A5D6A7', color: '#2E7D32', padding: '8px 14px', borderRadius: '5px', fontSize: '12px' }}>
              <i className="ti ti-circle-check" style={{ marginRight: 6 }} />{sucesso}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ padding: '10px 18px', border: '1px solid var(--border-warm, #e5dec9)', background: 'transparent', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--panel-dark, #3d4f5c)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              onClick={handleMarcar}
              disabled={submitting || !aulaEscolhida}
              style={{
                background: !aulaEscolhida ? '#F5EFE6' : 'var(--panel-dark, #3d4f5c)',
                color: !aulaEscolhida ? '#bbb' : '#ffffff',
                border: 'none', padding: '10px 22px', borderRadius: '6px',
                fontSize: '13px', fontWeight: 500,
                cursor: !aulaEscolhida ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'A registar…' : 'Marcar Falta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SECÇÃO COORDENAÇÃO ───────────────────────────────────────────────────────
function SecaoCoordenacao({ token }: { token: string }) {
  const [tab, setTab] = useState<'todas' | 'pendentes' | 'utilizador'>('todas');

  // Lista geral
  const [todasAsFaltas, setTodasAsFaltas] = useState<FaltaDto[]>([]);
  const [faltasExibidas, setFaltasExibidas] = useState<FaltaDto[]>([]);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pesquisa por nome (igual ao pagamentos)
  const [pesquisaNome, setPesquisaNome] = useState('');

  // Por utilizador
  const [faltasUtilizador, setFaltasUtilizador] = useState<FaltaDto[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [erroUser, setErroUser] = useState('');

  // Pesquisa de utilizadores com sugestões (igual ao pagamentos)
  const [inputNomeUtilizador, setInputNomeUtilizador] = useState('');
  const [utilizadoresLista, setUtilizadoresLista] = useState<{ id: string; nome: string }[]>([]);
  const [sugestoesUtilizador, setSugestoesUtilizador] = useState<{ id: string; nome: string }[]>([]);
  const [utilizadorSelecionado, setUtilizadorSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const sugestoesRef = useRef<HTMLUListElement>(null);
  const [modalMarcarFalta, setModalMarcarFalta] = useState(false);

  const SIZE = 10;

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sugestoesRef.current && !sugestoesRef.current.contains(e.target as Node)) {
        setSugestoesUtilizador([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Carregar lista de utilizadores uma vez
  useEffect(() => {
    fetch(`${BASE_URL}/api/utilizadores?size=200`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const lista = d?.content || (Array.isArray(d) ? d : []);
        setUtilizadoresLista(lista.map((u: any) => ({ id: u.id, nome: u.nome || u.username || 'Sem nome' })));
      })
      .catch(() => {});
  }, [token]);

  const filtrarSugestoes = (texto: string) => {
    setInputNomeUtilizador(texto);
    setUtilizadorSelecionado(null);
    if (texto.trim() === '') { setSugestoesUtilizador([]); return; }
    const termo = texto.toLowerCase();
    setSugestoesUtilizador(utilizadoresLista.filter(u => u.nome.toLowerCase().includes(termo)).slice(0, 8));
  };

  const selecionarUtilizador = (u: { id: string; nome: string }) => {
    setUtilizadorSelecionado(u);
    setInputNomeUtilizador(u.nome);
    setSugestoesUtilizador([]);
  };

  const carregarFaltas = useCallback(async (tipo: 'todas' | 'pendentes') => {
    setLoading(true);
    const endpoint = tipo === 'pendentes' ? `${BASE_URL}/api/faltas/pendentes` : `${BASE_URL}/api/faltas`;
    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const lista: FaltaDto[] = Array.isArray(data) ? data : (data.content ?? []);
        setTodasAsFaltas(lista);
        setTotalPaginas(Math.ceil(lista.length / SIZE) || 1);
        setPagina(0);
        setUltimaAtualizacao(new Date());
      }
    } finally { setLoading(false); }
  }, [token]);

  // Filtro por nome (client-side, igual ao pagamentos)
  useEffect(() => {
    let lista = [...todasAsFaltas];
    if (pesquisaNome.trim()) {
      const t = pesquisaNome.toLowerCase().trim();
      lista = lista.filter(f =>
        f.utilizadorId?.nome?.toLowerCase().includes(t) ||
        f.aula?.titulo?.toLowerCase().includes(t) ||
        f.motivo?.toLowerCase().includes(t)
      );
    }
    setTotalPaginas(Math.ceil(lista.length / SIZE) || 1);
    setFaltasExibidas(lista.slice(pagina * SIZE, (pagina + 1) * SIZE));
  }, [todasAsFaltas, pesquisaNome, pagina]);

  useEffect(() => {
    if (tab === 'todas' || tab === 'pendentes') {
      carregarFaltas(tab);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => carregarFaltas(tab), REFRESH_INTERVAL_MS);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tab, carregarFaltas]);

  const handleBuscarUtilizador = async () => {
    if (!utilizadorSelecionado) return;
    setLoadingUser(true); setErroUser(''); setFaltasUtilizador([]);
    try {
      const res = await fetch(`${BASE_URL}/api/faltas/utilizador/${utilizadorSelecionado.id}/detalhe`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setFaltasUtilizador(await res.json());
      else setErroUser('Não foi possível obter as faltas deste utilizador.');
    } catch { setErroUser('Erro de rede.'); }
    finally { setLoadingUser(false); }
  };

  const handleValidar = async (id: string, aprovada: boolean) => {
    await fetch(`${BASE_URL}/api/faltas/${id}/validar?aprovada=${aprovada}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    });
    if (tab === 'todas' || tab === 'pendentes') carregarFaltas(tab);
    if (tab === 'utilizador' && utilizadorSelecionado) handleBuscarUtilizador();
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar permanentemente esta falta?')) return;
    await fetch(`${BASE_URL}/api/faltas/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (tab === 'todas' || tab === 'pendentes') carregarFaltas(tab);
    if (tab === 'utilizador' && utilizadorSelecionado) handleBuscarUtilizador();
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: active ? 600 : 400,
    background: active ? 'var(--panel-dark, #3d4f5c)' : 'transparent',
    color: active ? '#ffffff' : '#888',
    transition: 'all 0.2s',
  });

  const estiloInput: React.CSSProperties = {
    padding: '7px 12px', border: '1px solid var(--border-warm, #e5dec9)',
    borderRadius: '4px', fontSize: '13px', outline: 'none',
    color: 'var(--panel-dark, #3d4f5c)', background: '#fff',
    boxShadow: 'rgba(0,0,0,0.02) 0px 1px 3px 0px, rgba(27,31,35,0.15) 0px 0px 0px 1px inset',
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', background: '#F5EFE6', padding: '4px', borderRadius: '8px', marginBottom: '24px', width: 'fit-content' }}>
        <button style={tabStyle(tab === 'todas')} onClick={() => setTab('todas')}><i className="ti ti-list" style={{ marginRight: 6 }} />Todas</button>
        <button style={tabStyle(tab === 'pendentes')} onClick={() => setTab('pendentes')}><i className="ti ti-clock" style={{ marginRight: 6 }} />Pendentes</button>
        <button style={tabStyle(tab === 'utilizador')} onClick={() => setTab('utilizador')}><i className="ti ti-user-search" style={{ marginRight: 6 }} />Por Utilizador</button>
      </div>

      {/* TODAS / PENDENTES */}
      {(tab === 'todas' || tab === 'pendentes') && (
        <div style={{ background: '#FFF', border: '1px solid var(--border-warm, #e5dec9)', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Header com pesquisa */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5EFE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontSize: '10px', letterSpacing: '2px', color: 'var(--accent-muted, #aaa)' }}>
                {tab === 'pendentes' ? 'AGUARDAM VALIDAÇÃO' : 'REGISTO COMPLETO'}
              </p>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 400, fontFamily: 'var(--font-playfair, Georgia, serif)', color: 'var(--panel-dark, #3d4f5c)' }}>
                {tab === 'pendentes' ? 'Faltas Pendentes' : 'Todas as Faltas'}
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '420px', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: '14px', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, aula ou motivo…"
                  value={pesquisaNome}
                  onChange={e => { setPesquisaNome(e.target.value); setPagina(0); }}
                  style={{ ...estiloInput, width: '100%', boxSizing: 'border-box', paddingLeft: '36px', paddingRight: pesquisaNome ? '36px' : '12px', borderRadius: '8px', fontSize: '13px', height: '38px' }}
                />
                {pesquisaNome && (
                  <button onClick={() => { setPesquisaNome(''); setPagina(0); }} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '14px', lineHeight: 1, padding: '2px' }}>✕</button>
                )}
              </div>
              {ultimaAtualizacao && (
                <span style={{ fontSize: '11px', color: '#bbb', whiteSpace: 'nowrap' }}>
                  {ultimaAtualizacao.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <p style={{ padding: '20px', color: '#aaa', fontSize: '13px' }}>A carregar…</p>
          ) : (
            <TabelaFaltas faltas={faltasExibidas} token={token} mostrarValidar mostrarEliminar onValidar={handleValidar} onEliminar={handleEliminar} />
          )}

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '16px', borderTop: '1px solid #F5EFE6' }}>
              <button onClick={() => setPagina(p => p - 1)} disabled={pagina === 0} style={{ padding: '5px 16px', borderRadius: '4px', border: '1px solid var(--border-warm, #e5dec9)', background: 'transparent', cursor: pagina === 0 ? 'not-allowed' : 'pointer', color: pagina === 0 ? '#ccc' : 'var(--panel-dark, #3d4f5c)', fontSize: '13px' }}>
                ← Anterior
              </button>
              <span style={{ fontSize: '12px', color: '#aaa' }}>Página {pagina + 1} de {totalPaginas}</span>
              <button onClick={() => setPagina(p => p + 1)} disabled={pagina >= totalPaginas - 1} style={{ padding: '5px 16px', borderRadius: '4px', border: '1px solid var(--border-warm, #e5dec9)', background: 'transparent', cursor: pagina >= totalPaginas - 1 ? 'not-allowed' : 'pointer', color: pagina >= totalPaginas - 1 ? '#ccc' : 'var(--panel-dark, #3d4f5c)', fontSize: '13px' }}>
                Seguinte →
              </button>
            </div>
          )}
        </div>
      )}

      {/* POR UTILIZADOR */}
      {tab === 'utilizador' && (
        <div style={{ background: '#FFF', border: '1px solid var(--border-warm, #e5dec9)', borderRadius: '8px', overflow: 'visible' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5EFE6' }}>
            <p style={{ margin: '0 0 2px', fontSize: '10px', letterSpacing: '2px', color: 'var(--accent-muted, #aaa)' }}>PESQUISA INDIVIDUAL</p>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 400, fontFamily: 'var(--font-playfair, Georgia, serif)', color: 'var(--panel-dark, #3d4f5c)' }}>Consultar por Utilizador</h3>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '220px' }}>
                <label style={{ fontSize: '10px', color: 'var(--accent-muted, #aaa)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pesquisar utilizador / conteúdo</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Escreva para pesquisar…"
                    value={inputNomeUtilizador}
                    onChange={e => filtrarSugestoes(e.target.value)}
                    autoComplete="off"
                    style={{
                      ...estiloInput,
                      width: '100%',
                      boxSizing: 'border-box',
                      borderColor: utilizadorSelecionado ? '#2E7D32' : 'var(--border-warm, #e5dec9)',
                      paddingRight: utilizadorSelecionado ? '90px' : '12px',
                    }}
                  />
                  {utilizadorSelecionado && (
                    <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', background: 'rgba(52,168,83,0.1)', color: '#2E7D32', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.3px' }}>
                      ✓ SELECIONADO
                    </span>
                  )}
                  {sugestoesUtilizador.length > 0 && (
                    <ul ref={sugestoesRef} style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid var(--border-warm, #e5dec9)', borderRadius: '6px', zIndex: 300, maxHeight: '180px', overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                      {sugestoesUtilizador.map(u => (
                        <li key={u.id} onMouseDown={() => selecionarUtilizador(u)} style={{ padding: '9px 14px', fontSize: '13px', cursor: 'pointer', color: 'var(--panel-dark, #3d4f5c)' }} onMouseEnter={e => (e.currentTarget.style.background = '#FAF6F0')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                          {u.nome}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button
                onClick={handleBuscarUtilizador}
                disabled={!utilizadorSelecionado || loadingUser}
                style={{
                  padding: '9px 22px', borderRadius: '6px', border: 'none',
                  background: !utilizadorSelecionado ? '#F5EFE6' : 'var(--panel-dark, #3d4f5c)',
                  color: !utilizadorSelecionado ? '#bbb' : '#ffffff',
                  cursor: !utilizadorSelecionado ? 'not-allowed' : 'pointer',
                  fontSize: '13px', fontWeight: 500,
                }}
              >
                {loadingUser ? 'A pesquisar…' : 'Ver Faltas'}
              </button>
              <button
                onClick={() => setModalMarcarFalta(true)}
                disabled={!utilizadorSelecionado}
                style={{
                  padding: '9px 22px', borderRadius: '6px', border: 'none',
                  background: !utilizadorSelecionado ? '#F5EFE6' : '#C62828',
                  color: !utilizadorSelecionado ? '#bbb' : '#fff',
                  cursor: !utilizadorSelecionado ? 'not-allowed' : 'pointer',
                  fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <i className="ti ti-user-x" />
                Marcar Falta
              </button>
            </div>
            {erroUser && <p style={{ color: '#C62828', fontSize: '12px', marginTop: '10px', marginBottom: 0 }}>⚠ {erroUser}</p>}
          </div>

          {faltasUtilizador.length > 0 && (
            <TabelaFaltas faltas={faltasUtilizador} token={token} mostrarValidar mostrarEliminar onValidar={handleValidar} onEliminar={handleEliminar} />
          )}
          {!loadingUser && faltasUtilizador.length === 0 && !erroUser && utilizadorSelecionado && (
            <p style={{ padding: '24px 20px', color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>Nenhuma falta registada para este utilizador.</p>
          )}
        </div>
      )}

      {modalMarcarFalta && utilizadorSelecionado && (
        <ModalMarcarFaltaCoordenacao
          utilizador={utilizadorSelecionado}
          token={token}
          onClose={() => setModalMarcarFalta(false)}
          onSuccess={() => { setModalMarcarFalta(false); handleBuscarUtilizador(); }}
        />
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function GestaoFaltasPage() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [token, setToken] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const raw = localStorage.getItem('user');
    const t = localStorage.getItem('token') ?? '';
    setToken(t);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUserName(parsed.nome ?? '');
        setUserId(parsed.id ?? '');
        setRole((parsed.tipoUtilizadorId as Role) ?? null);
      } catch {}
    }
  }, []);

  if (!isMounted) return <p style={{ padding: '32px', color: '#aaa', fontSize: '13px' }}>A ler configurações…</p>;

  const initials = userName ? userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() : 'U';

  const roleLabel: Record<Role, string> = {
    ALUNO: 'Aluno', PROFESSOR: 'Professor', ENCARREGADO: 'Encarregado', COORDENACAO: 'Coordenação',
  };

  const descricaoRole: Record<Role, string> = {
    ALUNO: 'Consulte e justifique as suas faltas.',
    PROFESSOR: 'Faça a chamada das suas aulas e consulte o seu histórico.',
    ENCARREGADO: 'Consulte e justifique as faltas dos seus educandos.',
    COORDENACAO: 'Valide justificações e gira todas as faltas do sistema.',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F5EFE6', fontFamily: 'var(--font-lato, sans-serif)' }}>
  
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* CONTEÚDO */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--accent-muted, #aaa)', margin: '0 0 4px' }}>GESTÃO ESCOLAR</p>
            <h1 style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', fontSize: '28px', color: 'var(--panel-dark, #3d4f5c)', margin: '0 0 6px', fontWeight: 400 }}>
              Gestão de Faltas
            </h1>
            {role && <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent-muted, #aaa)' }}>{descricaoRole[role]}</p>}
          </div>

          {(role === 'ALUNO' || role === 'ENCARREGADO') && <SecaoAluno token={token} role={role} />}
          {role === 'PROFESSOR' && <SecaoProfessor token={token} professorId={userId} />}
          {role === 'COORDENACAO' && <SecaoCoordenacao token={token} />}
          {!role && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#bbb', fontSize: '14px' }}>
              Perfil não identificado. Por favor, faça login novamente.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}