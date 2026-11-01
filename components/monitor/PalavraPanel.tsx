"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BookOpen, BookMarked, ChevronRight, Loader2, Save, Send, X } from "lucide-react";

interface BibleBook {
  id: string;
  name: string;
}

interface BibleChapter {
  book_id: string;
  book: string;
  chapter: number;
}

interface BibleVerse {
  book_id: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface PalavraProjectionPayload {
  titulo: string;
  referencia: string;
  texto: string;
  esboco: string;
  slides?: string[];
  initialSlide?: number;
  autoOpen?: boolean;
}

interface PalavraPanelProps {
  igrejaId: string | null;
  onProjetar: (payload: PalavraProjectionPayload) => void;
}

const API_BASE = "https://bible-api.com/data/almeida";

export function PalavraPanel({ igrejaId, onProjetar }: PalavraPanelProps) {
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [chapters, setChapters] = useState<BibleChapter[]>([]);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [book, setBook] = useState<BibleBook | null>(null);
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<BibleVerse | null>(null);
  const [bookFilter, setBookFilter] = useState("");
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [sermaoAberto, setSermaoAberto] = useState(false);
  const [form, setForm] = useState({ titulo: "", tema: "", pastor: "", esboco: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(API_BASE);
          if (!response.ok) throw new Error("Não foi possível carregar os livros da Bíblia.");
          const data = await response.json() as { books: BibleBook[] };
          setBooks(data.books || []);
        } catch (error) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar os livros da Bíblia.");
        } finally {
          setLoadingBooks(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const oldTestamentBooks = useMemo(() => books.slice(0, 39).filter((item) => item.name.toLowerCase().includes(bookFilter.toLowerCase())), [books, bookFilter]);
  const newTestamentBooks = useMemo(() => books.slice(39).filter((item) => item.name.toLowerCase().includes(bookFilter.toLowerCase())), [books, bookFilter]);

  const selectBook = async (nextBook: BibleBook) => {
    setBook(nextBook);
    setChapter(null);
    setVerses([]);
    setSelectedVerse(null);
    setLoadingChapters(true);
    setErro("");
    try {
      const response = await fetch(`${API_BASE}/${nextBook.id}`);
      if (!response.ok) throw new Error("Não foi possível carregar os capítulos.");
      const data = await response.json() as { chapters: BibleChapter[] };
      setChapters(data.chapters || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os capítulos.");
    } finally {
      setLoadingChapters(false);
    }
  };

  const selectChapter = async (nextChapter: BibleChapter) => {
    setChapter(nextChapter);
    setVerses([]);
    setSelectedVerse(null);
    setLoadingVerses(true);
    setErro("");
    try {
      const response = await fetch(`${API_BASE}/${nextChapter.book_id}/${nextChapter.chapter}`);
      if (!response.ok) throw new Error("Não foi possível carregar os versículos.");
      const data = await response.json() as { verses: BibleVerse[] };
      setVerses(data.verses || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os versículos.");
    } finally {
      setLoadingVerses(false);
    }
  };

  const selectVerse = (verse: BibleVerse) => {
    setSelectedVerse(verse);
    const referencia = `${verse.book} ${verse.chapter}:${verse.verse}`;
    setForm((current) => ({
      ...current,
      titulo: current.titulo || referencia,
      esboco: current.esboco || `${referencia}\n"${verse.text.trim()}"\n\n`,
    }));
    setErro("");
    setMensagem("");

    const slides = verses.map((item) => `${item.book} ${item.chapter}:${item.verse}\n\n${item.text.trim()}`);
    onProjetar({
      titulo: form.titulo.trim() || "Palavra",
      referencia,
      texto: verse.text.trim(),
      esboco: form.esboco,
      slides,
      initialSlide: Math.max(0, verses.findIndex((item) => item.verse === verse.verse)),
      autoOpen: true,
    });
    setMensagem(`Projetando ${referencia}. Use ← e → no projetor para passar pelos versículos do capítulo.`);
  };

  const atualizarForm = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const salvarSermao = async () => {
    if (!igrejaId) return setErro("Igreja não identificada.");
    if (!form.titulo.trim()) return setErro("Informe o título do sermão.");
    setSalvando(true);
    setErro("");
    setMensagem("");
    try {
      const { error } = await supabase.from("sermoes").insert({
        igreja_id: igrejaId,
        titulo: form.titulo.trim(),
        tema: form.tema.trim(),
        referencia_biblica: selectedVerse ? `${selectedVerse.book} ${selectedVerse.chapter}:${selectedVerse.verse}` : "",
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

  const projetarEsboco = () => {
    if (!selectedVerse && !form.esboco.trim()) return setErro("Selecione um versículo ou escreva o esboço antes de projetar.");
    onProjetar({
      titulo: form.titulo.trim() || "Palavra",
      referencia: selectedVerse ? `${selectedVerse.book} ${selectedVerse.chapter}:${selectedVerse.verse}` : "",
      texto: selectedVerse?.text.trim() || "",
      esboco: form.esboco,
      autoOpen: true,
    });
    setMensagem("Mensagem enviada para a projeção.");
  };

  return (
    <section id="section-palavra" className="bg-ohel-surface rounded-xl border border-gray-800 p-4 flex flex-col fullscreen-card">
      <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2 gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber-300" /> Palavra</h3>
        <span className="text-[10px] text-gray-500">Almeida · livros, capítulos e versículos</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_0.8fr] gap-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <button onClick={() => { setBook(null); setChapter(null); setVerses([]); }} className={!book ? "text-amber-200 font-bold" : "hover:text-white"}>Livros</button>
              {book && <><ChevronRight className="w-3 h-3" /><button onClick={() => { setChapter(null); setVerses([]); }} className={!chapter ? "text-amber-200 font-bold" : "hover:text-white"}>{book.name}</button></>}
              {chapter && <><ChevronRight className="w-3 h-3" /><span className="text-amber-200 font-bold">Cap. {chapter.chapter}</span></>}
            </div>
            {book && <button onClick={() => { setBook(null); setChapter(null); setVerses([]); }} className="text-[10px] text-gray-500 hover:text-white">Voltar aos livros</button>}
          </div>

          {!book && (
            <>
              <input value={bookFilter} onChange={(event) => setBookFilter(event.target.value)} placeholder="Filtrar livros..." className="w-full mb-2 bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 focus:border-ohel-blue outline-none" />
              {loadingBooks ? <div className="flex items-center gap-2 text-xs text-gray-500 p-3"><Loader2 className="w-4 h-4 animate-spin" /> Carregando livros...</div> : <div className="max-h-[520px] overflow-y-auto pr-1 space-y-4">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 mb-2">Antigo Testamento</p><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{oldTestamentBooks.map((item) => <button key={item.id} onClick={() => void selectBook(item)} className="text-left px-3 py-2.5 bg-ohel-bg border border-gray-800 hover:border-amber-400/50 hover:text-amber-200 rounded-md text-xs text-gray-300 transition-colors">{item.name}</button>)}</div></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-200 mb-2">Novo Testamento</p><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{newTestamentBooks.map((item) => <button key={item.id} onClick={() => void selectBook(item)} className="text-left px-3 py-2.5 bg-ohel-bg border border-gray-800 hover:border-amber-400/50 hover:text-amber-200 rounded-md text-xs text-gray-300 transition-colors">{item.name}</button>)}</div></div>
              </div>}
            </>
          )}

          {book && !chapter && (
            loadingChapters ? <div className="flex items-center gap-2 text-xs text-gray-500 p-3"><Loader2 className="w-4 h-4 animate-spin" /> Carregando capítulos...</div> : <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-[360px] overflow-y-auto pr-1">{chapters.map((item) => <button key={item.chapter} onClick={() => void selectChapter(item)} className="py-2.5 bg-ohel-bg border border-gray-800 hover:border-amber-400/50 hover:text-amber-200 rounded-md text-xs text-gray-300">{item.chapter}</button>)}</div>
          )}

          {book && chapter && (
            loadingVerses ? <div className="flex items-center gap-2 text-xs text-gray-500 p-3"><Loader2 className="w-4 h-4 animate-spin" /> Carregando versículos...</div> : <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto pr-1">{verses.map((item) => <button key={item.verse} onClick={() => selectVerse(item)} className={`text-left p-2.5 rounded-md border text-xs transition-colors ${selectedVerse?.verse === item.verse ? "border-amber-400/60 bg-amber-400/10 text-amber-100" : "border-gray-800 bg-ohel-bg text-gray-300 hover:border-amber-400/40 hover:text-white"}`}><span className="font-bold text-amber-300 mr-2">{item.verse}</span>{item.text.trim()}</button>)}</div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {selectedVerse && <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-3"><p className="text-amber-200 text-xs font-bold flex items-center gap-2"><BookMarked className="w-3.5 h-3.5" /> {selectedVerse.book} {selectedVerse.chapter}:{selectedVerse.verse}</p><p className="text-gray-200 text-xs leading-relaxed mt-2">{selectedVerse.text.trim()}</p></div>}
          {!sermaoAberto ? <div className="flex flex-col items-center justify-center min-h-[180px] rounded-lg border border-dashed border-gray-700 bg-ohel-bg/40 p-5 text-center"><BookOpen className="w-8 h-8 text-gray-600 mb-3" /><p className="text-xs text-gray-400 mb-4">O formulário de sermão fica fechado durante a seleção da Bíblia.</p><button onClick={() => setSermaoAberto(true)} className="px-5 py-2.5 rounded-md bg-ohel-blue text-white hover:bg-blue-600 text-xs font-bold">Criar sermão</button></div> : <>
            <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Novo sermão</p><button onClick={() => setSermaoAberto(false)} aria-label="Fechar criação de sermão" className="p-1 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input value={form.titulo} onChange={(event) => atualizarForm("titulo", event.target.value)} placeholder="Título do sermão" className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 focus:border-ohel-blue outline-none" /><input value={form.tema} onChange={(event) => atualizarForm("tema", event.target.value)} placeholder="Tema central" className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 focus:border-ohel-blue outline-none" /></div>
            <input value={form.pastor} onChange={(event) => atualizarForm("pastor", event.target.value)} placeholder="Pastor / preletor" className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 focus:border-ohel-blue outline-none" />
            <textarea value={form.esboco} onChange={(event) => atualizarForm("esboco", event.target.value)} placeholder="Esboço, introdução, tópicos e conclusão da mensagem..." className="bg-ohel-bg border border-gray-700 text-xs text-white rounded-md px-3 py-2 min-h-[112px] resize-y focus:border-ohel-blue outline-none leading-relaxed" />
            {erro && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md p-2">{erro}</p>}
            {mensagem && <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-2">{mensagem}</p>}
            <div className="flex flex-wrap justify-end gap-2"><button onClick={salvarSermao} disabled={salvando} className="px-3 py-2 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 text-[10px] font-semibold flex items-center gap-1.5 disabled:opacity-60">{salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar sermão</button><button onClick={projetarEsboco} className="px-3 py-2 rounded-md bg-amber-500/20 text-amber-200 hover:bg-amber-500 hover:text-white text-[10px] font-semibold flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Exibir Esboço</button></div>
          </>}
        </div>
      </div>
    </section>
  );
}
