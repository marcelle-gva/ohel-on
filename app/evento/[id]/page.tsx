"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Logo } from "@/components/brand/Logo";
import { Calendar, MapPin, Clock, CheckCircle, Ticket, ShoppingBag, X } from "lucide-react";

export default function InscricaoPublicaPage() {
  // Correção 1: Tipando o useParams para evitar erro de TypeScript
  const params = useParams<{ id: string }>();
  const eventoId = params.id;

  const [evento, setEvento] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Inscrição
  const [savingInscricao, setSavingInscricao] = useState(false);
  const [sucessoInscricao, setSucessoInscricao] = useState(false);
  const [formInscricao, setFormInscricao] = useState({ nome: "", telefone: "" });

  // Estados de Compra
  const [savingPedido, setSavingPedido] = useState(false);
  const [sucessoPedido, setSucessoPedido] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<any>(null);
  const [pedidoData, setPedidoData] = useState({ nome: "", telefone: "", variacao_id: "", quantidade: "1" });
  
  const [modal, setModal] = useState({ isOpen: false, type: "error" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const fetchEvento = async () => {
      if (!eventoId) return;
      try {
        const { data: evData, error: evError } = await supabase
          .from('eventos')
          .select(`*, congregacoes (nome), igrejas (nome)`)
          .eq('id', eventoId)
          .single();
        if (evError) throw evError;
        setEvento(evData);

        const { data: prodData } = await supabase
          .from('eventos_produtos')
          .select('*, eventos_produtos_variacoes(*)')
          .eq('evento_id', eventoId)
          .order('nome');
        
        setProdutos(prodData || []);

      } catch (error) {
        console.error("Evento não encontrado.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvento();
  }, [eventoId]);

  const handleInscricao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formInscricao.nome || !formInscricao.telefone) return;
    
    setSavingInscricao(true);
    try {
      const { error } = await supabase.from('inscricoes_eventos').insert([{
        igreja_id: evento.igreja_id, evento_id: evento.id,
        nome: formInscricao.nome, telefone: formInscricao.telefone, status: 'Confirmado'
      }]);
      if (error) throw error;
      setSucessoInscricao(true);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Ops!", message: "Não foi possível realizar sua inscrição. Tente novamente." });
    } finally {
      setSavingInscricao(false);
    }
  };

  const openOrderModal = (produto: any) => {
    setProdutoSelecionado(produto);
    setPedidoData({ 
      nome: formInscricao.nome,
      telefone: formInscricao.telefone,
      variacao_id: produto.eventos_produtos_variacoes?.[0]?.id || "", 
      quantidade: "1" 
    });
    setIsOrderModalOpen(true);
  };

  const handlePedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoData.variacao_id || !pedidoData.nome || !pedidoData.telefone) return;
    
    setSavingPedido(true);
    try {
      const { error } = await supabase.from('eventos_pedidos').insert([{
        igreja_id: evento.igreja_id,
        evento_id: evento.id,
        produto_id: produtoSelecionado.id,
        variacao_id: pedidoData.variacao_id,
        nome_comprador: pedidoData.nome,
        telefone: pedidoData.telefone,
        quantidade: parseInt(pedidoData.quantidade),
        status: 'Pendente'
      }]);

      if (error) throw error;
      
      setIsOrderModalOpen(false);
      setSucessoPedido(true);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro no Pedido", message: "Não foi possível registrar seu pedido. Tente novamente." });
    } finally {
      setSavingPedido(false);
    }
  };

  const formatarData = (data: string) => {
    if (!data) return "";
    return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  if (loading) return <div className="w-full h-screen bg-ohel-bg flex items-center justify-center text-white">Carregando evento...</div>;
  
  if (!evento) return (
    <div className="w-full h-screen bg-ohel-bg flex flex-col items-center justify-center text-white p-4 text-center">
      <Ticket className="w-16 h-16 text-gray-600 mb-4" />
      <h1 className="text-2xl font-bold">Evento não encontrado</h1>
    </div>
  );

  if (sucessoInscricao || sucessoPedido) return (
    <div className="w-full min-h-screen bg-ohel-bg flex items-center justify-center p-4 bg-ohel-glow">
      <Card className="w-full max-w-md p-8 flex flex-col items-center text-center animate-in zoom-in-95">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        
        {sucessoPedido ? (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Pedido Registrado!</h1>
            <p className="text-gray-400 text-sm mb-6">
              Seu pedido foi reservado. Para confirmar, faça o PIX para a igreja e envie o comprovante no WhatsApp da secretaria.
            </p>
            <Button onClick={() => { setSucessoPedido(false); setSucessoInscricao(false); }} variant="primary" className="w-full">
              Entendi
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Inscrição Confirmada!</h1>
            <p className="text-gray-400 text-sm mb-6">Sua vaga para o evento <strong>{evento.nome}</strong> está garantida.</p>
            <Button onClick={() => { setSucessoInscricao(false); setSucessoPedido(false); }} variant="secondary" className="w-full">
              Fazer outra inscrição
            </Button>
          </>
        )}
      </Card>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-ohel-bg flex flex-col items-center pb-10">
      <FeedbackModal 
        isOpen={modal.isOpen} 
        onClose={() => setModal({ ...modal, isOpen: false })} 
        type={modal.type} 
        title={modal.title} 
        message={modal.message} 
      />

      <div className="w-full max-w-lg mx-4 md:mx-auto mt-0 md:mt-6 bg-ohel-surface md:rounded-3xl rounded-b-3xl overflow-hidden shadow-2xl">
        
        {/* Banner */}
        <div className="h-48 md:h-56 w-full relative bg-gradient-to-br from-ohel-surface to-ohel-bg">
          {evento.cartaz_url ? (
            // Correção 2: Adicionando a propriedade sizes para remover o aviso de performance
            <Image 
              src={evento.cartaz_url} 
              alt={evento.nome} 
              fill 
              sizes="(max-width: 768px) 100vw, 512px"
              className="object-cover" 
              priority 
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Calendar className="w-16 h-16 text-gray-700" />
            </div>
          )}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest">
            {evento.igrejas?.nome}
          </div>
        </div>

        {/* Informações do Evento */}
        <div className="p-5 md:p-6 border-b border-gray-800">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-3 leading-tight">{evento.nome}</h1>
          
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-2 text-gray-300 text-xs">
              <Calendar className="w-4 h-4 text-ohel-blue shrink-0" />
              <span>{formatarData(evento.data_inicio)} {evento.data_fim && `até ${formatarData(evento.data_fim)}`}</span>
            </div>
            {evento.hora_abertura && (
              <div className="flex items-center gap-2 text-gray-300 text-xs">
                <Clock className="w-4 h-4 text-ohel-blue shrink-0" />
                <span>Abertura às {evento.hora_abertura}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-300 text-xs">
              <MapPin className="w-4 h-4 text-ohel-blue shrink-0" />
              <span>{evento.congregacoes?.nome || evento.cidade || "Local a definir"}</span>
            </div>
          </div>

          {evento.descricao && (
            <div className="bg-ohel-bg p-3 rounded-lg border border-gray-800 mb-2">
              <p className="text-gray-400 text-xs leading-relaxed">{evento.descricao}</p>
            </div>
          )}
        </div>

        {/* 1º: Formulário de Inscrição */}
        <div className="p-5 md:p-6 border-b border-gray-800">
          <h2 className="text-base font-bold text-white mb-3">Faça sua inscrição no evento</h2>
          
          {evento.status !== 'Aberto' ? (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center">
              <p className="text-red-400 text-sm font-bold">As inscrições estão encerradas.</p>
            </div>
          ) : (
            <form onSubmit={handleInscricao} className="flex flex-col gap-3">
              <Input 
                label="Nome Completo *" 
                placeholder="Seu nome" 
                value={formInscricao.nome} 
                onChange={(e) => setFormInscricao({...formInscricao, nome: e.target.value})} 
                required 
                className="text-sm py-2.5" 
              />
              <Input 
                label="Telefone / WhatsApp *" 
                placeholder="(00) 00000-0000" 
                value={formInscricao.telefone} 
                onChange={(e) => setFormInscricao({...formInscricao, telefone: e.target.value})} 
                required 
                className="text-sm py-2.5" 
              />
              <Button type="submit" variant="primary" disabled={savingInscricao} className="w-full mt-2 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(0,123,255,0.2)]">
                <CheckCircle className="w-4 h-4 mr-2" /> {savingInscricao ? "Confirmando..." : "Confirmar Inscrição"}
              </Button>
            </form>
          )}
        </div>

        {/* 2º: Loja do Evento */}
        {produtos.length > 0 && (
          <div className="p-5 md:p-6 bg-ohel-bg/30">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-purple-400" /> Loja do Evento
            </h2>
            <div className="flex flex-col gap-3">
              {produtos.map(prod => (
                <div key={prod.id} className="bg-ohel-surface border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{prod.nome}</p>
                    <p className="text-[10px] text-gray-400">
                      {prod.eventos_produtos_variacoes?.length > 0 
                        ? `Tamanhos: ${prod.eventos_produtos_variacoes.map((v: any) => v.nome).join(', ')}` 
                        : "Único"}
                    </p>
                  </div>
                  <Button onClick={() => openOrderModal(prod)} variant="secondary" className="w-auto px-4 py-1.5 text-xs">
                    Comprar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-8 flex flex-col items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
        <Logo className="w-32 h-14 md:w-40 md:h-16" noMask={true} />
        <p className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-[0.2em] font-semibold text-center">Plataforma de Gestão OHEL ON</p>
      </div>

      {/* MODAL DE COMPRA */}
      {isOrderModalOpen && produtoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Comprar: {produtoSelecionado.nome}</h3>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePedido} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Escolha o Tamanho *</label>
                <select 
                  value={pedidoData.variacao_id} 
                  onChange={(e) => setPedidoData({...pedidoData, variacao_id: e.target.value})} 
                  required 
                  className="input-ohel w-full px-4 py-3 rounded-lg text-sm"
                >
                  <option value="">Selecione...</option>
                  {produtoSelecionado.eventos_produtos_variacoes?.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.nome} - R$ {v.preco.toFixed(2)}</option>
                  ))}
                </select>
              </div>

              {/* AVISO DE PREENCHIMENTO AUTOMÁTICO */}
              {(pedidoData.nome || pedidoData.telefone) && (
                <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded text-[10px] text-blue-400 text-center">
                  Dados preenchidos automaticamente da sua inscrição.
                </div>
              )}

              <Input 
                label="Seu Nome *" 
                value={pedidoData.nome} 
                onChange={(e) => setPedidoData({...pedidoData, nome: e.target.value})} 
                required 
              />
              <Input 
                label="Seu WhatsApp *" 
                value={pedidoData.telefone} 
                onChange={(e) => setPedidoData({...pedidoData, telefone: e.target.value})} 
                required 
              />
              <Input 
                label="Quantidade *" 
                type="number" 
                min="1" 
                value={pedidoData.quantidade} 
                onChange={(e) => setPedidoData({...pedidoData, quantidade: e.target.value})} 
                required 
              />

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="secondary" onClick={() => setIsOrderModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={savingPedido}>
                  {savingPedido ? "Enviando..." : "Confirmar Pedido"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}