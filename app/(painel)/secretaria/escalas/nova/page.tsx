"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, CalendarDays, Plus, Save, Trash2, User } from "lucide-react";

interface FuncaoEscala {
  id: string;
  nome: string;
}

interface Membro {
  id: string;
  nome: string;
}

interface ParticipanteEscala {
  funcao_id: string;
  membro_id: string;
  funcao_nome: string;
  membro_nome: string;
}

export default function NovaEscalaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [funcoes, setFuncoes] = useState<FuncaoEscala[]>([]);
  const [participantes, setParticipantes] = useState<ParticipanteEscala[]>([]);
  const [novaFuncao, setNovaFuncao] = useState({ funcao_id: "", membro_id: "" });
  const [modal, setModal] = useState({
    isOpen: false,
    type: "success" as "success" | "error",
    title: "",
    message: "",
  });
  const [formData, setFormData] = useState({
    titulo: "",
    data_culto: "",
    horario_inicio: "19:30",
    horario_fim: "",
    observacoes: "",
  });

  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Sessão não encontrada.");

        const { data: usuario, error: usuarioError } = await supabase
          .from("usuarios")
          .select("igreja_id")
          .eq("id", user.id)
          .single();
        if (usuarioError) throw usuarioError;
        if (!usuario.igreja_id) throw new Error("Usuário sem igreja vinculada.");

        setIgrejaId(usuario.igreja_id);
        const [funcoesResult, membrosResult] = await Promise.all([
          supabase
            .from("funcoes_escala")
            .select("id, nome")
            .eq("igreja_id", usuario.igreja_id)
            .order("nome"),
          supabase
            .from("membros")
            .select("id, nome")
            .eq("igreja_id", usuario.igreja_id)
            .order("nome"),
        ]);
        if (funcoesResult.error) throw funcoesResult.error;
        if (membrosResult.error) throw membrosResult.error;
        setFuncoes(funcoesResult.data ?? []);
        setMembros(membrosResult.data ?? []);
      } catch (error) {
        console.error("Falha ao carregar dados para nova escala:", error);
        setModal({
          isOpen: true,
          type: "error",
          title: "Erro ao carregar",
          message: error instanceof Error ? error.message : "Não foi possível carregar os dados da igreja.",
        });
      } finally {
        setLoading(false);
      }
    };

    void initPage();
  }, []);

  const addParticipante = () => {
    const funcao = funcoes.find(item => item.id === novaFuncao.funcao_id);
    const membro = membros.find(item => item.id === novaFuncao.membro_id);
    if (!funcao || !membro) return;

    setParticipantes(current => [
      ...current,
      {
        funcao_id: funcao.id,
        membro_id: membro.id,
        funcao_nome: funcao.nome,
        membro_nome: membro.nome,
      },
    ]);
    setNovaFuncao({ funcao_id: "", membro_id: "" });
  };

  const saveScale = async () => {
    if (!igrejaId) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: "Igreja não identificada." });
      return;
    }
    if (!formData.titulo || !formData.data_culto) {
      setModal({ isOpen: true, type: "error", title: "Atenção", message: "Preencha o título e a data do evento." });
      return;
    }

    setSaving(true);
    try {
      const { data: escala, error: escalaError } = await supabase
        .from("escalas")
        .insert({
          igreja_id: igrejaId,
          titulo: formData.titulo,
          data_culto: formData.data_culto,
          horario_inicio: formData.horario_inicio || null,
          horario_fim: formData.horario_fim || null,
          observacoes: formData.observacoes || null,
        })
        .select("id")
        .single();
      if (escalaError) throw escalaError;

      if (participantes.length > 0) {
        const { error: participantesError } = await supabase.from("escalados").insert(
          participantes.map(participante => ({
            escala_id: escala.id,
            funcao_id: participante.funcao_id,
            membro_id: participante.membro_id,
          })),
        );
        if (participantesError) {
          const { error: cleanupError } = await supabase
            .from("escalas")
            .delete()
            .eq("id", escala.id)
            .eq("igreja_id", igrejaId);
          if (cleanupError) {
            throw new Error(
              `Não foi possível salvar os participantes (${participantesError.message}) nem remover a escala incompleta (${cleanupError.message}).`,
            );
          }
          throw participantesError;
        }
      }

      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Escala criada com sucesso!" });
      window.setTimeout(() => router.push("/secretaria/escalas"), 1000);
    } catch (error) {
      console.error("Falha ao salvar nova escala:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro",
        message: error instanceof Error ? error.message : "Não foi possível criar a escala.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando dados da escala...</div>;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-10">
      <FeedbackModal
        isOpen={modal.isOpen}
        onClose={() => setModal(current => ({ ...current, isOpen: false }))}
        type={modal.type}
        title={modal.title}
        message={modal.message}
      />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Link href="/secretaria/escalas" className="text-gray-400 hover:text-white transition-colors mt-0.5">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Nova Escala</h1>
            <p className="text-gray-400 text-xs mt-0.5">Monte a equipe de trabalho para o culto.</p>
          </div>
        </div>
        <Button variant="primary" onClick={saveScale} disabled={saving} className="w-auto px-6 py-2 text-xs">
          <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Escala"}
        </Button>
      </div>

      <Card className="p-6 flex flex-col gap-6">
        <div>
          <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5" /> Informações do Culto
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Input
                label="Título do Evento *"
                name="titulo"
                placeholder="Ex: Culto de Celebração"
                value={formData.titulo}
                onChange={event => setFormData(current => ({ ...current, titulo: event.target.value }))}
                required
                className="py-2 text-xs"
              />
            </div>
            <Input
              label="Data *"
              type="date"
              name="data_culto"
              value={formData.data_culto}
              onChange={event => setFormData(current => ({ ...current, data_culto: event.target.value }))}
              required
              className="py-2 text-xs"
            />
            <Input
              label="Horário de início"
              type="time"
              name="horario_inicio"
              value={formData.horario_inicio}
              onChange={event => setFormData(current => ({ ...current, horario_inicio: event.target.value }))}
              className="py-2 text-xs"
            />
            <Input
              label="Horário de fim"
              type="time"
              name="horario_fim"
              value={formData.horario_fim}
              onChange={event => setFormData(current => ({ ...current, horario_fim: event.target.value }))}
              className="py-2 text-xs"
            />
          </div>
        </div>

        <div className="border-t border-gray-800 pt-5">
          <h3 className="text-[11px] font-bold text-ohel-blue uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Equipe de Trabalho
          </h3>
          {funcoes.length === 0 ? (
            <p className="text-xs text-gray-400">
              Cadastre funções no módulo Escalas antes de adicionar participantes.
            </p>
          ) : (
            <div className="bg-ohel-bg border border-gray-800 p-4 rounded-lg">
              <div className="flex flex-col md:flex-row gap-2 items-end mb-4">
                <div className="w-full md:w-1/3 flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Função</label>
                  <select
                    value={novaFuncao.funcao_id}
                    onChange={event => setNovaFuncao(current => ({ ...current, funcao_id: event.target.value }))}
                    className="input-ohel w-full px-3 py-2 rounded-md text-xs"
                  >
                    <option value="">Selecione...</option>
                    {funcoes.map(funcao => <option key={funcao.id} value={funcao.id}>{funcao.nome}</option>)}
                  </select>
                </div>
                <div className="flex-1 w-full flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Membro escalado</label>
                  <select
                    value={novaFuncao.membro_id}
                    onChange={event => setNovaFuncao(current => ({ ...current, membro_id: event.target.value }))}
                    className="input-ohel w-full px-3 py-2 rounded-md text-xs"
                    disabled={!novaFuncao.funcao_id}
                  >
                    <option value="">Selecione um membro...</option>
                    {membros.map(membro => <option key={membro.id} value={membro.id}>{membro.nome}</option>)}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addParticipante}
                  disabled={!novaFuncao.funcao_id || !novaFuncao.membro_id}
                  className="px-4 py-2 text-xs h-[34px] w-full md:w-auto"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                </Button>
              </div>

              {participantes.length > 0 ? (
                <div className="flex flex-col gap-2 mt-2">
                  {participantes.map((participante, index) => (
                    <div key={`${participante.funcao_id}-${participante.membro_id}-${index}`} className="flex items-center justify-between bg-ohel-surface border border-gray-800 p-2.5 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-ohel-blue/10 text-ohel-blue px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{participante.funcao_nome}</span>
                        <span className="text-white font-medium">{participante.membro_nome}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setParticipantes(current => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-red-500 hover:text-red-400"
                        aria-label={`Remover ${participante.membro_nome}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic mt-1">Nenhum membro escalado ainda.</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 pt-4">
          <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider mb-1.5 block">Observações (opcional)</label>
          <textarea
            name="observacoes"
            value={formData.observacoes}
            onChange={event => setFormData(current => ({ ...current, observacoes: event.target.value }))}
            placeholder="Ex: Ensaio às 18h, culto de Santa Ceia..."
            className="input-ohel w-full px-3 py-2 rounded-md text-xs min-h-[80px] resize-y"
          />
        </div>
      </Card>
    </div>
  );
}
