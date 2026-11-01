"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BookOpen, BookMarked, Loader2, Save, Search, Send, X } from "lucide-react";

interface BibleResult {
  reference: string;
  text: string;
}

interface PalavraPanelProps {
  igrejaId: string | null;
  onProjetar: (payload: { titulo: string; referencia: string; texto: string; esboco: string }) => void;
}

export function PalavraPanel({ igrejaId, onProjetar }: PalavraPanelProps) {
  const [referenciaBusca, setReferenciaBusca] = useState("");
  const [resultado, setResultado] = useState<BibleResult | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    titulo: "",
    tema: "",
    pastor: "",
    esboco: "",
  });

  const buscarVersiculo = async () => {
    const referencia = referenciaBusca.trim();
    if (!referencia) return;
    setBuscando(true);
    setErro("");
    setMensagem("");
    try {
      const response = await fetch(`https://bible-api.com/${encodeURIComponent(referencia)}?translation=almeida`);
      if (!response.ok) throw new Error("Referência não encontrada. Tente, por exemplo, João 3:16.");
      const data = await response.json() as BibleResult;
      setResultado({ reference: data.reference, text: data.text.trim() });
      setForm((current) => ({
        ...current,
        titulo: current.titulo || data.reference,
        esboco: current.esboco || `${data.reference}\n"${data.text.trim()}"\n\n`,
      }));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível consultar a Bíblia agora.");
      setResultado(null);
    } finally {
      setBuscando(false);
    }
  };

  const atualizarForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const salvarSermao = async () => {
    if (!igrejaId) {
      setErro("Igreja não identificada.");
      return;
    }
    if (!form.titulo.trim()) {
      setErro("Informe o título do sermão.");
      return;
    }
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const { error } = await supabase.from("sermoes").insert({
        igreja_id: igrejaId,
        titulo: form.titulo.trim(),
        tema: form.tema.trim(),
        referencia_biblica: resultado?.reference || referenciaBusca.trim(),
        pastor: form.pastor.trim(),
        data_pregacao: new Date().toISOString().split("T")[0],
        esboco: form.esboco,
        link_video: "",
        link_audio: "",
      });
      if (error) throw error;
      setMensagem("Sermão salvo no Banco de Sermões.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o sermão.");
    } finally {
      setSalvando(false);
    }
  };

  const projetar = () => {
    if (!resultado && !form.esboco.trim()) {
      setErro("Busque uma referência ou escreva o esboço antes de projetar.");
      return;
    }
    onProjetar({
      titulo: form.titulo.trim() || "Palavra",
      referencia: resultado?.reference || referenciaBusca.trim(),
      texto: resultado?.text || "",
      esboco: form.esboco,
    });
    setMensagem("Palavra enviada para a projeção.");
  };

  return (
    <section id="section-palavra" className="bg-ohel-surface rounded-xl border border-gray-800 p-4 flex flex-col fullscreen-card">
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-300" /> Palavra
        </h3>
        <span className="text-[10px] text-gray-500">Bíblia + sermão + projeção</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Buscar na Bíblia (Almeida)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-500" />
              <input
                value={referenciaBusca}
                onChange={(event) => setReferenciaBusca(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void buscarVersiculo(); }}
                placeholder="Ex.: João 3:16 ou Salmos 23"
                className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-8 pr-2 py-2 focus:border-ohel-blue outline-none"
              />
            </div>
            <button onClick={() => void buscarVersiculo()} disabled={buscando} className="px-3 py-2 rounded-md bg-ohel-blue text-white text-[10px] font-semibold hover:bg-blue-600 disabled:opacity-60">
              {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Buscar"}
            </button>
          </div>

          {resultado && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
              <p className="text-amber-200 text-xs font-bold flex items-center gap-2"><BookMarked className="w-3.5 h-3.5" /> {resultado.reference}</p>
              <p className="text-gray-200 text-xs leading-relaxed mt-2">{resultado.text}</p>
              <button onClick={() => { setResultado(null); setReferenciaBusca(""); }} className="mt-2 text-[10px] text-gray-500 hover:text-white flex items-center gap-1"><X className="w-3 h-3" /> Limpar referência</button>
            </div>
          )}

          {erro && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md p-2">{erro}</p>}
          {mensagem && <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2">{mensagem}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={form.titulo} onChange={(event) => atualizarForm("titulo", event.target.value)} placeholder="Título do sermão" className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 focus:border-ohel-blue outline-none" />
            <input value={form.tema} onChange={(event) => atualizarForm("tema", event.target.value)} placeholder="Tema central" className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 focus:border-ohel-blue outline-none" />
          </div>
          <input value={form.pastor} onChange={(event) => atualizarForm("pastor", event.target.value)} placeholder="Pastor / preletor" className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 focus:border-ohel-blue outline-none" />
          <textarea value={form.esboco} onChange={(event) => atualizarForm("esboco", event.target.value)} placeholder="Esboço, introdução, tópicos e conclusão da mensagem..." className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 min-h-[128px] resize-y focus:border-ohel-blue outline-none leading-relaxed" />
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/gabinete/sermoes/novo" className="px-3 py-2 rounded-md border border-gray-700 text-gray-300 hover:text-white hover:border-ohel-blue text-[10px] font-semibold">Editor completo</Link>
            <button onClick={salvarSermao} disabled={salvando} className="px-3 py-2 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 text-[10px] font-semibold flex items-center gap-1.5 disabled:opacity-60">
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar Sermão
            </button>
            <button onClick={projetar} className="px-3 py-2 rounded-md bg-amber-500/20 text-amber-200 hover:bg-amber-500 hover:text-white text-[10px] font-semibold flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" /> Exibir na Projeção
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
