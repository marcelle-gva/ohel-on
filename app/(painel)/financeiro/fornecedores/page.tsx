"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Plus, Search, Edit, Trash2, AlertTriangle, Users2, X } from "lucide-react";
import Link from "next/link";

export default function FornecedoresPage() {
  const [loading, setLoading] = useState(true);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  
  const [showModal, setShowModal] = useState(false);
  const [editingFornecedorId, setEditingFornecedorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  
  const [formData, setFormData] = useState({
    razao_social: "", nome_fantasia: "", cnpj_cpf: "", email: "", telefone: "", endereco: ""
  });

  const [fornecedorToDelete, setFornecedorToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    initPage();
  }, []);

  const initPage = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
      if (user) {
        setIgrejaId(user.igreja_id);
        fetchFornecedores(user.igreja_id);
      }
    }
  };

  const fetchFornecedores = async (id: string) => {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').eq('igreja_id', id).order('razao_social');
    if (data) setFornecedores(data);
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada. Entre novamente no sistema." });
      return;
    }

    setSaving(true);
    try {
      if (editingFornecedorId) {
        const { data, error } = await supabase.from("fornecedores").update(formData)
          .eq("id", editingFornecedorId).eq("igreja_id", igrejaId).select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Fornecedor não encontrado ou sem permissão para atualizar.");
      } else {
        const { error } = await supabase.from("fornecedores").insert([{ igreja_id: igrejaId, ...formData }]);
        if (error) throw error;
      }
      
      setShowModal(false);
      setEditingFornecedorId(null);
      setFormData({ razao_social: "", nome_fantasia: "", cnpj_cpf: "", email: "", telefone: "", endereco: "" });
      await fetchFornecedores(igrejaId);
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: editingFornecedorId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message || "Não foi possível salvar o fornecedor." });
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (fornecedor: typeof fornecedores[number]) => {
    setEditingFornecedorId(fornecedor.id);
    setFormData({
      razao_social: fornecedor.razao_social || "",
      nome_fantasia: fornecedor.nome_fantasia || "",
      cnpj_cpf: fornecedor.cnpj_cpf || "",
      email: fornecedor.email || "",
      telefone: fornecedor.telefone || "",
      endereco: fornecedor.endereco || "",
    });
    setShowModal(true);
  };

  const fecharModalFornecedor = () => {
    setShowModal(false);
    setEditingFornecedorId(null);
    setFormData({ razao_social: "", nome_fantasia: "", cnpj_cpf: "", email: "", telefone: "", endereco: "" });
  };

  const handleDelete = async () => {
    if (!fornecedorToDelete) return;
    setIsDeleting(true);
    try {
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const { data, error } = await supabase
        .from("fornecedores")
        .delete()
        .eq("id", fornecedorToDelete)
        .eq("igreja_id", igrejaId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Fornecedor não encontrado ou sem permissão para excluir.");
      setFornecedores((current) => current.filter((f) => f.id !== fornecedorToDelete));
      setFornecedorToDelete(null);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível excluir", message: error.message || "Verifique se há contas a pagar vinculadas." });
    } finally {
      setIsDeleting(false);
    }
  };

  const fornecedoresFiltrados = fornecedores.filter(f => 
    f.razao_social.toLowerCase().includes(busca.toLowerCase()) || 
    (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(busca.toLowerCase())) ||
    (f.cnpj_cpf && f.cnpj_cpf.includes(busca))
  );

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/financeiro" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Users2 className="w-5 h-5 text-ohel-blue" /> Fornecedores
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Gerencie as empresas e prestadores de serviços.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou CNPJ..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-ohel-bg border border-gray-700 text-xs text-white rounded-md pl-9 pr-3 py-2 focus:border-ohel-blue outline-none"
            />
          </div>
          <Button onClick={() => setShowModal(true)} className="w-auto px-5 py-2 text-xs bg-ohel-blue hover:bg-blue-600 text-white">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-ohel-surface border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="p-4 font-medium">Ações</th>
              <th className="p-4 font-medium">Razão Social</th>
              <th className="p-4 font-medium">CNPJ / CPF</th>
              <th className="p-4 font-medium">Contato</th>
              <th className="p-4 font-medium">Cidade / Endereço</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Carregando fornecedores...</td></tr>
            ) : fornecedoresFiltrados.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Nenhum fornecedor cadastrado.</td></tr>
            ) : (
              fornecedoresFiltrados.map((forn) => (
                <tr key={forn.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => handleEditar(forn)} className="text-gray-500 hover:text-ohel-blue transition-colors" title="Editar fornecedor" aria-label={`Editar ${forn.razao_social}`}><Edit className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setFornecedorToDelete(forn.id)} className="text-gray-500 hover:text-red-500 transition-colors" title="Excluir fornecedor" aria-label={`Excluir ${forn.razao_social}`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-white font-medium">{forn.razao_social}</p>
                    {forn.nome_fantasia && <p className="text-[10px] text-gray-500">{forn.nome_fantasia}</p>}
                  </td>
                  <td className="p-4 text-gray-300">{forn.cnpj_cpf || "-"}</td>
                  <td className="p-4 text-gray-300">
                    <p>{forn.telefone || "-"}</p>
                    <p className="text-[10px] text-gray-500">{forn.email || "-"}</p>
                  </td>
                  <td className="p-4 text-gray-400 truncate max-w-[200px]">{forn.endereco || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* MODAL DE CADASTRO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white">{editingFornecedorId ? "Editar Fornecedor" : "Novo Fornecedor"}</h3>
              <button type="button" onClick={fecharModalFornecedor} className="text-gray-500 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSalvar} className="flex flex-col gap-4">
              <Input label="Razão Social *" name="razao_social" value={formData.razao_social} onChange={handleChange} required className="py-2 text-xs" />
              <Input label="Nome Fantasia" name="nome_fantasia" value={formData.nome_fantasia} onChange={handleChange} className="py-2 text-xs" />
              
              <div className="grid grid-cols-2 gap-3">
                <Input label="CNPJ / CPF" name="cnpj_cpf" value={formData.cnpj_cpf} onChange={handleChange} className="py-2 text-xs" />
                <Input label="Telefone" name="telefone" value={formData.telefone} onChange={handleChange} className="py-2 text-xs" />
              </div>
              
              <Input label="E-mail" type="email" name="email" value={formData.email} onChange={handleChange} className="py-2 text-xs" />
              <Input label="Endereço Completo" name="endereco" value={formData.endereco} onChange={handleChange} className="py-2 text-xs" />

              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={fecharModalFornecedor} className="px-4 py-2 text-xs text-gray-400 hover:text-white">Cancelar</button>
                <Button type="submit" disabled={saving} className="w-auto px-5 py-2 text-xs bg-ohel-blue text-white">{saving ? "Salvando..." : editingFornecedorId ? "Salvar Alterações" : "Salvar Fornecedor"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {fornecedorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-500" /></div>
              <h3 className="text-sm font-bold text-white">Excluir Fornecedor</h3>
            </div>
            <p className="text-gray-400 text-xs mb-5">Tem certeza que deseja excluir este fornecedor?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setFornecedorToDelete(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancelar</button>
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