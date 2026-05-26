"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE_URL = "http://localhost:8080";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") ?? "" : "";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface IFormState {
  nome: string;
  email: string;
  telefone: string;
  id_tipoUtilizador: string;
  dataNascimento: string;
  nif: string;
  [key: string]: string;
}

export default function CriarUtilizadorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingHashes, setLoadingHashes] = useState(true);

  const [hashesDiscobertas, setHashesDiscobertas] = useState<Record<string, string>>({
    ALUNO: "",
    PROFESSOR: "",
    ENCARREGADO: ""
  });

  const [form, setForm] = useState<IFormState>({
    nome: "",
    email: "",
    telefone: "",
    id_tipoUtilizador: "", 
    dataNascimento: "",
    nif: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    async function carregarHashesOficiais() {
      try {
        setLoadingHashes(true);
        setErrorMsg(null);

        const res = await fetch(`${BASE_URL}/api/utilizadores/tipos-hashes`, { 
          headers: authHeaders() 
        });
        
        if (!res.ok) throw new Error("Não foi possível carregar os identificadores de segurança.");
        
        const mapa = await res.json(); 
        setHashesDiscobertas(mapa);

        if (mapa.ALUNO) {
          setForm(prev => ({ ...prev, id_tipoUtilizador: mapa.ALUNO }));
        }
      } catch (err: any) {
        console.error("Erro ao carregar chaves do Java:", err);
        setErrorMsg("Erro de segurança: Não foi possível obter os identificadores do sistema.");
      } finally {
        setLoadingHashes(false);
      }
    }

    carregarHashesOficiais();
  }, [router]);

  function updateForm(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (!form.id_tipoUtilizador) {
      setErrorMsg("Erro de segurança: Selecione um tipo de utilizador válido.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/utilizadores`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(form)
      });

      // Proteção para evitar o erro "Unexpected end of JSON input" se o servidor falhar
      let dadosResposta: any = null;
      const textoResposta = await res.text();
      if (textoResposta) {
        try {
          dadosResposta = JSON.parse(textoResposta);
        } catch {
          dadosResposta = { message: textoResposta };
        }
      }

      if (!res.ok) {
        throw new Error(
          dadosResposta?.message || 
          `Erro interno no Servidor (Código 500). Verifica a consola do teu IntelliJ/Java.`
        );
      }

      router.push("/utilizadores");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de ligação ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: "0 auto", fontFamily: "var(--font-lato)" }}>
      <h1 style={{ fontFamily: "var(--font-playfair)", marginBottom: 20 }}>Novo Utilizador</h1>
      
      {errorMsg && <div style={{ color: "#c0392b", background: "#fdf2f2", padding: 10, borderRadius: 6, marginBottom: 20, fontSize: 13, wordBreak: "break-word" }}>{errorMsg}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Nome Completo</label>
          <input type="text" required value={form.nome} onChange={e => updateForm("nome", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border-warm)" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Email</label>
          <input type="email" required value={form.email} onChange={e => updateForm("email", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border-warm)" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Telefone</label>
          <input type="text" value={form.telefone} onChange={e => updateForm("telefone", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border-warm)" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>NIF</label>
          <input type="text" value={form.nif} onChange={e => updateForm("nif", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border-warm)" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Data de Nascimento</label>
          <input type="date" required value={form.dataNascimento} onChange={e => updateForm("dataNascimento", e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--border-warm)" }} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-muted)", fontWeight: 300, marginBottom: 6 }}>
            Tipo de utilizador
          </label>
          
          {loadingHashes ? (
            <div style={{ fontSize: 12, color: "var(--accent-muted)", padding: "9px 0" }}>
              A carregar tipos de segurança...
            </div>
          ) : (
            <select value={form.id_tipoUtilizador} onChange={e => updateForm("id_tipoUtilizador", e.target.value)}
              style={{ width: "100%", background: "#FBF7F2", border: "1px solid var(--border-warm)", borderRadius: 6, padding: "9px 12px", color: "var(--panel-dark)", fontSize: 13, cursor: "pointer" }}>
              <option value={hashesDiscobertas.ALUNO}>Aluno</option>
              <option value={hashesDiscobertas.PROFESSOR}>Professor</option>
              <option value={hashesDiscobertas.ENCARREGADO}>Encarregado</option>
            </select>
          )}
        </div>

        <button type="submit" disabled={loading || loadingHashes} style={{ padding: 12, background: "var(--panel-dark)", color: "var(--accent-gold)", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
          {loading ? "A criar..." : "Criar Utilizador"}
        </button>
      </form>
    </div>
  );
}