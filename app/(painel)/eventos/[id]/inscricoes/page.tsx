"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { uploadChurchFile } from "@/lib/private-storage";
import { ArrowLeft, Search, Plus, Trash2, AlertTriangle, Users, CheckCircle, QrCode, ShoppingBag, X, Upload, Loader2, DollarSign } from "lucide-react";
import QRCode from "react-qr-code";

interface Inscricao { id: string; nome: string; telefone: string; status: string; created_at: string; }
interface Variacao { id: string; nome: string; preco: number; }
interface Produto { id: string; nome: string; preco: number; variacoes: Variacao[]; }
interface Pedido {
  id: string; nome_comprador: string; telefone: string; quantidade: number; status: string; created_at: string;
  eventos_produtos: { nome: string } | null;
  eventos_produtos_variacoes: { nome: string; preco: number } | null;
}

export default function GerenciarEventoPage() {
  const router = useRouter();
  const params = useParams();
  const eventoId = params.id as string;

  const [activeTab, setActiveTab] = useState("inscricoes");
  const [evento, setEvento] = useState<any>(null);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [igrejaId, setIgrejaId] = useState<string | null>(null);

  // Modais
  const [modalFeedback, setModalFeedback] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isAddInscritoModalOpen, setIsAddInscritoModalOpen] = useState(false);
  const [isAddProdutoModalOpen, setIsAddProdutoModalOpen] = useState(false);
  const [isAddPedidoModalOpen, setIsAddPedidoModalOpen] = useState(false);
  
  const [itemToDelete, setItemToDelete] = useState<{ type: 'inscricao' | 'produto' | 'pedido', id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Forms
  const [novaInscricao, setNovaInscricao] = useState({ nome: "", telefone: "" });
  
  // Form Produto (com variações dinâmicas)
  const [novoProdutoNome, setNovoProdutoNome] = useState("");
  const [novasVariacoes, setNovasVariacoes] = useState<{ nome: string; preco: string }[]>([{ nome: "", preco: "" }]);
  
  // Form Pedido
  const [novoPedido, setNovoPedido] = useState({ produto_id: "", variacao_id: "", nome_comprador: "", telefone: "", quantidade: "1" });
  const [variacoesDoPedido, setVariacoesDoPedido] = useState<Variacao[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchDados(); }, [eventoId]);

  const fetchDados = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) setIgrejaId(user.igreja_id);
      }

      const { data: ev } = await supabase.from('eventos').select('*').eq('id', eventoId).single();
      setEvento(ev);

      const { data: ins } = await supabase.from('inscricoes_eventos').select('*').eq('evento_id', eventoId).order('created_at', { ascending: false });
      setInscricoes(ins || []);

      // Busca produtos e traz suas variações juntas
      const { data: prod } = await supabase.from('eventos_produtos').select('*, eventos_produtos_variacoes(*)').eq('evento_id', eventoId).order('nome');
      setProdutos(prod || []);

      const { data: ped } = await supabase.from('eventos_pedidos').select('*, eventos_produtos(nome), eventos_produtos_variacoes(nome, preco)').eq('evento_id', eventoId).order('created_at', { ascending: false });
      setPedidos(ped || []);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInscricao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('inscricoes_eventos').insert([{ igreja_id: igrejaId, evento_id: eventoId, nome: novaInscricao.nome, telefone: novaInscricao.telefone, status: 'Confirmado' }]).select().single();
      if (error) throw error;
      setInscricoes([data, ...inscricoes]);
      setIsAddInscritoModalOpen(false);
      setNovaInscricao({ nome: "", telefone: "" });
      setModalFeedback({ isOpen: true, type: "success", title: "Sucesso", message: "Inscrição realizada!" });
    } catch (error: any) { setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error.message }); } finally { setSaving(false); }
  };

  const handleAddProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId || !novoProdutoNome) return;
    setSaving(true);
    try {
      // 1. Cria o Produto Base
      const { data: prodData, error: prodError } = await supabase.from('eventos_produtos').insert([{ 
        igreja_id: igrejaId, evento_id: eventoId, nome: novoProdutoNome 
      }]).select().single();
      if (prodError) throw prodError;

      // 2. Cria as Variações (Tamanhos e Preços)
      const variacoesParaInserir = novasVariacoes
        .filter(v => v.nome && v.preco)
        .map(v => ({
          igreja_id: igrejaId,
          produto_id: prodData.id,
          nome: v.nome,
          preco: parseFloat(v.preco)
        }));

      if (variacoesParaInserir.length > 0) {
        const { error: varError } = await supabase.from('eventos_produtos_variacoes').insert(variacoesParaInserir);
        if (varError) throw varError;
      }

      setIsAddProdutoModalOpen(false);
      setNovoProdutoNome("");
      setNovasVariacoes([{ nome: "", preco: "" }]);
      setModalFeedback({ isOpen: true, type: "success", title: "Sucesso", message: "Produto e tamanhos cadastrados!" });
      fetchDados(); // Recarrega a lista
    } catch (error: any) { setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error.message }); } finally { setSaving(false); }
  };

  const handleProdutoChange = (produtoId: string) => {
    setNovoPedido({ ...novoPedido, produto_id: produtoId, variacao_id: "" });
    const prod = produtos.find(p => p.id === produtoId);
    setVariacoesDoPedido(prod?.variacoes || []);
  };

  const handleAddPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId || !novoPedido.produto_id || !novoPedido.variacao_id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('eventos_pedidos').insert([{ 
        igreja_id: igrejaId, evento_id: eventoId, produto_id: novoPedido.produto_id, 
        variacao_id: novoPedido.variacao_id, nome_comprador: novoPedido.nome_comprador, 
        telefone: novoPedido.telefone, quantidade: parseInt(novoPedido.quantidade), status: 'Pendente' 
      }]).select('*, eventos_produtos(nome), eventos_produtos_variacoes(nome, preco)').single();
      
      if (error) throw error;
      setPedidos([data, ...pedidos]);
      setIsAddPedidoModalOpen(false);
      setNovoPedido({ produto_id: "", variacao_id: "", nome_comprador: "", telefone: "", quantidade: "1" });
      setVariacoesDoPedido([]);
      setModalFeedback({ isOpen: true, type: "success", title: "Pedido Lançado", message: "O pedido foi registrado como Pendente." });
    } catch (error: any) { setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: error.message }); } finally { setSaving(false); }
  };

  const handleUploadComprovante = async (e: React.ChangeEvent<HTMLInputElement>, pedidoId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `comprovante-${pedidoId}-${Date.now()}.${fileExt}`;
      if (!igrejaId) throw new Error("Igreja não identificada.");
      const path = await uploadChurchFile(supabase, "comprovantes", igrejaId, file, fileName);
      const { error } = await supabase.from('eventos_pedidos').update({ comprovante_url: path }).eq('id', pedidoId);
      if (error) throw error;
      setPedidos(pedidos.map(p => p.id === pedidoId ? { ...p, comprovante_url: path } : p));
      setModalFeedback({ isOpen: true, type: "success", title: "Comprovante Anexado", message: "A imagem foi salva no pedido." });
    } catch (error) { setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: "Não foi possível enviar o comprovante." }); } finally { setUploading(false); }
  };

  const handleMarcarPago = async (pedidoId: string) => {
    try {
      await supabase.from('eventos_pedidos').update({ status: 'Pago' }).eq('id', pedidoId);
      setPedidos(pedidos.map(p => p.id === pedidoId ? { ...p, status: 'Pago' } : p));
      setModalFeedback({ isOpen: true, type: "success", title: "Pagamento Confirmado", message: "O status do pedido foi alterado para Pago." });
    } catch (error) { setModalFeedback({ isOpen: true, type: "error", title: "Erro", message: "Erro ao atualizar o status." }); }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const table = itemToDelete.type === 'inscricao' ? 'inscricoes_eventos' : itemToDelete.type === 'produto' ? 'eventos_produtos' : 'eventos_pedidos';
      await supabase.from(table).delete().eq('id', itemToDelete.id);
      if (itemToDelete.type === 'inscricao') setInscricoes(inscricoes.filter(i => i.id !== itemToDelete.id));
      if (itemToDelete.type === 'produto') setProdutos(produtos.filter(p => p.id !== itemToDelete.id));
      if (itemToDelete.type === 'pedido') setPedidos(pedidos.filter(p => p.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (error) { console.error(error); } finally { setIsDeleting(false); }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando...</div>;
  if (!evento) return <div className="p-10 text-center text-red-400">Evento não encontrado.</div>;

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/evento/${evento.id}` : "";

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-10 relative">
      <FeedbackModal isOpen={modalFeedback.isOpen} onClose={() => setModalFeedback({ ...modalFeedback, isOpen: false })} type={modalFeedback.type} title={modalFeedback.title} message={modalFeedback.message} />

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/eventos" className="text-gray-400 hover:text-white transition-colors mt-1"><ArrowLeft className="w-6 h-6" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              {evento.nome}
              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border ${evento.status === 'Aberto' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>{evento.status}</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">Gestão de inscrições e vendas.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push(`/eventos/editar/${evento.id}`)} className="w-auto px-4 py-2 text-xs">Editar Evento</Button>
          <Button variant="primary" onClick={() => setIsQrModalOpen(true)} className="w-auto px-4 py-2 text-xs"><QrCode className="w-4 h-4 mr-2" /> Link Público</Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-gray-800 bg-ohel-surface/50 rounded-t-xl overflow-x-auto">
        <button onClick={() => setActiveTab("inscricoes")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "inscricoes" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}><Users className="w-4 h-4" /> Inscrições</button>
        <button onClick={() => setActiveTab("produtos")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "produtos" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}><ShoppingBag className="w-4 h-4" /> Produtos</button>
        <button onClick={() => setActiveTab("pedidos")} className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === "pedidos" ? "border-ohel-blue text-ohel-blue bg-ohel-blue/5" : "border-transparent text-gray-400 hover:text-white"}`}><DollarSign className="w-4 h-4" /> Controle de Vendas</button>
      </div>

      {/* CONTEÚDO: ABA INSCRIÇÕES */}
      {activeTab === "inscricoes" && (
        <>
          <Card className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-ohel-surface/50">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input type="text" placeholder="Buscar inscrito..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-ohel-bg border border-gray-700 text-sm text-white rounded-md pl-9 pr-4 py-2.5 focus:border-ohel-blue outline-none" />
            </div>
            <Button onClick={() => setIsAddInscritoModalOpen(true)} className="w-full md:w-auto shrink-0 bg-ohel-blue hover:bg-blue-600 text-white"><Plus className="w-4 h-4 mr-2" /> Adicionar Inscrito</Button>
          </Card>
          <Card className="overflow-hidden p-0 border-gray-800/60">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                  <th className="p-4 font-medium">Nome</th><th className="p-4 font-medium">Telefone</th><th className="p-4 font-medium">Data</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {inscricoes.map((inscricao) => (
                  <tr key={inscricao.id} className="hover:bg-white/[0.02]">
                    <td className="p-4 text-white font-medium flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-ohel-blue/10 flex items-center justify-center text-ohel-blue shrink-0"><Users className="w-4 h-4" /></div>{inscricao.nome}</td>
                    <td className="p-4 text-gray-300">{inscricao.telefone || "-"}</td>
                    <td className="p-4 text-gray-400 text-xs">{new Date(inscricao.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4"><span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle className="w-3 h-3" /> {inscricao.status}</span></td>
                    <td className="p-4 text-center"><button onClick={() => setItemToDelete({ type: 'inscricao', id: inscricao.id })} className="p-1.5 text-gray-500 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* CONTEÚDO: ABA PRODUTOS */}
      {activeTab === "produtos" && (
        <>
          <Card className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-ohel-surface/50">
            <p className="text-sm text-gray-400">Cadastre os produtos e seus tamanhos com preços diferentes.</p>
            <Button onClick={() => setIsAddProdutoModalOpen(true)} className="w-full md:w-auto shrink-0 bg-ohel-blue hover:bg-blue-600 text-white"><Plus className="w-4 h-4 mr-2" /> Novo Produto</Button>
          </Card>
          <Card className="overflow-hidden p-0 border-gray-800/60">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                  <th className="p-4 font-medium">Produto</th><th className="p-4 font-medium">Tamanhos e Preços</th><th className="p-4 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {produtos.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-gray-400">Nenhum produto cadastrado.</td></tr> : 
                  produtos.map((prod) => (
                  <tr key={prod.id} className="hover:bg-white/[0.02]">
                    <td className="p-4 text-white font-medium">{prod.nome}</td>
                    <td className="p-4 text-gray-300 text-sm flex flex-wrap gap-2">
                      {prod.variacoes?.map(v => (
                        <span key={v.id} className="bg-ohel-bg border border-gray-700 px-2 py-1 rounded text-xs">
                          {v.nome} - <span className="text-green-400 font-bold">R$ {v.preco.toFixed(2)}</span>
                        </span>
                      )) || "-"}
                    </td>
                    <td className="p-4 text-center"><button onClick={() => setItemToDelete({ type: 'produto', id: prod.id })} className="p-1.5 text-gray-500 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* CONTEÚDO: ABA PEDIDOS/VENDAS */}
      {activeTab === "pedidos" && (
        <>
          <Card className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-ohel-surface/50">
            <p className="text-sm text-gray-400">Acompanhe quem comprou, o tamanho escolhido e se o pagamento já foi confirmado.</p>
            <Button onClick={() => setIsAddPedidoModalOpen(true)} className="w-full md:w-auto shrink-0 bg-ohel-blue hover:bg-blue-600 text-white"><Plus className="w-4 h-4 mr-2" /> Lançar Pedido Manual</Button>
          </Card>
          <Card className="overflow-hidden p-0 border-gray-800/60">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-ohel-surface/80 border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                  <th className="p-4 font-medium">Comprador</th><th className="p-4 font-medium">Produto (Tam/Qtd)</th><th className="p-4 font-medium">Status Pgto</th><th className="p-4 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {pedidos.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum pedido realizado ainda.</td></tr> : 
                  pedidos.map((ped) => (
                  <tr key={ped.id} className="hover:bg-white/[0.02]">
                    <td className="p-4 text-white font-medium">
                      {ped.nome_comprador}
                      <span className="block text-[10px] text-gray-500">{ped.telefone || "Sem telefone"}</span>
                    </td>
                    <td className="p-4 text-gray-300 text-sm">
                      {ped.eventos_produtos?.nome} 
                      <span className="text-gray-500"> ({ped.eventos_produtos_variacoes?.nome || "Único"} - {ped.quantidade}x)</span>
                      <span className="block text-[10px] text-green-400">Total: R$ {((ped.eventos_produtos_variacoes?.preco || 0) * ped.quantidade).toFixed(2)}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${ped.status === "Pago" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                        {ped.status}
                      </span>
                    </td>
                    <td className="p-4 flex items-center justify-center gap-2">
                      <input type="file" accept="image/*" id={`file-${ped.id}`} className="hidden" onChange={(e) => handleUploadComprovante(e, ped.id)} />
                      <button onClick={() => document.getElementById(`file-${ped.id}`)?.click()} className="p-1.5 text-gray-500 hover:text-ohel-blue rounded" title="Anexar Comprovante">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </button>
                      {ped.status === 'Pendente' && (
                        <button onClick={() => handleMarcarPago(ped.id)} className="px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded text-xs font-bold hover:bg-green-500/20" title="Marcar como Pago">Pago</button>
                      )}
                      <button onClick={() => setItemToDelete({ type: 'pedido', id: ped.id })} className="p-1.5 text-gray-500 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* MODAIS */}
      
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-2">Link de Inscrição / Vendas</h3>
            <div className="bg-white p-4 rounded-xl mb-6">{publicUrl && <QRCode value={publicUrl} size={200} level="H" />}</div>
            <div className="w-full bg-ohel-bg border border-gray-800 rounded-lg p-3 text-xs text-gray-400 break-all mb-6">{publicUrl}</div>
            <div className="flex gap-3 w-full">
              <button onClick={() => setIsQrModalOpen(false)} className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-md">Fechar</button>
              <button onClick={() => { navigator.clipboard.writeText(publicUrl); setModalFeedback({ isOpen: true, type: "success", title: "Copiado!", message: "Link copiado." }); }} className="flex-1 bg-ohel-blue text-white font-medium py-2 rounded-md text-sm">Copiar Link</button>
            </div>
          </div>
        </div>
      )}

      {isAddInscritoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-ohel-blue" /> Adicionar Inscrito</h3>
              <button onClick={() => setIsAddInscritoModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddInscricao} className="flex flex-col gap-4">
              <Input label="Nome Completo *" placeholder="Ex: Maria Souza" value={novaInscricao.nome} onChange={(e) => setNovaInscricao({...novaInscricao, nome: e.target.value})} required />
              <Input label="Telefone / WhatsApp" placeholder="(00) 00000-0000" value={novaInscricao.telefone} onChange={(e) => setNovaInscricao({...novaInscricao, telefone: e.target.value})} />
              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="secondary" onClick={() => setIsAddInscritoModalOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO PRODUTO COM VARIAÇÕES DINÂMICAS */}
      {isAddProdutoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-ohel-blue" /> Novo Produto</h3>
              <button onClick={() => setIsAddProdutoModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddProduto} className="flex flex-col gap-4">
              <Input label="Nome do Produto *" placeholder="Ex: Camisa Oficial" value={novoProdutoNome} onChange={(e) => setNovoProdutoNome(e.target.value)} required />
              
              <div className="border-t border-gray-800 pt-4 mt-2">
                <p className="text-xs font-bold text-ohel-blue mb-3">Tamanhos e Preços</p>
                {novasVariacoes.map((v, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input placeholder="Tamanho (Ex: P, GG)" value={v.nome} onChange={(e) => {
                      const newVars = [...novasVariacoes];
                      newVars[index].nome = e.target.value;
                      setNovasVariacoes(newVars);
                    }} />
                    <Input type="number" step="0.01" placeholder="Preço (Ex: 55.00)" value={v.preco} onChange={(e) => {
                      const newVars = [...novasVariacoes];
                      newVars[index].preco = e.target.value;
                      setNovasVariacoes(newVars);
                    }} />
                    <button type="button" onClick={() => setNovasVariacoes(novasVariacoes.filter((_, i) => i !== index))} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={() => setNovasVariacoes([...novasVariacoes, { nome: "", preco: "" }])} className="w-auto px-4 py-2 text-xs mt-2"><Plus className="w-3 h-3 mr-1" /> Adicionar Tamanho</Button>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800">
                <Button type="button" variant="secondary" onClick={() => setIsAddProdutoModalOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={saving}>{saving ? "Salvando..." : "Cadastrar Produto"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddPedidoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-ohel-blue" /> Lançar Pedido</h3>
              <button onClick={() => setIsAddPedidoModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddPedido} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Produto *</label>
                <select value={novoPedido.produto_id} onChange={(e) => handleProdutoChange(e.target.value)} required className="input-ohel w-full px-4 py-3 rounded-lg text-sm">
                  <option value="">Selecione o produto...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Tamanho / Variação *</label>
                <select value={novoPedido.variacao_id} onChange={(e) => setNovoPedido({...novoPedido, variacao_id: e.target.value})} required className="input-ohel w-full px-4 py-3 rounded-lg text-sm" disabled={variacoesDoPedido.length === 0}>
                  <option value="">Selecione o tamanho...</option>
                  {variacoesDoPedido.map(v => <option key={v.id} value={v.id}>{v.nome} - R$ {v.preco.toFixed(2)}</option>)}
                </select>
              </div>

              <Input label="Nome do Comprador *" placeholder="Ex: João da Silva" value={novoPedido.nome_comprador} onChange={(e) => setNovoPedido({...novoPedido, nome_comprador: e.target.value})} required />
              <Input label="Telefone" placeholder="(00) 00000-0000" value={novoPedido.telefone} onChange={(e) => setNovoPedido({...novoPedido, telefone: e.target.value})} />
              
              <Input label="Quantidade" type="number" min="1" value={novoPedido.quantidade} onChange={(e) => setNovoPedido({...novoPedido, quantidade: e.target.value})} required />
              
              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="secondary" onClick={() => setIsAddPedidoModalOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="primary" disabled={saving}>{saving ? "Salvando..." : "Lançar Pedido"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
              <h3 className="text-lg font-bold text-white">Confirmar Exclusão</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setItemToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
              <button onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center gap-2" disabled={isDeleting}>{isDeleting ? "Excluindo..." : "Sim, excluir"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}