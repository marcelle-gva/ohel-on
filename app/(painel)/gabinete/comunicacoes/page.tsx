"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, MessageCircle, Plus, Search, CheckCircle2, Clock } from "lucide-react";

interface Comunicacao {
  id: string;
  template_name: string;
  language_code: string;
  parameter_text: string | null;
  status: string;
  total_destinatarios: number;
  enviados: number;
  falhas: number;
  created_at: string;
}

export default function ComunicacoesPage() {
  const [loading, setLoading] = useState(true);
  const [comunicacoes, setComunicacoes] = useState<Comunicacao[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let active = true;
    const fetchComunicacoes = async () => {
      const { data, error } = await supabase
        .from("whatsapp_comunicacoes")
        .select("id, template_name, language_code, parameter_text, status, total_destinatarios, enviados, falhas, created_at")
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error) {
        setErro("Não foi possível carregar o histórico. Execute a migration do WhatsApp no Supabase e confira sua permissão de administrador.");
      } else {
        setErro("");
        setComunicacoes((data ?? []) as Comunicacao[]);
      }
      setLoading(false);
    };
    void fetchComunicacoes();
    return () => {
      active = false;
    };
  }, []);

  const filtradas = comunicacoes.filter(c => 
    c.template_name.toLowerCase().includes(busca.toLowerCase()) ||
    (c.parameter_text ?? "").toLowerCase().includes(busca.toLowerCase())
  );

  const formatarData = (dataStr: string) => {
    return new Date(dataStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-5 pb-10">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/gabinete" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" /> Comunicações Pastorais
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Envios pela API oficial, com destinatários consentidos e status de entrega.</p>
          </div>
        </div>
        <Link href="/gabinete/comunicacoes/nova" className="w-auto px-5 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md flex items-center gap-2 font-medium transition-colors shadow-[0_0_15px_rgba(34,197,94,0.2)]">
          <Plus className="w-3.5 h-3.5" /> Nova Comunicação
        </Link>
      </div>

      <Card className="p-3 flex flex-col lg:flex-row gap-3 items-center bg-ohel-surface/50 border-gray-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
          <input 
            type="text" 
            placeholder="Buscar por mensagem ou público-alvo..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#05080f] border-b border-gray-800 text-[9px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-3 font-medium">Data</th>
              <th className="p-3 font-medium">Modelo Meta</th>
              <th className="p-3 font-medium">Variável 1</th>
              <th className="p-3 font-medium text-center">Destinatários</th>
              <th className="p-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/30">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">{erro || "Carregando histórico..."}</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">{erro || "Nenhum envio registrado."}</td></tr>
            ) : (
              filtradas.map((com) => (
                <tr key={com.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 text-gray-400 whitespace-nowrap">{formatarData(com.created_at)}</td>
                  <td className="p-3">
                    <span className="bg-ohel-blue/10 text-ohel-blue font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                      {com.template_name} ({com.language_code})
                    </span>
                  </td>
                  <td className="p-3 text-white max-w-xs truncate" title={com.parameter_text ?? ""}>{com.parameter_text || "—"}</td>
                  <td className="p-3 text-center text-gray-300">{com.enviados}/{com.total_destinatarios} aceitos · {com.falhas} falhas</td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider
                      ${com.status === "enviado" ? "bg-green-500/10 text-green-500 border-green-500/20" : com.status === "falhou" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"}`}>
                      {com.status === "enviado" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {com.status === "enviado" ? "Aceito pela Meta" : com.status === "parcial" ? "Parcial" : com.status === "falhou" ? "Falhou" : "Processando"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}