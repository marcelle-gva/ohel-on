"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Edit, Package, Plus, Search, Trash2, X } from "lucide-react";

interface Departamento { id: string; nome: string; responsavel_usuario_id: string | null; }
interface Fornecedor { id: string; razao_social: string; departamento_id: string | null; }
interface Produto { id: string; nome: string; descricao: string | null; sku: string | null; unidade: string; preco_custo: number; preco_venda: number; estoque: number; estoque_minimo: number; status: string; departamento_id: string | null; fornecedor_id: string | null; departamentos?: { nome: string } | null; fornecedores?: { razao_social: string } | null; }

type FormProduto = { nome: string; descricao: string; sku: string; unidade: string; preco_custo: string; preco_venda: string; estoque: string; estoque_minimo: string; status: string; departamento_id: string; fornecedor_id: string };
const vazio: FormProduto = { nome: "", descricao: "", sku: "", unidade: "unidade", preco_custo: "0", preco_venda: "0", estoque: "0", estoque_minimo: "0", status: "Ativo", departamento_id: "", fornecedor_id: "" };

export default function ProdutosPage() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [filtroDepartamento, setFiltroDepartamento] = useState("");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState<FormProduto>(vazio);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const carregar = async (id: string) => {
    const [produtosRes, depsRes, fornecedoresRes] = await Promise.all([
      supabase.from("produtos").select("*, departamentos(nome), fornecedores(razao_social)").eq("igreja_id", id).order("nome"),
      supabase.from("departamentos").select("id, nome, responsavel_usuario_id").eq("igreja_id", id).eq("ativo", true).order("nome"),
      supabase.from("fornecedores").select("id, razao_social, departamento_id").eq("igreja_id", id).order("razao_social"),
    ]);
    if (produtosRes.error) throw produtosRes.error;
    setProdutos(produtosRes.data || []); setDepartamentos(depsRes.data || []); setFornecedores(fornecedoresRes.data || []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: usuario } = await supabase.from("usuarios").select("igreja_id").eq("id", session.user.id).maybeSingle();
      if (!usuario?.igreja_id) return;
      setIgrejaId(usuario.igreja_id);
      const param = new URLSearchParams(window.location.search).get("departamento") || "";
      setFiltroDepartamento(param); setLoading(true);
      try { await carregar(usuario.igreja_id); } catch (error) { setFeedback({ isOpen: true, type: "error", title: "Erro", message: error instanceof Error ? error.message : "Não foi possível carregar os produtos." }); } finally { setLoading(false); }
    };
    void init();
  }, []);

  const fornecedoresDoDepartamento = useMemo(() => form.departamento_id ? fornecedores.filter((fornecedor) => fornecedor.departamento_id === form.departamento_id || fornecedor.departamento_id === null) : fornecedores, [form.departamento_id, fornecedores]);
  const visiveis = produtos.filter((produto) => (!filtroDepartamento || produto.departamento_id === filtroDepartamento) && produto.nome.toLowerCase().includes(busca.toLowerCase()));
  const abrirNovo = () => { setEditingId(null); setForm({ ...vazio, departamento_id: filtroDepartamento }); setModalOpen(true); };
  const abrirEdicao = (produto: Produto) => { setEditingId(produto.id); setForm({ nome: produto.nome, descricao: produto.descricao || "", sku: produto.sku || "", unidade: produto.unidade, preco_custo: String(produto.preco_custo ?? 0), preco_venda: String(produto.preco_venda ?? 0), estoque: String(produto.estoque ?? 0), estoque_minimo: String(produto.estoque_minimo ?? 0), status: produto.status, departamento_id: produto.departamento_id || "", fornecedor_id: produto.fornecedor_id || "" }); setModalOpen(true); };
  const salvar = async (event: React.FormEvent) => {
    event.preventDefault(); if (!igrejaId || !form.nome.trim()) return;
    setSaving(true);
    const payload = { igreja_id: igrejaId, nome: form.nome.trim(), descricao: form.descricao.trim() || null, sku: form.sku.trim() || null, unidade: form.unidade.trim() || "unidade", preco_custo: Number(form.preco_custo) || 0, preco_venda: Number(form.preco_venda) || 0, estoque: Number(form.estoque) || 0, estoque_minimo: Number(form.estoque_minimo) || 0, status: form.status, departamento_id: form.departamento_id || null, fornecedor_id: form.fornecedor_id || null };
    const query = editingId ? supabase.from("produtos").update(payload).eq("id", editingId).eq("igreja_id", igrejaId) : supabase.from("produtos").insert(payload);
    const { error } = await query;
    setSaving(false);
    if (error) { setFeedback({ isOpen: true, type: "error", title: "Não foi possível salvar", message: error.message }); return; }
    setModalOpen(false); setFeedback({ isOpen: true, type: "success", title: "Produto salvo", message: "O catálogo geral foi atualizado." }); await carregar(igrejaId);
  };
  const excluir = async (id: string) => { if (!igrejaId || !window.confirm("Excluir este produto?")) return; const { error } = await supabase.from("produtos").delete().eq("id", id).eq("igreja_id", igrejaId); if (error) setFeedback({ isOpen: true, type: "error", title: "Não foi possível excluir", message: error.message }); else setProdutos((atual) => atual.filter((produto) => produto.id !== id)); };
  const setCampo = (campo: keyof FormProduto, value: string) => setForm((atual) => ({ ...atual, [campo]: value, ...(campo === "departamento_id" ? { fornecedor_id: "" } : {}) }));

  return <div className="max-w-7xl mx-auto flex flex-col gap-5 pb-10"><FeedbackModal isOpen={feedback.isOpen} onClose={() => setFeedback({ ...feedback, isOpen: false })} type={feedback.type} title={feedback.title} message={feedback.message} />
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/financeiro" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-xl font-bold text-white flex items-center gap-2"><Package className="w-5 h-5 text-ohel-blue" /> Produtos gerais</h1><p className="text-gray-400 text-xs mt-1">Catálogo consolidado da igreja, organizado por departamento.</p></div></div><div className="flex gap-2"><Link href="/financeiro/fornecedores" className="px-4 py-2 rounded-md border border-gray-700 text-xs text-gray-300 hover:text-white">Fornecedores gerais</Link><Button onClick={abrirNovo} className="w-auto px-4 py-2 text-xs"><Plus className="w-4 h-4 mr-1" /> Novo produto</Button></div></div>
    <Card className="p-4 border-gray-800"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." className="input-ohel w-full pl-9 pr-3 py-2 rounded-md text-xs" /></div><select value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)} className="input-ohel px-3 py-2 rounded-md text-xs"><option value="">Todos os departamentos</option>{departamentos.map((departamento) => <option key={departamento.id} value={departamento.id}>{departamento.nome}</option>)}</select></div></Card>
    <Card className="p-0 overflow-hidden border-gray-800"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-ohel-surface border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="p-4">Produto</th><th className="p-4">Departamento</th><th className="p-4">Fornecedor</th><th className="p-4">Venda</th><th className="p-4">Estoque</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y divide-gray-800/50">{loading ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Carregando...</td></tr> : visiveis.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum produto encontrado.</td></tr> : visiveis.map((produto) => <tr key={produto.id} className="hover:bg-white/[.02]"><td className="p-4"><p className="font-medium text-white">{produto.nome}</p><p className="text-[10px] text-gray-500">{produto.sku || "Sem SKU"} · {produto.unidade}</p></td><td className="p-4 text-gray-300">{produto.departamentos?.nome || "Geral"}</td><td className="p-4 text-gray-300">{produto.fornecedores?.razao_social || "-"}</td><td className="p-4 text-gray-300">R$ {Number(produto.preco_venda).toFixed(2).replace(".", ",")}</td><td className={`p-4 ${produto.estoque <= produto.estoque_minimo ? "text-yellow-400" : "text-gray-300"}`}>{produto.estoque} {produto.unidade}</td><td className="p-4"><div className="flex gap-2"><button type="button" onClick={() => abrirEdicao(produto)} className="text-gray-500 hover:text-ohel-blue" title="Editar"><Edit className="w-4 h-4" /></button><button type="button" onClick={() => void excluir(produto.id)} className="text-gray-500 hover:text-red-400" title="Excluir"><Trash2 className="w-4 h-4" /></button></div></td></tr>)}</tbody></table></div></Card>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="bg-ohel-surface border border-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between mb-5"><h2 className="font-bold text-white">{editingId ? "Editar produto" : "Novo produto"}</h2><button type="button" onClick={() => setModalOpen(false)} className="text-gray-400"><X className="w-4 h-4" /></button></div><form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><Input label="Nome *" value={form.nome} onChange={(e) => setCampo("nome", e.target.value)} required /></div><Input label="SKU / código" value={form.sku} onChange={(e) => setCampo("sku", e.target.value)} /><Input label="Unidade" value={form.unidade} onChange={(e) => setCampo("unidade", e.target.value)} /><Input label="Preço de custo" type="number" min="0" step="0.01" value={form.preco_custo} onChange={(e) => setCampo("preco_custo", e.target.value)} /><Input label="Preço de venda" type="number" min="0" step="0.01" value={form.preco_venda} onChange={(e) => setCampo("preco_venda", e.target.value)} /><Input label="Estoque atual" type="number" min="0" step="0.001" value={form.estoque} onChange={(e) => setCampo("estoque", e.target.value)} /><Input label="Estoque mínimo" type="number" min="0" step="0.001" value={form.estoque_minimo} onChange={(e) => setCampo("estoque_minimo", e.target.value)} /><div><label className="field-label">Departamento</label><select value={form.departamento_id} onChange={(e) => setCampo("departamento_id", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm"><option value="">Produto geral</option>{departamentos.map((departamento) => <option key={departamento.id} value={departamento.id}>{departamento.nome}</option>)}</select></div><div><label className="field-label">Fornecedor</label><select value={form.fornecedor_id} onChange={(e) => setCampo("fornecedor_id", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm"><option value="">Sem fornecedor</option>{fornecedoresDoDepartamento.map((fornecedor) => <option key={fornecedor.id} value={fornecedor.id}>{fornecedor.razao_social}</option>)}</select></div><div className="md:col-span-2"><label className="field-label">Descrição</label><textarea value={form.descricao} onChange={(e) => setCampo("descricao", e.target.value)} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-20" /></div><div className="md:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs text-gray-400">Cancelar</button><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar produto"}</Button></div></form></div></div>}
    <style jsx>{`.field-label{display:block;color:#a1a1aa;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem}`}</style>
  </div>;
}
