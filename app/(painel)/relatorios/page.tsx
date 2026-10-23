"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { ArrowDown, ArrowUp, Download, FileBarChart, Loader2, Plus, Trash2 } from "lucide-react";

type Fonte = "membros" | "transacoes" | "eventos" | "patrimonio";
type Campo = { id: string; nome: string };
type Modelo = {
  id: string;
  nome: string;
  fonte: Fonte;
  titulo: string;
  subtitulo: string | null;
  colunas: string[];
  orientacao: "retrato" | "paisagem";
  totalizador: boolean;
};
type Row = Record<string, string | number | boolean | null>;

const CAMPOS: Record<Fonte, Campo[]> = {
  membros: [
    { id: "nome", nome: "Nome" },
    { id: "cargo", nome: "Cargo" },
    { id: "status", nome: "Status" },
    { id: "sexo", nome: "Sexo" },
    { id: "telefone", nome: "Telefone" },
    { id: "email", nome: "E-mail" },
    { id: "cidade", nome: "Cidade" },
    { id: "created_at", nome: "Data de cadastro" },
  ],
  transacoes: [
    { id: "data", nome: "Data" },
    { id: "mes_referencia", nome: "Competência" },
    { id: "tipo", nome: "Tipo" },
    { id: "descricao", nome: "Descrição" },
    { id: "departamento", nome: "Departamento" },
    { id: "valor", nome: "Valor" },
    { id: "conciliado", nome: "Conciliado" },
  ],
  eventos: [
    { id: "nome", nome: "Evento" },
    { id: "data_inicio", nome: "Data de início" },
    { id: "data_fim", nome: "Data de término" },
    { id: "status", nome: "Status" },
    { id: "cidade", nome: "Cidade" },
    { id: "limite_participantes", nome: "Limite de pessoas" },
    { id: "publicar_mural", nome: "No mural" },
  ],
  patrimonio: [
    { id: "codigo", nome: "Código" },
    { id: "descricao", nome: "Descrição" },
    { id: "tipo", nome: "Tipo" },
    { id: "localizacao", nome: "Localização" },
    { id: "departamento", nome: "Departamento" },
    { id: "status", nome: "Status" },
    { id: "quantidade", nome: "Quantidade" },
    { id: "valor", nome: "Valor" },
    { id: "data_aquisicao", nome: "Data de aquisição" },
  ],
};

const SOURCE_LABELS: Record<Fonte, string> = {
  membros: "Membros",
  transacoes: "Movimento financeiro",
  eventos: "Eventos",
  patrimonio: "Patrimônio",
};

const SOURCE_DATE_FIELD: Record<Fonte, string> = {
  membros: "created_at",
  transacoes: "data",
  eventos: "data_inicio",
  patrimonio: "data_aquisicao",
};

const INITIAL_SOURCE: Fonte = "membros";
const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  const safeText = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character] ?? character));

const projectRows = (rows: object[], selectedColumns: string[]): Row[] => rows.map(row => {
  const projected: Row = {};
  for (const column of selectedColumns) {
    if (!Object.prototype.hasOwnProperty.call(row, column)) {
      throw new Error(`O campo "${column}" não está disponível na fonte selecionada.`);
    }
    const value: unknown = Reflect.get(row, column);
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      projected[column] = value;
    } else {
      throw new Error(`O campo "${column}" contém um formato incompatível com o relatório.`);
    }
  }
  return projected;
});

export default function RelatoriosPage() {
  const [churchId, setChurchId] = useState<string | null>(null);
  const [models, setModels] = useState<Modelo[]>([]);
  const [availableSources, setAvailableSources] = useState<Fonte[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [source, setSource] = useState<Fonte>(INITIAL_SOURCE);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [orientation, setOrientation] = useState<"retrato" | "paisagem">("paisagem");
  const [totalizer, setTotalizer] = useState(false);
  const [columns, setColumns] = useState<string[]>(["nome", "status"]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente.");
        const { data: user, error: userError } = await supabase
          .from("usuarios")
          .select("igreja_id, role, grupo_id")
          .eq("id", authData.user.id)
          .single();
        if (userError) throw userError;
        if (!user.igreja_id) throw new Error("Igreja do usuário não identificada.");
        let allowedSources: Fonte[] = [];
        if (user.role === "admin") {
          allowedSources = ["membros", "transacoes", "eventos", "patrimonio"];
          setCanManage(true);
          setCanDelete(true);
        } else if (user.grupo_id) {
          const { data: permissions, error: permissionsError } = await supabase.from("grupos_permissoes")
            .select("modulo, acao")
            .eq("grupo_id", user.grupo_id)
            .in("modulo", ["relatorios", "membros", "financeiro", "eventos", "patrimonio"])
            .in("acao", ["ler", "criar", "editar", "excluir"]);
          if (permissionsError) throw permissionsError;
          if (!permissions?.some(permission => permission.modulo === "relatorios" && permission.acao === "ler")) {
            throw new Error("Seu grupo não tem permissão para consultar relatórios.");
          }
          allowedSources = ([
            ["membros", "membros"],
            ["transacoes", "financeiro"],
            ["eventos", "eventos"],
            ["patrimonio", "patrimonio"],
          ] as const)
            .filter(([, module]) => permissions.some(permission => permission.modulo === module && permission.acao === "ler"))
            .map(([reportSource]) => reportSource);
          setCanManage(permissions.some(permission => permission.modulo === "relatorios" && ["criar", "editar"].includes(permission.acao)));
          setCanDelete(permissions.some(permission => permission.modulo === "relatorios" && permission.acao === "excluir"));
        }
        if (!allowedSources.length) throw new Error("Seu grupo não tem acesso aos dados de nenhum módulo de relatório.");
        const { data, error: modelError } = await supabase
          .from("relatorios_modelos")
          .select("id, nome, fonte, titulo, subtitulo, colunas, orientacao, totalizador")
          .eq("igreja_id", user.igreja_id)
          .order("created_at", { ascending: false });
        if (modelError) throw modelError;
        if (cancelled) return;
        setChurchId(user.igreja_id);
        setModels((data ?? []).filter(model => allowedSources.includes(model.fonte as Fonte)) as Modelo[]);
        setAvailableSources(allowedSources);
        if (!allowedSources.includes(INITIAL_SOURCE)) {
          setSource(allowedSources[0]);
          setColumns(CAMPOS[allowedSources[0]].slice(0, 3).map(field => field.id));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os modelos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const selectedModel = models.find(model => model.id === selectedModelId) ?? null;
  const availableFields = useMemo(() => CAMPOS[source], [source]);

  const changeSource = (value: Fonte) => {
    setSource(value);
    setColumns(CAMPOS[value].slice(0, 3).map(field => field.id));
    setSelectedModelId("");
  };

  const toggleColumn = (fieldId: string) => {
    setColumns(current => current.includes(fieldId)
      ? current.filter(column => column !== fieldId)
      : [...current, fieldId]);
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    setColumns(current => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const applyModel = (model: Modelo) => {
    setSelectedModelId(model.id);
    setSource(model.fonte);
    setName(model.nome);
    setTitle(model.titulo);
    setSubtitle(model.subtitulo ?? "");
    setOrientation(model.orientacao);
    setTotalizer(model.totalizador);
    setColumns(model.colunas);
  };

  const saveModel = async () => {
    if (!churchId) return;
    if (!name.trim() || !title.trim() || !columns.length) {
      setError("Informe o nome, o título e pelo menos uma coluna.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        igreja_id: churchId,
        nome: name.trim(),
        fonte: source,
        titulo: title.trim(),
        subtitulo: subtitle.trim() || null,
        colunas: columns,
        orientacao: orientation,
        totalizador: totalizer,
      };
      if (selectedModelId) {
        const { data, error: updateError } = await supabase.from("relatorios_modelos")
          .update(payload).eq("id", selectedModelId).select("id").single();
        if (updateError) throw updateError;
        if (!data) throw new Error("O modelo não foi encontrado para atualização.");
        setModels(current => current.map(model => model.id === selectedModelId ? { ...model, ...payload } : model));
      } else {
        const { data, error: insertError } = await supabase.from("relatorios_modelos")
          .insert(payload).select("id, nome, fonte, titulo, subtitulo, colunas, orientacao, totalizador").single();
        if (insertError) throw insertError;
        setModels(current => [data as Modelo, ...current]);
        setSelectedModelId(data.id);
      }
      setNotice("Modelo salvo.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o modelo.");
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = async () => {
    if (!selectedModelId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data, error: deleteError } = await supabase.from("relatorios_modelos")
        .delete().eq("id", selectedModelId).select("id").single();
      if (deleteError) throw deleteError;
      if (!data) throw new Error("O modelo não foi encontrado para exclusão.");
      setModels(current => current.filter(model => model.id !== selectedModelId));
      setSelectedModelId("");
      setName("");
      setTitle("");
      setSubtitle("");
      setNotice("Modelo excluído.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o modelo.");
    } finally {
      setSaving(false);
    }
  };

  const fetchReportRows = async (): Promise<Row[]> => {
    if (!churchId) throw new Error("Igreja do usuário não identificada.");
    const dateField = SOURCE_DATE_FIELD[source];
    const finishQuery = async (query: PromiseLike<{ data: object[] | null; error: { message: string } | null }>) => {
      const result = await query;
      if (result.error) throw new Error(result.error.message);
      return projectRows(result.data ?? [], columns);
    };
    if (source === "membros") {
      let query = supabase.from("membros").select("nome, cargo, status, sexo, telefone, email, cidade, created_at").eq("igreja_id", churchId).order("nome").limit(1000);
      if (startDate) query = query.gte(dateField, startDate);
      if (endDate) query = query.lte(dateField, endDate);
      return finishQuery(query);
    } else if (source === "transacoes") {
      let query = supabase.from("transacoes").select("data, mes_referencia, tipo, descricao, departamento, valor, conciliado").eq("igreja_id", churchId).order("data", { ascending: false }).limit(1000);
      if (startDate) query = query.gte(dateField, startDate);
      if (endDate) query = query.lte(dateField, endDate);
      return finishQuery(query);
    } else if (source === "eventos") {
      let query = supabase.from("eventos").select("nome, data_inicio, data_fim, status, cidade, limite_participantes, publicar_mural").eq("igreja_id", churchId).order("data_inicio", { ascending: false }).limit(1000);
      if (startDate) query = query.gte(dateField, startDate);
      if (endDate) query = query.lte(dateField, endDate);
      return finishQuery(query);
    } else {
      let query = supabase.from("patrimonio_bens").select("codigo, descricao, tipo, localizacao, departamento, status, quantidade, valor, data_aquisicao").eq("igreja_id", churchId).order("descricao").limit(1000);
      if (startDate) query = query.gte(dateField, startDate);
      if (endDate) query = query.lte(dateField, endDate);
      return finishQuery(query);
    }
  };

  const runReport = async () => {
    if (!churchId || !columns.length) return;
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const rows = await fetchReportRows();
      const labels = new Map(CAMPOS[source].map(field => [field.id, field.nome]));
      const header = columns.map(column => escapeCsv(labels.get(column) ?? column)).join(";");
      const csvRows = rows.map(row => columns.map(column => escapeCsv(row[column])).join(";"));
      if (totalizer && columns.includes("valor")) {
        const total = rows.reduce((sum, row) => sum + (Number(row.valor) || 0), 0);
        csvRows.push(columns.map(column => escapeCsv(column === "valor" ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : column === columns[0] ? "Total" : "")).join(";"));
      }
      const content = `\uFEFF${escapeCsv(title || selectedModel?.titulo || "Relatório")}\r\n${escapeCsv(subtitle)}\r\n${header}\r\n${csvRows.join("\r\n")}`;
      const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(name || title || "relatorio").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(`${rows.length} registros exportados.`);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Não foi possível gerar o relatório.");
    } finally {
      setRunning(false);
    }
  };

  const printReport = async () => {
    if (!columns.length) return;
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const rows = await fetchReportRows();
      const labels = new Map(CAMPOS[source].map(field => [field.id, field.nome]));
      const headings = columns.map(column => `<th>${escapeHtml(labels.get(column) ?? column)}</th>`).join("");
      const body = rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`).join("");
      const total = totalizer && columns.includes("valor")
        ? rows.reduce((sum, row) => sum + (Number(row.valor) || 0), 0)
        : null;
      const totalRow = total === null ? "" : `<tr class="total">${columns.map(column => `<td>${column === "valor" ? escapeHtml(total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })) : column === columns[0] ? "Total" : ""}</td>`).join("")}</tr>`;
      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o relatório.");
      printWindow.opener = null;
      printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title || "Relatório")}</title><style>@page{size:A4 ${orientation};margin:14mm}body{font-family:Arial,sans-serif;color:#17202a;font-size:11px}h1{font-size:20px;margin:0 0 5px}p{color:#566573;margin:0 0 18px}table{width:100%;border-collapse:collapse}th,td{padding:7px 8px;border:1px solid #d5d8dc;text-align:left;vertical-align:top}th{background:#eef2f3;font-weight:700}.total{font-weight:700;background:#f8f9f9}footer{margin-top:14px;color:#7b7d7d;font-size:9px}</style></head><body><h1>${escapeHtml(title || "Relatório")}</h1><p>${escapeHtml(subtitle)}</p><table><thead><tr>${headings}</tr></thead><tbody>${body}${totalRow}</tbody></table><footer>${rows.length} registro(s) · Gerado em ${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date()))}</footer><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
      printWindow.document.close();
      setNotice(`${rows.length} registros prontos para impressão ou PDF.`);
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : "Não foi possível imprimir o relatório.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-10">
      <header className="flex items-end gap-3">
        <span className="rounded-xl bg-sky-500/10 p-3 text-sky-300"><FileBarChart className="h-6 w-6" /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Análises</p><h1 className="text-2xl font-bold text-white">Gerador de relatórios</h1><p className="mt-1 text-sm text-gray-400">Crie modelos reutilizáveis e exporte dados da sua igreja.</p></div>
      </header>
      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      {loading ? <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Card className="border-gray-800 bg-gray-900/70 p-5">
                  <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Modelos salvos</h2><p className="mt-1 text-xs text-gray-500">Selecione para editar ou gerar</p></div><button type="button" disabled={!canManage} onClick={() => { setSelectedModelId(""); setName(""); setTitle(""); setSubtitle(""); setColumns(CAMPOS[source].slice(0, 3).map(field => field.id)); setTotalizer(false); }} className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:border-sky-500/50 hover:text-white disabled:opacity-40" title="Novo modelo"><Plus className="h-4 w-4" /></button></div>
            <div className="space-y-2">
              {models.map(model => <button key={model.id} type="button" onClick={() => applyModel(model)} className={`w-full rounded-lg border p-3 text-left transition ${selectedModelId === model.id ? "border-sky-500/40 bg-sky-500/10" : "border-gray-800 bg-gray-950/60 hover:border-gray-700"}`}><span className="block text-sm font-medium text-gray-100">{model.nome}</span><span className="mt-1 block text-xs text-gray-500">{SOURCE_LABELS[model.fonte]} · {model.colunas.length} colunas</span></button>)}
              {!models.length && <p className="rounded-lg border border-dashed border-gray-800 px-4 py-8 text-center text-sm text-gray-500">Salve o primeiro modelo ao lado.</p>}
            </div>
          </Card>

          <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-white">{selectedModelId ? "Editar modelo" : "Novo modelo"}</h2><p className="mt-1 text-xs text-gray-500">Campos e filtros ficam no seu modelo por igreja.</p></div>{selectedModelId && <button type="button" onClick={() => void deleteModel()} disabled={saving || !canDelete} className="rounded-lg border border-rose-500/30 p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50" title="Excluir modelo"><Trash2 className="h-4 w-4" /></button>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Fonte dos dados<select value={source} onChange={event => changeSource(event.target.value as Fonte)} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white">{availableSources.map(value => <option key={value} value={value}>{SOURCE_LABELS[value]}</option>)}</select></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Nome do modelo<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Membros ativos" className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Título do relatório<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Título que aparecerá no arquivo" className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Subtítulo<input value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="Opcional" className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Orientação<select value={orientation} onChange={event => setOrientation(event.target.value as "retrato" | "paisagem")} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white"><option value="paisagem">Paisagem</option><option value="retrato">Retrato</option></select></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Data final<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Colunas selecionadas</p><div className="space-y-2">{columns.map((column, index) => <div key={column} className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2"><span className="flex-1 text-sm text-gray-200">{availableFields.find(field => field.id === column)?.nome ?? column}</span><button type="button" onClick={() => moveColumn(index, -1)} aria-label="Mover coluna para cima" className="p-1 text-gray-500 hover:text-white"><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => moveColumn(index, 1)} aria-label="Mover coluna para baixo" className="p-1 text-gray-500 hover:text-white"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => toggleColumn(column)} aria-label="Remover coluna" className="p-1 text-gray-500 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}{!columns.length && <p className="text-xs text-amber-300">Escolha ao menos uma coluna.</p>}</div></div>
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Adicionar campos</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{availableFields.filter(field => !columns.includes(field.id)).map(field => <button key={field.id} type="button" onClick={() => toggleColumn(field.id)} className="inline-flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-left text-sm text-gray-300 hover:border-sky-500/40 hover:text-white"><Plus className="h-4 w-4 text-sky-300" />{field.nome}</button>)}</div></div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={totalizer} onChange={event => setTotalizer(event.target.checked)} className="h-4 w-4 accent-sky-500" />Somar campo Valor no rodapé, quando disponível</label>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-800 pt-5">
              <button type="button" onClick={() => void saveModel()} disabled={saving || !canManage} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-200 hover:border-gray-500 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar modelo</button>
              <button type="button" onClick={() => void printReport()} disabled={running || !columns.length} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-200 disabled:opacity-50">Imprimir / PDF</button>
              <button type="button" onClick={() => void runReport()} disabled={running || !columns.length} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Gerar CSV</button>
            </div>
            <p className="mt-3 text-right text-[11px] text-gray-500">A exportação é limitada aos primeiros 1.000 registros por execução.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
