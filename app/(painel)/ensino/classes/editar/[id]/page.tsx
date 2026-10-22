"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, GraduationCap, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function EditarClasseEbdPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [membros, setMembros] = useState<any[]>([]);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    nome: "", faixa_etaria: "", professor_id: "", sala: "", horario: "", status: "Ativa"
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        // 1. Carrega os membros para o select de professor
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
          if (user) {
            setIgrejaId(user.igreja_id);
            const { data: membs } = await supabase.from('membros').select('id, nome, cargo').eq('igreja_id', user.igreja_id).order('nome');
            if (membs) setMembros(membs);
          }
        }

        // 2. Carrega os dados da classe específica
        const { data: classe, error } = await supabase.from('ebd_classes').select('*').eq('id', id).single();
        if (error) throw error;

        if (classe) {
          setFormData({
            nome: classe.nome || "",
            faixa_etaria: classe.faixa_etaria || "Adultos",
            professor_id: classe.professor_id || "",
            sala: classe.sala || "",
            horario: classe.horario || "09:00",
            status: classe.status || "Ativa"
          });
        }
      } catch (error: any) {
        setModal({ isOpen: true, type: "error", title: "Erro", message: "Classe não encontrada." });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("ebd_classes").update({
        nome: formData.nome,
        faixa_etaria: formData.faixa_etaria,
        professor_id: formData.professor_id || null,
        sala: formData.sala,
        horario: formData.horario,
        status: formData.status
      }).eq("id", id);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Classe atualizada com sucesso!" });
      setTimeout(() => router.push("/ensino/classes"), 1500);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao atualizar", message: error.message });
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Ao deletar a classe, as matrículas vinculadas também serão apagadas (ON DELETE CASCADE)
      const { error } = await supabase.from("ebd_classes").delete().eq("id", id);
      if (error) throw error;
      
      router.push("/ensino/classes");
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao excluir", message: "Não foi possível excluir a classe. Verifique se há alunos matriculados." });
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando classe...</div>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/ensino/classes" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-ohel-blue" /> Editar Classe da EBD
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Atualize as informações da turma.</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 text-xs font-medium text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-md transition-colors flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving} className="w-auto px-6 py-2 text-xs">
            <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input label="Nome da Classe *" name="nome" value={formData.nome} onChange={handleChange} required className="py-2 text-xs" />
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

            <Input label="Sala / Local" name="sala" value={formData.sala} onChange={handleChange} className="py-2 text-xs" />
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

      {/* MODAL DE EXCLUSÃO */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
              <h3 className="text-sm font-bold text-white">Excluir Classe</h3>
            </div>
            <p className="text-gray-400 text-xs mb-5">Tem certeza que deseja excluir esta classe? Todas as matrículas e chamadas vinculadas a ela serão perdidas.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-1.5 px-3 rounded text-xs" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}