"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, ArrowRightLeft, Package, User, Calendar } from "lucide-react";
import Link from "next/link";

type Bem = {
  id: string;
  igreja_id: string;
  descricao: string;
  status: string;
  localizacao: string | null;
};

export default function MovimentarBemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bem, setBem] = useState<Bem | null>(null);
  const [localizacoes, setLocalizacoes] = useState<{ id: string; nome: string }[]>([]);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    tipo_movimentacao: "Transferência",
    responsavel: "",
    local_destino: "",
    data_movimentacao: new Date().toISOString().split('T')[0],
    observacao: ""
  });

  useEffect(() => {
    const fetchBem = async () => {
      if (!id) return;
      const { data, error } = await supabase.from('patrimonio_bens').select('*').eq('id', id).single();
      if (error) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
      } else {
        setBem(data);
        const { data: places, error: placesError } = await supabase.from("patrimonio_localizacoes")
          .select("id, nome").eq("igreja_id", data.igreja_id).order("nome");
        if (placesError) setModal({ isOpen: true, type: "error", title: "Erro", message: placesError.message });
        else setLocalizacoes(places ?? []);
      }
      setLoading(false);
    };
    fetchBem();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bem) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Bem não encontrado." });
      return;
    }
    setSaving(true);

    try {
      // 1. Registrar no histórico de movimentações
      const { error: movError } = await supabase.from('patrimonio_movimentacoes').insert([{
        igreja_id: bem.igreja_id,
        bem_id: id,
        tipo_movimentacao: formData.tipo_movimentacao,
        responsavel: formData.responsavel,
        local_destino: formData.local_destino,
        data_movimentacao: formData.data_movimentacao,
        observacao: formData.observacao
      }]);

      if (movError) throw movError;

      // 2. Atualizar o status e localização do Bem
      let novoStatus = bem.status;
      let novaLocalizacao = bem.localizacao;

      if (formData.tipo_movimentacao === 'Empréstimo') novoStatus = 'Emprestado';
      if (formData.tipo_movimentacao === 'Devolução') novoStatus = 'Em Uso';
      if (formData.tipo_movimentacao === 'Manutenção') novoStatus = 'Em Manutenção';
      if (formData.tipo_movimentacao === 'Transferência') novaLocalizacao = formData.local_destino || bem.localizacao;

      const { error: bemError } = await supabase.from('patrimonio_bens').update({
        status: novoStatus,
        localizacao: novaLocalizacao
      }).eq('id', id);

      if (bemError) throw bemError;

      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Movimentação registrada e status atualizado!" });
      setTimeout(() => router.push("/patrimonio"), 1500);

    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível registrar a movimentação." });
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando bem...</div>;
  if (!bem) return <div className="p-10 text-center text-red-500">Bem não encontrado.</div>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-3">
        <Link href="/patrimonio" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-ohel-blue" /> Movimentar Bem
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Registre transferências, empréstimos ou manutenção.</p>
        </div>
      </div>

      {/* Card com dados do Bem */}
      <Card className="p-4 border-gray-800 bg-ohel-bg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ohel-blue/10 flex items-center justify-center"><Package className="w-5 h-5 text-ohel-blue" /></div>
          <div>
            <h2 className="text-sm font-bold text-white">{bem.descricao}</h2>
            <p className="text-[11px] text-gray-400">
              Status atual: <span className="text-ohel-blue font-bold">{bem.status}</span> | Local: {bem.localizacao || "Não informado"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5 border-gray-800 bg-ohel-surface">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Tipo de Movimentação *</label>
            <select name="tipo_movimentacao" value={formData.tipo_movimentacao} onChange={handleChange} required className="input-ohel w-full px-3 py-2 rounded-md text-xs">
              <option value="Transferência">Transferência (Mudar de Local)</option>
              <option value="Empréstimo">Empréstimo (Sair da Igreja)</option>
              <option value="Devolução">Devolução (Retornar à Igreja)</option>
              <option value="Manutenção">Manutenção (Conserto)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-3 top-8 text-gray-500" />
              <Input label="Responsável" name="responsavel" placeholder="Quem está levando?" value={formData.responsavel} onChange={handleChange} className="py-2 text-xs pl-9" />
            </div>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-8 text-gray-500" />
              <Input label="Data *" type="date" name="data_movimentacao" value={formData.data_movimentacao} onChange={handleChange} required className="py-2 text-xs pl-9" />
            </div>
          </div>

          {formData.tipo_movimentacao === 'Transferência' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-ohel-silver">Novo Local de Destino *</label>
              <select name="local_destino" value={formData.local_destino} onChange={handleChange} required className="input-ohel w-full rounded-md px-3 py-2 text-xs">
                <option value="">Selecione um local cadastrado</option>
                {localizacoes.map(place => <option key={place.id} value={place.nome}>{place.nome}</option>)}
              </select>
              {!localizacoes.length && <Link href="/configuracoes/cadastros-patrimonio" className="text-[11px] text-ohel-blue hover:underline">Cadastre os locais nas tabelas mestras.</Link>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Observações</label>
            <textarea 
              name="observacao" 
              value={formData.observacao} 
              onChange={handleChange}
              placeholder="Ex: Emprestado para o retiro de jovens, previsão de retorno 15/11."
              className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[80px] resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Link href="/patrimonio" className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors">Cancelar</Link>
            <Button type="submit" disabled={saving} className="w-auto px-6 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
              <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Confirmar Movimentação"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}