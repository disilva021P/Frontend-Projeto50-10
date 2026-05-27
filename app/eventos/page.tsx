'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Evento {
  id: string; 
  nome: string;
  descricao: string;
  dataEvento: string;
  horaInicio: string;
  horaFim: string;
  local: string;
  criadoPor: {
    id: string;
    nome: string;
  };
}

export default function EventosPage() {
    const [eventos, setEventos] = useState<Evento[]>([]);
    const [meusEventosIds, setMeusEventosIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroMeus, setFiltroMeus] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);
    const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

    // 1. Identificar o utilizador logado através do token
    useEffect(() => {
        const carregarPerfil = () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
            // Decodifica o JWT para extrair o ID (sub)
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUsuarioLogado({ id: payload.sub });
            }
        } catch (err) {
            console.error("Erro ao identificar utilizador", err);
        }
        };
        carregarPerfil();
    }, []);

    // 2. Carregar todos os eventos futuros (GET /api/eventos)
    const carregarEventos = async () => {
        setLoading(true);
        try {
        const response = await api.get<Evento[]>('/eventos');
        setEventos(response.data);
        } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        } finally {
        setLoading(false);
        }
    };

    // 3. Carregar as inscrições do utilizador (GET /api/eventos/utilizador/{id})
    const carregarInscricoes = async () => {
        if (!usuarioLogado?.id) return;
        try {
        const response = await api.get<Evento[]>(`/eventos/utilizador/${usuarioLogado.id}`);
        // Guardamos apenas os IDs para facilitar a verificação nos cards
        setMeusEventosIds(response.data.map(e => e.id));
        } catch (error) {
        console.error('Erro ao carregar inscrições:', error);
        }
    };

    useEffect(() => {
        carregarEventos();
    }, []);

    useEffect(() => {
        if (usuarioLogado) carregarInscricoes();
    }, [usuarioLogado]);

    // 4. Lógica de Auto-Inscrição (POST /api/eventos/{id}/inscrever)
   const handleInscrever = async (eventoId: string) => {
    try {
        // Enviamos o utilizadorId como parâmetro na URL
        await api.post(`/eventos/${eventoId}/inscrever?utilizadorId=${usuarioLogado.id}`, {}); 
        
        alert('Inscrição realizada com sucesso!');
        carregarInscricoes();
    } catch (err: any) {
        console.error("Erro na resposta:", err.response?.data);
        alert('Erro ao processar inscrição.');
    }
};

  // 5. Lógica de Cancelamento (PATCH /api/eventos/{id}/participantes/{userId}/cancelar)
  const handleCancelar = async (eventoId: string) => {
    if (!confirm('Tem a certeza que deseja cancelar a sua inscrição?')) return;
    try {
      await api.patch(`/eventos/${eventoId}/participantes/${usuarioLogado.id}/cancelar`);
      carregarInscricoes();
    } catch (err) {
      alert('Erro ao cancelar inscrição.');
    }
  };

  // Filtro local baseado no estado do botão "Inscrito"
  const eventosExibidos = filtroMeus 
    ? eventos.filter(e => meusEventosIds.includes(e.id))
    : eventos;

  return (
    <main className="min-h-screen bg-[#0f172a] text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header com Filtros */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-blue-500">Eventos EntArtes</h1>
            <p className="text-slate-400 mt-2 font-medium">Descobre workshops, exposições e palestras.</p>
          </div>
          
          <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700">
            <button 
              onClick={() => setFiltroMeus(false)}
              className={`px-8 py-2.5 rounded-xl font-bold transition-all ${!filtroMeus ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFiltroMeus(true)}
              className={`px-8 py-2.5 rounded-xl font-bold transition-all ${filtroMeus ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white'}`}
            >
              Inscrito
            </button>
          </div>
        </header>

        {/* Listagem */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-500 font-medium italic">A preparar o palco...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventosExibidos.map((evento) => {
              const estaInscrito = meusEventosIds.includes(evento.id);
              const data = new Date(evento.dataEvento);
              
              return (
                <div key={evento.id} className="group bg-slate-800/30 border border-slate-700/50 rounded-[2rem] p-6 hover:bg-slate-800/50 hover:border-blue-500/50 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-600 text-white w-14 h-16 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-blue-600/20">
                        <span className="text-[10px] font-bold uppercase opacity-80">{data.toLocaleDateString('pt', { month: 'short' })}</span>
                        <span className="text-xl font-black">{data.getDate()}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg leading-tight group-hover:text-blue-400 transition">{evento.nome}</h3>
                        <span className="text-xs text-slate-500 font-medium">📍 {evento.local}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm line-clamp-2 mb-6 min-h-[40px]">
                    {evento.descricao}
                  </p>

                  <div className="flex gap-3 mt-auto">
                    <button 
                      onClick={() => setEventoSelecionado(evento)}
                      className="flex-1 bg-slate-700/50 hover:bg-slate-700 py-3 rounded-2xl font-bold text-xs transition"
                    >
                      Ver Detalhes
                    </button>

                    {estaInscrito ? (
                      <button 
                        onClick={() => handleCancelar(evento.id)}
                        className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white py-3 rounded-2xl font-bold text-xs transition"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleInscrever(evento.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-2xl font-bold text-xs transition shadow-md shadow-blue-900/20"
                      >
                        Inscrever
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {eventoSelecionado && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="inline-block px-3 py-1 bg-blue-600/10 text-blue-500 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3">
                    Evento Cultural
                  </div>
                  <h2 className="text-3xl font-black text-white">{eventoSelecionado.nome}</h2>
                </div>
                <button 
                  onClick={() => setEventoSelecionado(null)}
                  className="bg-slate-800 hover:bg-slate-700 w-10 h-10 rounded-full flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6 mb-10">
                <p className="text-slate-400 leading-relaxed text-sm">
                  {eventoSelecionado.descricao}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Localização</span>
                    <span className="text-sm font-semibold">{eventoSelecionado.local}</span>
                  </div>
                  <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] font-bold uppercase block mb-1">Horário</span>
                    <span className="text-sm font-semibold">{eventoSelecionado.horaInicio} - {eventoSelecionado.horaFim}</span>
                  </div>
                </div>
              </div>

              {!meusEventosIds.includes(eventoSelecionado.id) ? (
                <button 
                  onClick={() => { handleInscrever(eventoSelecionado.id); setEventoSelecionado(null); }}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold text-white transition-all shadow-xl shadow-blue-600/20"
                >
                  Confirmar Inscrição
                </button>
              ) : (
                <div className="w-full py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-center font-bold text-sm">
                  ✓ Já estás inscrito neste evento
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}