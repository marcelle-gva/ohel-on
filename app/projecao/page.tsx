"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Music, BookOpen, ChevronLeft, ChevronRight, Maximize, MonitorPlay } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

// Função auxiliar para transpor acordes
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS_TO_SHARPS: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

const transposeChord = (chord: string, steps: number) => {
  if (steps === 0) return chord;
  return chord.replace(/^([A-G][#b]?)(.*)$/, (match, root, quality) => {
    let normalizedRoot = FLATS_TO_SHARPS[root] || root;
    let index = NOTES.indexOf(normalizedRoot);
    if (index === -1) return match;
    let newIndex = (index + steps + 12) % 12;
    return NOTES[newIndex] + quality;
  });
};

export default function ProjecaoPage() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [slides, setSlides] = useState<string[]>([]);
  const [transposicao, setTransposicao] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [musicaTitulo, setMusicaTitulo] = useState("Nenhuma música selecionada");
  const [musicaTom, setMusicaTom] = useState("");
  const [modoProjecao, setModoProjecao] = useState<"musica" | "palavra">("musica");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!igrejaId) return;

    const channel = supabase.channel(`projecao-${igrejaId}`, {
      config: { broadcast: { ack: true } }
    });

    channel
      .on('broadcast', { event: 'comando_projecao' }, (payload) => {
        const { musica_id, slide_index, transposicao, status, tipo, titulo, referencia, slides: palavraSlides } = payload.payload;

        if (tipo === "palavra" && Array.isArray(palavraSlides)) {
          setModoProjecao("palavra");
          setMusicaTitulo(titulo || "Palavra");
          setMusicaTom(referencia || "");
          setSlides(palavraSlides);
          setSlideIndex(0);
        } else if (status === 'Tocando' && musica_id) {
          setModoProjecao("musica");
          buscarMusica(musica_id, slide_index, transposicao);
        } else if (status === 'Pausado') {
          setMusicaTitulo("Projeção Pausada");
          setSlides([]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [igrejaId]);

  // ESCUTADOR DE TECLADO NA TELA DE PROJEÇÃO
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (slides.length === 0) return;
      
      if (e.key === 'ArrowRight') {
        setSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setSlideIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides]);

  const buscarMusica = async (id: string, slide: number, trans: number) => {
    const { data, error } = await supabase.from('louvores').select('*').eq('id', id).single();
    if (error) return;

    setMusicaTitulo(data.titulo);
    setMusicaTom(data.tom);
    setModoProjecao("musica");
    setTransposicao(trans);
    setSlideIndex(slide);

    const textoCifra = data.link_cifra || "";
    
    const textoSemMeta = textoCifra
      .split('\n')
      .filter((line: string) => !line.match(/^(Title|Artist|Key|Original Key|Book|Verse|Chorus|Bridge|Tag|Section):/i))
      .filter((line: string) => !line.match(/^\[.*\]:$/))
      .join('\n');

    let slidesArray: string[] = [];
    const blocos = textoSemMeta.split(/\n\s*\n/).filter((s: string) => s.trim().length > 0);

    if (blocos.length === 1 && textoSemMeta.split('\n').length > 6) {
      const linhas = textoSemMeta.split('\n');
      let blocoAtual: string[] = [];

      linhas.forEach((linha: string) => {
        if (/^(Refrão|Primeira Parte|Segunda Parte|Terceira Parte|Solo|Tab|Ponte|Final)/i.test(linha.trim()) && blocoAtual.length > 0) {
          slidesArray.push(blocoAtual.join('\n'));
          blocoAtual = [];
        }
        blocoAtual.push(linha);

        if (blocoAtual.length >= 5 && !linha.trim().match(/^(Refrão|Solo|Tab)/i)) {
           slidesArray.push(blocoAtual.join('\n'));
           blocoAtual = [];
        }
      });

      if (blocoAtual.length > 0) {
        slidesArray.push(blocoAtual.join('\n'));
      }
    } else {
      slidesArray = blocos.map((s: string) => s.trim());
    }

    setSlides(slidesArray);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const renderSlide = (texto: string) => {
    if (!texto) return null;

    return texto.split('\n').map((linha, index) => {
      if (linha.trim() === "") return <div key={index} className="h-4"></div>;

      if (!linha.includes('[')) {
        return (
          <div key={index} className="mb-2">
            <span className="text-white text-2xl leading-tight whitespace-pre-wrap">{linha}</span>
          </div>
        );
      }

      const partes = linha.split(/(\[[^\]]+\])/g);

      return (
        <div key={index} className="flex flex-wrap items-end mb-3">
          {partes.map((parte, i) => {
            if (parte.startsWith("[") && parte.endsWith("]")) {
              const acordeOriginal = parte.slice(1, -1);
              const acordeTransposto = transposeChord(acordeOriginal, transposicao);
              
              return (
                <span key={i} className="inline-flex flex-col mr-1 relative top-1">
                  <span className="text-[#007BFF] font-bold text-3xl leading-none mb-1">{acordeTransposto}</span>
                </span>
              );
            }
            
            return (
              <span key={i} className="text-white text-2xl leading-tight whitespace-pre-wrap">
                {parte}
              </span>
            );
          })}
        </div>
      );
    });
  };

  const slideAtual = slides[slideIndex] || "";

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#03060D]">
      
      {/* FUNDO PREMIUM */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#03060D] via-[#080E1B] to-[#03060D]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-ohel-blue/10 rounded-full blur-[120px]"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* LOGO DA IGREJA NO TELÃO */}
      <div className="absolute bottom-8 left-8 opacity-40 z-50 pointer-events-none">
        <Logo className="w-32 h-16" /> {/* <-- CORRIGIDO AQUI, REMOVIDO O noMask */}
      </div>

      <div className="absolute top-6 left-6 flex items-center gap-4 text-white opacity-40 z-50">
        {modoProjecao === "palavra" ? <BookOpen className="w-6 h-6" /> : <Music className="w-6 h-6" />}
        <div>
          <h1 className="text-xl font-bold">{musicaTitulo}</h1>
          <p className="text-xs">{modoProjecao === "palavra" ? musicaTom || "Mensagem do culto" : `Tom: ${musicaTom} | Transposição: ${transposicao}`}</p>
        </div>
      </div>

      {!isFullscreen && (
        <div className="absolute top-6 right-6 flex items-center gap-2 z-50">
          <div className="bg-white/10 text-white px-3 py-1 rounded text-xs mr-2 border border-white/10">
            Slide {slideIndex + 1} / {slides.length}
          </div>
          <button onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))} className="p-2 bg-white/10 border border-white/10 rounded hover:bg-white/20 text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setSlideIndex(Math.min(slides.length - 1, slideIndex + 1))} className="p-2 bg-white/10 border border-white/10 rounded hover:bg-white/20 text-white">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={toggleFullscreen} className="bg-ohel-blue text-white px-4 py-2 rounded-lg hover:bg-blue-600 ml-4 font-bold text-sm shadow-[0_0_15px_rgba(0,123,255,0.3)]">
            <Maximize className="w-4 h-4 inline mr-2" /> Tela Cheia
          </button>
        </div>
      )}

      <div className="w-full max-w-6xl px-12 py-20 z-10 flex items-center justify-center min-h-[60vh]">
        {slides.length > 0 ? (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {renderSlide(slideAtual)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-ohel-blue/10 rounded-full flex items-center justify-center mb-6">
              <MonitorPlay className="w-12 h-12 text-ohel-blue opacity-50" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Aguardando Monitor de Mídia</h2>
            <p className="text-gray-400 text-lg">Selecione um louvor ou uma Palavra no Monitor de Mídia para iniciar a projeção.</p>
            <p className="text-gray-500 text-sm mt-8">Dica: Use as setas do teclado (← →) para passar os slides.</p>
          </div>
        )}
      </div>

    </div>
  );
}
