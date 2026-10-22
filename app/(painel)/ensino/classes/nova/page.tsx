"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, GraduationCap } from "lucide-react";
import Link from "next/link";

export default function NovaClasseEbdPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [membros, setMembros] = useState<any[]>([]);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", faixa_etaria: "Adultos", professor_id: "", sala: "", horario: "09:00", status: "Ativa"
  });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          setIgrejaId(user.igreja_id);
          // Busca todos os membros para o select de professor
          const { data: membs } = await supabase.from('membros').select('id, nome, cargo').eq('igreja_id', user.igreja_id).order('nome');
          if (membs) setMembros(membs);
        }
      }
    };
    init();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("ebd_classes").insert([{
        igreja_id: igrejaId,
        nome: formData.nome,
        faixa_etaria: formData.faixa_etaria,
        professor_id: formData.professor_id || null,
        sala: formData.sala,
        horario: formData.horario,
        status: formData.status
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Classe criada com sucesso!" });
      setTimeout(() => router.push("/ensino/classes"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao criar", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/ensino/classes" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-ohel-blue" /> Nova Classe da EBD
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Crie uma nova turma para a Escola Bíblica Dominical.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Salvando..." : "Salvar Classe"}
        </Button>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input label="Nome da Classe *" name="nome" placeholder="Ex: Classe de Jovens, Discipulado 1..." value={formData.nome} onChange={handleChange} required className="py-2 text-xs" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Faixa Etária / Público *</label>
              <select name="faixa_etaria" value={formData.faixa_etaria} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="Bebês">Bebês (0 a 3 anos)</option>
                <option value="Crianças">Crianças (4 a 11 anos)</option>
                <option value="Adolescentes">Adolescentes (12 a 17 anos)</option>
                <option value="Jovens">Jovens (18 a 30 anos)</option>
                <option value="Adultos">Adultos (Acima de 30)</option>
                <option value="Melhor Idade">Melhor Idade</option>
                <option value="Misto">Misto / Geral</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Professor Responsável</label>
              <select name="professor_id" value={formData.professor_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="">Selecione um professor...</option>
                {membros.map(m => <option key={m.id} value={m.id}>{m.nome} {m.cargo ? `(${m.cargo})` : ''}</option>)}
              </select>
            </div>

            <Input label="Sala / Local" name="sala" placeholder="Ex: Sala 1, Templo Principal" value={formData.sala} onChange={handleChange} className="py-2 text-xs" />
            <Input label="Horário da Aula" type="time" name="horario" value={formData.horario} onChange={handleChange} className="py-2 text-xs" />

            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Status da Classe</label>
              <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                <option value="Ativa">Ativa</option>
                <option value="Inativa">Inativa</option>
              </select>
            </div>
          </div>

        </form>
      </Card>
    </div>
  );
}