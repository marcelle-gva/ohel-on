"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { TERMOS_CREDENCIAL, TermoCredencialId } from "@/lib/terms";
import { ArrowLeft, CheckCircle2, FileCheck2, Loader2 } from "lucide-react";

interface Membro {
  id: string;
  nome: string;
  cpf: string | null;
  data_nascimento: string | null;
}

export default function EntregaCredencialPage() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [membroId, setMembroId] = useState("");
  const [selecionados, setSelecionados] = useState<TermoCredencialId[]>(TERMOS_CREDENCIAL.filter((termo) => termo.obrigatorio).map((termo) => termo.id));
  const [nomeAssinante, setNomeAssinante] = useState("");
  const [cpfAssinante, setCpfAssinante] = useState("");
  const [descricaoDoacao, setDescricaoDoacao] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: user } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (!user?.igreja_id) return;
      setIgrejaId(user.igreja_id);
      const { data } = await supabase.from("membros").select("id, nome, cpf, data_nascimento").eq("igreja_id", user.igreja_id).order("nome");
      setMembros(data || []);
      setLoading(false);
    };
    void load();
  }, []);

  const membroSelecionado = membros.find((membro) => membro.id === membroId);
  const doacaoSelecionada = selecionados.includes("doacao_bem_movel");

  const toggleTermo = (id: TermoCredencialId) => {
    const termo = TERMOS_CREDENCIAL.find((item) => item.id === id);
    if (termo?.obrigatorio) return;
    setSelecionados((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selecionarMembro = (id: string) => {
    setMembroId(id);
    const membro = membros.find((item) => item.id === id);
    if (membro) {
      setNomeAssinante(membro.nome);
      setCpfAssinante(membro.cpf || "");
    }
  };

  const registrar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!igrejaId || !membroSelecionado) {
      setModal({ isOpen: true, type: "error", title: "Selecione o membro", message: "Escolha o membro que recebeu a credencial." });
      return;
    }
    if (!nomeAssinante.trim()) {
      setModal({ isOpen: true, type: "error", title: "Informe o assinante", message: "Informe o nome do membro ou responsável legal." });
      return;
    }
    if (doacaoSelecionada && !descricaoDoacao.trim()) {
      setModal({ isOpen: true, type: "error", title: "Descreva a doação", message: "Informe qual bem foi doado antes de registrar o termo." });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Entre novamente.");
      const rows = TERMOS_CREDENCIAL.filter((termo) => selecionados.includes(termo.id)).map((termo) => ({
        igreja_id: igrejaId,
        membro_id: membroSelecionado.id,
        tipo_termo: termo.id,
        versao: termo.versao,
        texto_snapshot: termo.id === "doacao_bem_movel" ? `${termo.texto}\n\nDescrição informada no ato: ${descricaoDoacao.trim()}` : termo.texto,
        nome_assinante: nomeAssinante.trim(),
        cpf_assinante: cpfAssinante.trim() || null,
        entregue_por: session.user.id,
      }));
      const { error } = await supabase.from("termos_aceites").insert(rows);
      if (error) throw error;
      setModal({ isOpen: true, type: "success", title: "Entrega registrada", message: "Os termos e a entrega da credencial foram registrados com a versão apresentada." });
      setSelecionados(TERMOS_CREDENCIAL.filter((termo) => termo.obrigatorio).map((termo) => termo.id));
      setDescricaoDoacao("");
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível registrar", message: error instanceof Error ? error.message : "Verifique se a migration dos termos foi executada no Supabase." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando membros...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />
      <div className="flex items-start gap-3">
        <Link href="/secretaria/credenciais" className="text-gray-400 hover:text-white mt-1"><ArrowLeft className="w-5 h-5" /></Link>
        <div><h1 className="text-2xl font-bold text-white">Entrega de Credencial e Termos</h1><p className="text-gray-400 text-sm mt-1">Registre quem recebeu a credencial e quais autorizações foram aceitas.</p></div>
      </div>

      <form onSubmit={registrar} className="flex flex-col gap-5">
        <Card className="p-5 border-gray-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><FileCheck2 className="w-4 h-4 text-ohel-blue" /> Identificação da entrega</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 md:col-span-2"><label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Membro</label><select value={membroId} onChange={(event) => selecionarMembro(event.target.value)} required className="input-ohel w-full px-4 py-3 rounded-lg text-sm"><option value="">Selecione...</option>{membros.map((membro) => <option key={membro.id} value={membro.id}>{membro.nome}</option>)}</select></div>
            <Input label="Nome do membro ou responsável legal *" value={nomeAssinante} onChange={(event) => setNomeAssinante(event.target.value)} required />
            <Input label="CPF do assinante" value={cpfAssinante} onChange={(event) => setCpfAssinante(event.target.value)} />
          </div>
        </Card>

        <Card className="p-5 border-gray-800">
          <h2 className="text-sm font-bold text-white mb-1">Termos apresentados</h2>
          <p className="text-xs text-gray-500 mb-4">Os termos obrigatórios ficam selecionados. Imagem e doação só devem ser marcados quando a autorização ou entrega realmente ocorrer.</p>
          <div className="flex flex-col gap-3">{TERMOS_CREDENCIAL.map((termo) => <label key={termo.id} className={`flex items-start gap-3 rounded-lg border p-3 ${selecionados.includes(termo.id) ? "border-ohel-blue/50 bg-ohel-blue/5" : "border-gray-800 bg-ohel-bg"}`}><input type="checkbox" checked={selecionados.includes(termo.id)} disabled={termo.obrigatorio} onChange={() => toggleTermo(termo.id)} className="mt-1 accent-blue-500" /><span className="min-w-0"><span className="block text-sm font-semibold text-white">{termo.titulo} <span className="text-[10px] text-gray-500">v{termo.versao}{termo.obrigatorio ? " · obrigatório" : " · opcional"}</span></span><span className="block text-xs text-gray-400 leading-relaxed mt-1">{termo.texto}</span></span></label>)}</div>
          {doacaoSelecionada && <div className="mt-4"><Input label="Descrição do bem doado *" value={descricaoDoacao} onChange={(event) => setDescricaoDoacao(event.target.value)} placeholder="Ex.: 1 computador Dell, série..., em bom estado" required /></div>}
        </Card>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3"><p className="text-[11px] text-gray-500 leading-relaxed">O registro guarda o texto e a versão apresentados. Ele não elimina direitos previstos na LGPD, no ECA ou no Código Civil.</p><Button type="submit" variant="primary" disabled={saving} className="w-full md:w-auto px-6">{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Registrar entrega</>}</Button></div>
      </form>
    </div>
  );
}
