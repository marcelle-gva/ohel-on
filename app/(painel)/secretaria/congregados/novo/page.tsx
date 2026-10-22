"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, User, Upload, Loader2, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function NovoCongregadoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [congregacoes, setCongregacoes] = useState<{id: string, nome: string}[]>([]);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const [formData, setFormData] = useState({
    nome: "", data_nascimento: "", telefone: "", congregacao_id: "", status: "Ativo", foto_url: "",
    conjuge_nome: ""
  });

  // Estado para os filhos
  const [filhos, setFilhos] = useState<{ nome: string; idade: string }[]>([]);
  const [novoFilho, setNovoFilho] = useState({ nome: "", idade: "" });

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }
      const { data: congs } = await supabase.from('congregacoes').select('id, nome').order('nome');
      if (congs) setCongregacoes(congs);
    };
    initPage();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addFilho = () => {
    if (!novoFilho.nome) return;
    setFilhos([...filhos, novoFilho]);
    setNovoFilho({ nome: "", idade: "" });
  };

  const removeFilho = (index: number) => {
    setFilhos(filhos.filter((_, i) => i !== index));
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = await supabase.storage.from('avatars').getPublicUrl(fileName);
      setFormData({ ...formData, foto_url: data.publicUrl });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro no Upload", message: "Não foi possível enviar a foto." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
    
    setLoading(true);
    try {
      const { error } = await supabase.from("congregados").insert([{
        igreja_id: igrejaId,
        nome: formData.nome,
        data_nascimento: formData.data_nascimento || null,
        telefone: formData.telefone,
        congregacao_id: formData.congregacao_id || null,
        status: formData.status,
        foto_url: formData.foto_url || null,
        conjuge_nome: formData.conjuge_nome || null,
        filhos: filhos
      }]);

      if (error) throw error;
      
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Congregado cadastrado com sucesso!" });
      setTimeout(() => router.push("/secretaria/congregados"), 1500);

    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro ao Cadastrar", message: error.message });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/congregados" className="text-gray-400 hover:text-white transition-colors mt-0.5"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Novo Congregado</h1>
            <p className="text-gray-400 text-xs mt-0.5">Cadastre uma pessoa que frequenta a igreja.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || uploading} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {loading ? "Salvando..." : "Salvar Congregado"}
        </Button>
      </div>

      <Card className="p-6 flex flex-col gap-6">
        
        {/* FOTO */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-800">
          <div className="w-16 h-16 bg-ohel-bg rounded-lg border border-dashed border-gray-700 flex items-center justify-center text-gray-500 overflow-hidden relative">
            {formData.foto_url ? (
              <Image src={formData.foto_url} alt="Preview" fill sizes="64px" className="object-cover" />
            ) : (
              <User className="w-6 h-6" />
            )}
          </div>
          <div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUploadFoto} className="hidden" />
            <Button type="button" variant="secondary" className="w-auto px-3 py-1.5 text-[11px]" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Enviando...</> : <><Upload className="w-3 h-3 mr-1.5" /> Adicionar Foto</>}
            </Button>
            <p className="text-[10px] text-gray-500 mt-1">Rec: quadrada, máx. 5MB.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* DADOS BÁSICOS */}
          <div>
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3">Dados Básicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Input label="Nome Completo *" name="nome" placeholder="Ex: Maria Souza" value={formData.nome} onChange={handleChange} required className="py-2 text-xs" />
              </div>
              <Input label="Data de Nascimento" type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Telefone / WhatsApp" name="telefone" placeholder="(00) 00000-0000" value={formData.telefone} onChange={handleChange} className="py-2 text-xs" />
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Congregação</label>
                <select name="congregacao_id" value={formData.congregacao_id} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="">Selecione...</option>
                  {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="input-ohel w-full px-3 py-2 rounded-md text-xs">
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Em Discipulado">Em Discipulado</option>
                </select>
              </div>
            </div>
          </div>

          {/* FAMÍLIA */}
          <div className="border-t border-gray-800 pt-5">
            <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Informações Familiares
            </h3>
            
            <Input label="Nome do Cônjuge" name="conjuge_nome" placeholder="Nome do esposo(a)" value={formData.conjuge_nome} onChange={handleChange} className="py-2 text-xs mb-4" />

            {/* LISTA DE FILHOS */}
            <div className="bg-ohel-bg border border-gray-800 p-4 rounded-lg">
              <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-2 block">Filhos</label>
              
              <div className="flex flex-col md:flex-row gap-2 items-end mb-4">
                <div className="flex-1 w-full">
                  <Input placeholder="Nome do filho(a)" value={novoFilho.nome} onChange={e => setNovoFilho({...novoFilho, nome: e.target.value})} className="py-2 text-xs" />
                </div>
                <div className="w-full md:w-32">
                  <Input placeholder="Idade" value={novoFilho.idade} onChange={e => setNovoFilho({...novoFilho, idade: e.target.value})} className="py-2 text-xs" />
                </div>
                <Button type="button" variant="secondary" onClick={addFilho} className="px-4 py-2 text-xs h-[34px] w-full md:w-auto">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                </Button>
              </div>

              {filhos.length > 0 ? (
                <div className="flex flex-col gap-2 mt-2">
                  {filhos.map((filho, index) => (
                    <div key={index} className="flex items-center justify-between bg-ohel-surface/50 border border-gray-800 p-2.5 rounded text-xs">
                      <span className="text-white font-medium">{filho.nome} <span className="text-gray-500">({filho.idade} anos)</span></span>
                      <button type="button" onClick={() => removeFilho(index)} className="text-red-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic mt-1">Nenhum filho adicionado.</p>
              )}
            </div>
          </div>

        </form>
      </Card>
    </div>
  );
}