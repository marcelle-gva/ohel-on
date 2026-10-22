"use client";

import { useState } from "react";
import { X, Search, Loader2, BookOpen, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface BibleSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (texto: string) => void;
}

const SUGESTOES = [
  { label: "João 3:16", value: "João 3:16" },
  { label: "Salmos 23:1-6", value: "Salmos 23:1-6" },
  { label: "Romanos 8:28", value: "Romanos 8:28" },
  { label: "Filipenses 4:13", value: "Filipenses 4:13" },
  { label: "Provérbios 3:5-6", value: "Provérbios 3:5-6" },
  { label: "Isaías 53:5", value: "Isaías 53:5" },
];

export function BibleSearchModal({ isOpen, onClose, onSelect }: BibleSearchModalProps) {
  const [referencia, setReferencia] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ text: string; reference: string } | null>(null);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  if (!isOpen) return null;

  const buscar = async (refBuscada: string) => {
    if (!refBuscada) return;
    setLoading(true);
    setError("");
    setResultado(null);
    setReferencia(refBuscada);

    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(refBuscada)}?translation=almeida`);
      const data = await res.json();
      if (data.error) throw new Error("Passagem não encontrada.");
      setResultado({ text: data.text.trim(), reference: data.reference });
    } catch (err) {
      setError("Não foi possível encontrar essa passagem. Verifique a referência.");
    } finally {
      setLoading(false);
    }
  };

  const handleDefinir = () => {
    if (resultado) {
      onSelect(`"${resultado.text}" (${resultado.reference})`);
      onClose();
    }
  };

  const handleCopiar = () => {
    if (resultado) {
      navigator.clipboard.writeText(`"${resultado.text}" (${resultado.reference})`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-ohel-surface border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-ohel-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ohel-blue/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-ohel-blue" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white uppercase">Definir Referência Base</h3>
              <p className="text-xs text-gray-400">João Ferreira de Almeida</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 bg-ohel-bg rounded-lg border border-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-6 flex flex-col gap-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input 
                type="text" 
                placeholder="Ex: João 3:16, Salmos 23..." 
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar(referencia)}
                className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-lg pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none"
              />
            </div>
            <Button variant="primary" onClick={() => buscar(referencia)} disabled={loading} className="w-auto px-8">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>

          <div>
            <p className="text-[10px] font-bold text-ohel-blue uppercase tracking-wider mb-2">✨ Passagens Frequentes:</p>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button 
                  key={s.value} 
                  onClick={() => buscar(s.value)}
                  className="px-3 py-1.5 rounded-full border border-gray-700 text-xs text-gray-300 hover:border-ohel-blue hover:text-ohel-blue transition-colors bg-ohel-bg"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded-lg">{error}</p>}

          {resultado && (
            <div className="bg-ohel-bg border border-gray-800 rounded-xl overflow-hidden animate-in fade-in">
              <div className="bg-ohel-blue/10 px-4 py-3 border-b border-ohel-blue/20 flex justify-between items-center">
                <h4 className="text-ohel-blue font-bold text-sm">{resultado.reference}</h4>
                <span className="text-[10px] bg-ohel-surface text-gray-300 px-2 py-1 rounded border border-gray-700">Almeida</span>
              </div>
              <div className="p-5 max-h-[200px] overflow-y-auto">
                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{resultado.text}</p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-6 border-t border-gray-800 bg-ohel-surface/50 flex justify-end gap-3">
          <Button variant="secondary" onClick={handleCopiar} disabled={!resultado} className="w-auto px-4">
            {copiado ? <><Check className="w-4 h-4 mr-2" /> Copiado!</> : <><Copy className="w-4 h-4 mr-2" /> Copiar Texto</>}
          </Button>
          <Button variant="primary" onClick={handleDefinir} disabled={!resultado} className="w-auto px-6">
            Definir como Base
          </Button>
        </div>
      </div>
    </div>
  );
}