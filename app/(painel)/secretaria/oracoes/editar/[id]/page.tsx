"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  atualizarOracao,
  criarSequenciadorConsultas,
  isIgrejaValida,
  isUuid,
  obterIgrejaDaSessao,
  obterOracao,
  type OracaoFormValues,
} from "@/lib/oracoes-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Save, HeartHandshake } from "lucide-react";
import Link from "next/link";

function mensagemDoErro(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

const FORM_VAZIO: OracaoFormValues = {
  nome_solicitante: "",
  descricao: "",
  visibilidade: "",
  status: "",
};

export default function EditarPedidoOracaoPage() {
  const router = useRouter();
  const params = useParams<{ id: string | string[] }>();
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] || "" : idParam || "";

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const [formData, setFormData] = useState<OracaoFormValues>(FORM_VAZIO);

  const igrejaRef = useRef<string | null>(null);
  const sequenciadorRef = useRef(criarSequenciadorConsultas());
  const montadoRef = useRef(false);
  const savingRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let ativo = true;
    const sequenciador = sequenciadorRef.current;
    montadoRef.current = true;

    const limparSessao = () => {
      igrejaRef.current = null;
      sequenciadorRef.current.invalidar();
      setIgrejaId(null);
      setLoaded(false);
      setLoading(false);
      setLoadError("Sessão encerrada. Entre novamente para editar este pedido.");
      setFormData(FORM_VAZIO);
      setModal({ isOpen: true, type: "error", title: "Sessão encerrada", message: "Entre novamente para editar o pedido." });
    };

    const carregarDados = async () => {
      const token = sequenciadorRef.current.proxima();
      igrejaRef.current = null;
      setIgrejaId(null);
      setLoaded(false);
      setLoading(true);
      setLoadError(null);
      setModal((atual) => ({ ...atual, isOpen: false }));

      try {
        if (!isUuid(id)) throw new Error("Pedido inválido.");
        const igrejaAtual = await obterIgrejaDaSessao(supabase);
        if (!ativo || !sequenciadorRef.current.vigente(token)) return;
        if (!isIgrejaValida(igrejaAtual)) throw new Error("Igreja não identificada para a sessão atual.");

        igrejaRef.current = igrejaAtual;
        setIgrejaId(igrejaAtual);
        const pedido = await obterOracao(supabase, igrejaAtual, id);
        if (!ativo || !sequenciadorRef.current.vigente(token) || igrejaRef.current !== igrejaAtual) return;
        if (!pedido) throw new Error("Pedido não encontrado nesta igreja ou sem permissão para acessá-lo.");

        setFormData({
          nome_solicitante: pedido.nome_solicitante || "",
          descricao: pedido.descricao || "",
          visibilidade: pedido.visibilidade || "Público",
          status: pedido.status || "Pendente",
        });
        setLoaded(true);
      } catch (error) {
        if (!ativo || !sequenciadorRef.current.vigente(token)) return;
        setLoaded(false);
        setLoadError(mensagemDoErro(error, "Não foi possível carregar o pedido."));
        setModal({ isOpen: true, type: "error", title: "Erro ao carregar", message: mensagemDoErro(error, "Não foi possível carregar o pedido.") });
      } finally {
        if (ativo && sequenciadorRef.current.vigente(token)) setLoading(false);
      }
    };

    const { data: authState } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return;
      if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && !session)) {
        limparSessao();
      } else if (event === "SIGNED_IN" && session) {
        void carregarDados();
      }
    });

    void carregarDados();

    return () => {
      ativo = false;
      montadoRef.current = false;
      sequenciador.invalidar();
      if (redirectTimeoutRef.current !== null) window.clearTimeout(redirectTimeoutRef.current);
      authState.subscription.unsubscribe();
    };
  }, [id]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!loaded) return;
    setFormData((atual) => ({ ...atual, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || savingRef.current) return;

    const igrejaInicial = igrejaRef.current;
    if (!loaded || !igrejaId || !isIgrejaValida(igrejaInicial) || igrejaInicial !== igrejaId || !isUuid(id)) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível salvar", message: "Aguarde o carregamento do pedido e confirme a igreja da sessão." });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setModal((atual) => ({ ...atual, isOpen: false }));
    // Invalida respostas antigas antes de qualquer mutação.
    sequenciadorRef.current.invalidar();

    try {
      const igrejaAtual = await obterIgrejaDaSessao(supabase);
      if (!montadoRef.current || igrejaAtual !== igrejaInicial || igrejaRef.current !== igrejaInicial) {
        throw new Error("A sessão ou a igreja mudou. Recarregue a página e tente novamente.");
      }

      const resultado = await atualizarOracao(supabase, igrejaAtual, id, formData);
      if (!resultado.confirmado) {
        throw new Error("O pedido não foi atualizado. Ele pode não existir mais ou sua permissão pode ter mudado.");
      }

      // Confirma o estado persistido sem reaproveitar uma consulta anterior.
      const token = sequenciadorRef.current.proxima();
      const pedidoAtualizado = await obterOracao(supabase, igrejaAtual, id);
      if (!montadoRef.current || !sequenciadorRef.current.vigente(token) || igrejaRef.current !== igrejaAtual) return;
      if (!pedidoAtualizado) throw new Error("Alteração feita, mas não foi possível confirmar o pedido nesta igreja.");

      setFormData({
        nome_solicitante: pedidoAtualizado.nome_solicitante || "",
        descricao: pedidoAtualizado.descricao || "",
        visibilidade: pedidoAtualizado.visibilidade || "Público",
        status: pedidoAtualizado.status || "Pendente",
      });
      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Pedido atualizado com sucesso!" });
      redirectTimeoutRef.current = window.setTimeout(() => {
        if (montadoRef.current) router.push("/secretaria/oracoes");
      }, 900);
    } catch (error) {
      if (montadoRef.current && igrejaRef.current === igrejaInicial) {
        setModal({ isOpen: true, type: "error", title: "Erro ao atualizar", message: mensagemDoErro(error, "Não foi possível atualizar o pedido.") });
      }
    } finally {
      savingRef.current = false;
      if (montadoRef.current) setSaving(false);
    }
  };

  const handleCloseModal = () => setModal((atual) => ({ ...atual, isOpen: false }));
  const podeSalvar = loaded && !loading && Boolean(igrejaId) && !loadError;

  if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-400">Carregando dados...</div>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />
      {loadError && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{loadError}</div>}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/secretaria/oracoes" aria-label="Voltar para pedidos de oração" className="text-gray-400 hover:text-white transition-colors mt-1"><ArrowLeft className="w-6 h-6" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Editar Pedido de Oração</h1>
            <p className="text-gray-400 text-sm mt-1">Atualize o status ou os detalhes deste pedido.</p>
          </div>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={!podeSalvar || saving} className="w-full md:w-auto px-8 shrink-0">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <Card className="p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-2">
            <HeartHandshake className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-white">Detalhes do Pedido</h2>
          </div>

          <Input label="Nome do Solicitante *" name="nome_solicitante" value={formData.nome_solicitante} onChange={handleChange} required disabled={!podeSalvar} />

          <div className="flex flex-col gap-2">
            <label htmlFor="descricao-oracao" className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Descrição do Pedido *</label>
            <textarea id="descricao-oracao" name="descricao" value={formData.descricao} onChange={handleChange} required disabled={!podeSalvar} className="input-ohel w-full px-4 py-3 rounded-lg text-sm min-h-[120px] resize-none disabled:opacity-60" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="visibilidade-oracao" className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Visibilidade</label>
              <select id="visibilidade-oracao" name="visibilidade" value={formData.visibilidade} onChange={handleChange} disabled={!podeSalvar} className="input-ohel w-full px-4 py-3 rounded-lg text-sm disabled:opacity-60">
                <option value="Público">Público (Todos veem)</option>
                <option value="Privado">Privado (Apenas Liderança)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="status-oracao" className="text-xs font-semibold text-ohel-silver uppercase tracking-wider">Status</label>
              <select id="status-oracao" name="status" value={formData.status} onChange={handleChange} disabled={!podeSalvar} className="input-ohel w-full px-4 py-3 rounded-lg text-sm disabled:opacity-60">
                <option value="Pendente">Pendente</option>
                <option value="Em Oração">Em Oração</option>
                <option value="Rejeitado">Rejeitado</option>
                <option value="Atendido">Atendido</option>
              </select>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
