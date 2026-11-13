import type { SupabaseClient } from "@supabase/supabase-js";

export interface MembroAniversariante {
  id: string;
  nome?: string;
  data_nascimento: string | null;
}

export function obterDataAtualSaoPaulo(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const obter = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)!.value;
  return `${obter("year")}-${obter("month")}-${obter("day")}`;
}

function dataCadastroValida(valor: string | null): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1) return false;
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const diasPorMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= diasPorMes[mes - 1];
}

export function selecionarAniversariantesDoDia(
  membros: MembroAniversariante[],
  dataAtual = obterDataAtualSaoPaulo(),
) {
  if (!dataCadastroValida(dataAtual)) return [];
  return membros
    .filter((membro) => dataCadastroValida(membro.data_nascimento)
      && membro.data_nascimento <= dataAtual
      && membro.data_nascimento.slice(5) === dataAtual.slice(5))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR") || a.id.localeCompare(b.id));
}

export async function buscarMembrosParaAniversarios(
  client: SupabaseClient,
  igrejaId: string,
  incluirNomes = false,
  signal?: AbortSignal,
): Promise<{ data: MembroAniversariante[] | null; error: string | null }> {
  const mensagemErro = "Não foi possível carregar os aniversariantes. A consulta será tentada novamente.";
  if (!igrejaId) return { data: null, error: mensagemErro };
  const tamanhoPagina = 1000;
  const membros: MembroAniversariante[] = [];
  try {
    for (let inicio = 0; ; inicio += tamanhoPagina) {
      let consulta = client.from("membros")
        .select(incluirNomes ? "id, nome, data_nascimento" : "id, data_nascimento")
        .eq("igreja_id", igrejaId)
        .eq("status", "Ativo")
        .not("data_nascimento", "is", null)
        .order("id")
        .range(inicio, inicio + tamanhoPagina - 1);
      if (signal) consulta = consulta.abortSignal(signal);
      const { data, error } = await consulta;
      if (error || !data) return { data: null, error: mensagemErro };
      membros.push(...data as unknown as MembroAniversariante[]);
      if (data.length < tamanhoPagina) return { data: membros, error: null };
    }
  } catch {
    return { data: null, error: mensagemErro };
  }
}
