"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, Edit3, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  anoAtualAgenda,
  dataAgendaLegivel,
  type ProgramacaoCultoAnual,
  type ProgramacaoCultoAnualForm,
  type TipoCulto,
} from "@/lib/programacao-cultos";

interface AgendaAnualCardProps {
  programacoes: ProgramacaoCultoAnual[];
  tiposCulto: TipoCulto[];
  anoSelecionado: string;
  onAnoChange: (ano: string) => void;
  podeGerir: boolean;
  saving: boolean;
  onCreate: (form: ProgramacaoCultoAnualForm) => Promise<void>;
  onEdit: (id: string, form: ProgramacaoCultoAnualForm) => Promise<void>;
  onToggle: (item: ProgramacaoCultoAnual) => Promise<void>;
}

const formularioVazio = (tipo = ""): ProgramacaoCultoAnualForm => ({
  data_culto: `${anoAtualAgenda()}-12-31`,
  titulo: "",
  tipo,
  horario_inicio: "19:00",
  horario_fim: "21:00",
  observacoes: "",
});

export function AgendaAnualCard({
  programacoes,
  tiposCulto,
  anoSelecionado,
  onAnoChange,
  podeGerir,
  saving,
  onCreate,
  onEdit,
  onToggle,
}: AgendaAnualCardProps) {
  const tiposAtivos = useMemo(() => tiposCulto.filter((tipo) => tipo.ativo), [tiposCulto]);
  const tipoInicial = tiposAtivos[0]?.nome || tiposCulto[0]?.nome || "";
  const [form, setForm] = useState<ProgramacaoCultoAnualForm>(() => formularioVazio(tipoInicial));
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoForm, setEditandoForm] = useState<ProgramacaoCultoAnualForm | null>(null);

  const atualizarAnoDaData = (data: string, setter: (updater: (atual: ProgramacaoCultoAnualForm) => ProgramacaoCultoAnualForm) => void) => {
    setter((atual) => ({ ...atual, data_culto: data }));
    // A lista usa o filtro do pai. Trocar esse filtro durante a edição faria
    // desaparecer a linha antes que a nova data pudesse ser salva.
    if (!editandoId && /^\d{4}-\d{2}-\d{2}$/.test(data)) onAnoChange(data.slice(0, 4));
  };

  const iniciarEdicao = (item: ProgramacaoCultoAnual) => {
    setEditandoId(item.id);
    setEditandoForm({
      data_culto: item.data_culto,
      titulo: item.titulo,
      tipo: item.tipo,
      horario_inicio: item.horario_inicio.slice(0, 5),
      horario_fim: item.horario_fim.slice(0, 5),
      observacoes: item.observacoes || "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditandoForm(null);
  };

  const salvarEdicao = async (event: FormEvent) => {
    event.preventDefault();
    if (!editandoId || !editandoForm) return;
    try {
      await onEdit(editandoId, editandoForm);
      onAnoChange(editandoForm.data_culto.slice(0, 4));
      cancelarEdicao();
    } catch {
      // O chamador já mostra o erro no FeedbackModal; mantenha o formulário para correção.
    }
  };

  const cadastrar = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await onCreate({ ...form, tipo: form.tipo || tipoInicial });
      setForm(formularioVazio(tipoInicial));
    } catch {
      // O chamador já mostra o erro no FeedbackModal; preserve os dados digitados.
    }
  };

  const renderCampos = (
    value: ProgramacaoCultoAnualForm,
    setter: (updater: (atual: ProgramacaoCultoAnualForm) => ProgramacaoCultoAnualForm) => void,
    prefix: string,
  ) => (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          label="Data *"
          type="date"
          value={value.data_culto}
          onChange={(event) => atualizarAnoDaData(event.target.value, setter)}
          required
        />
        <Input
          label="Título *"
          placeholder="Ex.: Conferência anual"
          value={value.titulo}
          onChange={(event) => setter((atual) => ({ ...atual, titulo: event.target.value }))}
          maxLength={120}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">
          Tipo *
          <select
            aria-label={`${prefix} tipo`}
            value={value.tipo || tipoInicial}
            onChange={(event) => setter((atual) => ({ ...atual, tipo: event.target.value }))}
            className="input-ohel w-full rounded-md px-3 py-2 text-xs"
            required
          >
            {tiposCulto.map((tipo) => <option key={tipo.id} value={tipo.nome} disabled={!tipo.ativo}>{tipo.nome}{!tipo.ativo ? " (inativo)" : ""}</option>)}
          </select>
        </label>
        <Input label="Início *" type="time" value={value.horario_inicio} onChange={(event) => setter((atual) => ({ ...atual, horario_inicio: event.target.value }))} required />
        <Input label="Fim *" type="time" value={value.horario_fim} onChange={(event) => setter((atual) => ({ ...atual, horario_fim: event.target.value }))} required />
      </div>
      <label className="flex flex-col gap-1 text-[10px] font-semibold text-gray-400">
        Observações
        <textarea
          aria-label={`${prefix} observações`}
          value={value.observacoes}
          onChange={(event) => setter((atual) => ({ ...atual, observacoes: event.target.value }))}
          maxLength={2000}
          placeholder="Informações para a equipe e para a agenda planejada"
          className="input-ohel min-h-16 w-full resize-y rounded-md px-3 py-2 text-xs"
        />
      </label>
    </>
  );

  return (
    <Card className="border-gray-800 p-5 lg:col-span-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-white"><CalendarDays className="h-4 w-4 text-ohel-blue" /> Agenda anual</h2>
          <p className="mt-1 max-w-3xl text-[10px] leading-5 text-gray-400">Planeje datas especiais da igreja por ano. Esta agenda é separada dos cultos semanais e não abre sessões automaticamente nem duplica a programação fixa.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[10px] font-semibold text-gray-400">
          Ano
          <input
            aria-label="Filtrar agenda anual por ano"
            type="number"
            min="2000"
            max="2100"
            value={anoSelecionado}
            disabled={Boolean(editandoId) || saving}
            onChange={(event) => onAnoChange(event.target.value)}
            className="input-ohel w-24 rounded-md px-3 py-2 text-xs"
          />
        </label>
      </div>

      {podeGerir && (
        <form onSubmit={cadastrar} className="mt-4 flex flex-col gap-3 border-y border-gray-800 py-4">
          {renderCampos(form, (updater) => setForm(updater(form)), "Nova programação anual")}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !tipoInicial}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Adicionar à agenda anual"}</Button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {programacoes.length === 0 ? <p className="rounded-lg border border-dashed border-gray-700 p-6 text-center text-xs text-gray-500">Nenhuma data planejada para {anoSelecionado || "este ano"}.</p> : programacoes.map((item) => (
          <div key={item.id} className={`rounded-lg border p-3 ${item.ativo ? "border-gray-800 bg-ohel-bg" : "border-gray-800/70 bg-ohel-bg/50"}`}>
            {editandoId === item.id && editandoForm ? (
              <form onSubmit={salvarEdicao} className="flex flex-col gap-3">
                {renderCampos(editandoForm, (updater) => setEditandoForm((atual) => atual ? updater(atual) : atual), `Editar ${item.titulo}`)}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={cancelarEdicao} disabled={saving}><X className="h-4 w-4" /> Cancelar</Button>
                  <Button type="submit" disabled={saving}><Check className="h-4 w-4" /> Salvar alterações</Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-white">{item.titulo}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${item.ativo ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-400"}`}>{item.ativo ? "Ativa" : "Cancelada"}</span></div>
                  <p className="mt-1 text-[10px] text-gray-400">{dataAgendaLegivel(item.data_culto)} · {item.horario_inicio.slice(0, 5)}–{item.horario_fim.slice(0, 5)} · {item.tipo}</p>
                  {item.observacoes && <p className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-gray-500">{item.observacoes}</p>}
                </div>
                {podeGerir && <div className="flex shrink-0 flex-wrap gap-3 text-[10px] font-semibold">
                  <button type="button" disabled={saving} onClick={() => iniciarEdicao(item)} className="inline-flex items-center gap-1 text-ohel-blue hover:text-white disabled:opacity-50"><Edit3 className="h-3.5 w-3.5" /> Editar</button>
                  <button type="button" disabled={saving} onClick={() => void onToggle(item)} className="text-gray-300 hover:text-white disabled:opacity-50">{item.ativo ? "Cancelar data" : "Reativar data"}</button>
                </div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
