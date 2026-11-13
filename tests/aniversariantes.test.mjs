import test from "node:test";
import assert from "node:assert/strict";
import {
  obterDataAtualSaoPaulo,
  selecionarAniversariantesDoDia,
  selecionarAniversariantesDoMes,
  buscarMembrosParaAniversarios,
} from "../lib/aniversariantes.ts";

const membro = (id, nascimento, nome = `Membro ${id}`) => ({ id, nome, data_nascimento: nascimento });

function criarClient(rows, { falharInicio, rejeitar = false } = {}) {
  const chamadas = [];
  return {
    chamadas,
    from(table) {
      assert.equal(table, "membros");
      const chamada = { filtros: [] };
      chamadas.push(chamada);
      const query = {
        select(campos) { chamada.campos = campos; return query; },
        eq(campo, valor) { chamada.filtros.push([campo, valor]); return query; },
        not(campo, operador, valor) { chamada.not = [campo, operador, valor]; return query; },
        order(campo) { chamada.ordem = campo; return query; },
        range(inicio, fim) { chamada.range = [inicio, fim]; return query; },
        abortSignal(signal) { chamada.signal = signal; return query; },
        then(resolve, reject) {
          if (rejeitar) return Promise.reject(new Error("Falha de rede")).then(resolve, reject);
          if (chamada.range[0] === falharInicio) return Promise.resolve({ data: null, error: { code: "42501" } }).then(resolve, reject);
          const filtradas = rows.filter((row) => chamada.filtros.every(([campo, valor]) => row[campo] === valor)
            && row.data_nascimento !== null).sort((a, b) => a.id.localeCompare(b.id));
          return Promise.resolve({ data: filtradas.slice(chamada.range[0], chamada.range[1] + 1), error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

test("dia e mês do cadastro determinam o aniversário, independentemente do ano", () => {
  const resultado = selecionarAniversariantesDoDia([
    membro("1", "1980-11-13", "Zélia"), membro("2", "2000-11-13", "Ana"),
    membro("3", "1990-11-12"), membro("4", "1990-12-13"),
  ], "2026-11-13");
  assert.deepEqual(resultado.map((m) => m.id), ["2", "1"]);
});

test("filtro do mês inclui todos os dias do mês e ordena por dia, nome e id", () => {
  const resultado = selecionarAniversariantesDoMes([
    membro("1", "1980-11-13", "Zélia"), membro("2", "2000-11-02", "Ana"),
    membro("3", "2000-11-13", "Ana"), membro("4", "2000-12-01", "Dezembro"),
    membro("5", "2027-11-30", "Futuro"), membro("6", "2000-11-31", "Inválida"),
  ], "2026-11-13");
  assert.deepEqual(resultado.map((m) => m.id), ["2", "3", "1"]);
});

test("ignora data ausente, inválida, em formato incorreto e futura", () => {
  const rows = [null, "", "inválida", "13/11/2000", "2000-13-13", "2000-11-32", "0000-11-13", "2027-11-13"].map((data, index) => membro(String(index), data));
  assert.deepEqual(selecionarAniversariantesDoDia(rows, "2026-11-13"), []);
  assert.deepEqual(selecionarAniversariantesDoDia([membro("1", "2000-11-13")], "inválida"), []);
});

test("datas impossíveis não são normalizadas para outro dia", () => {
  assert.deepEqual(selecionarAniversariantesDoDia([membro("1", "2001-02-29"), membro("2", "2000-02-30")], "2024-03-01"), []);
});

test("29 de fevereiro aparece em 29/02 e não é transferido a 28/02 ou 01/03", () => {
  const rows = [membro("1", "2000-02-29"), membro("2", "1900-02-29")];
  assert.deepEqual(selecionarAniversariantesDoDia(rows, "2028-02-29").map((m) => m.id), ["1"]);
  assert.deepEqual(selecionarAniversariantesDoDia(rows, "2027-02-28"), []);
  assert.deepEqual(selecionarAniversariantesDoDia(rows, "2027-03-01"), []);
});

test("usa a data de São Paulo antes e depois da meia-noite, não a data UTC", () => {
  assert.equal(obterDataAtualSaoPaulo(new Date("2026-11-14T02:59:59Z")), "2026-11-13");
  assert.equal(obterDataAtualSaoPaulo(new Date("2026-11-14T03:00:00Z")), "2026-11-14");
  assert.equal(obterDataAtualSaoPaulo(new Date("2027-01-01T02:00:00Z")), "2026-12-31");
});

test("editar a data de nascimento muda a seleção sem um cadastro separado de aniversário", () => {
  const row = membro("1", "2000-11-12");
  assert.equal(selecionarAniversariantesDoDia([row], "2026-11-13").length, 0);
  row.data_nascimento = "2000-11-13";
  assert.equal(selecionarAniversariantesDoDia([row], "2026-11-13").length, 1);
});

test("a virada do dia muda os aniversariantes selecionados", () => {
  const rows = [membro("1", "2000-11-13"), membro("2", "2000-11-14")];
  assert.deepEqual(selecionarAniversariantesDoDia(rows, obterDataAtualSaoPaulo(new Date("2026-11-14T02:59:59Z"))).map((m) => m.id), ["1"]);
  assert.deepEqual(selecionarAniversariantesDoDia(rows, obterDataAtualSaoPaulo(new Date("2026-11-14T03:00:00Z"))).map((m) => m.id), ["2"]);
});

test("consulta todas as páginas, inclusive aniversariantes após o milésimo registro", async () => {
  const rows = Array.from({ length: 1505 }, (_, i) => ({ ...membro(String(i).padStart(5, "0"), i === 1504 ? "2000-11-13" : "2000-01-01"), igreja_id: "igreja-1", status: "Ativo" }));
  const client = criarClient(rows);
  const signal = new AbortController().signal;
  const result = await buscarMembrosParaAniversarios(client, "igreja-1", true, signal);
  assert.equal(result.error, null);
  assert.equal(result.data.length, 1505);
  assert.equal(selecionarAniversariantesDoDia(result.data, "2026-11-13").length, 1);
  assert.equal(selecionarAniversariantesDoMes(result.data, "2026-11-13").length, 1);
  assert.deepEqual(client.chamadas.map((c) => c.range), [[0, 999], [1000, 1999]]);
  for (const chamada of client.chamadas) {
    assert.equal(chamada.campos, "id, nome, data_nascimento");
    assert.deepEqual(chamada.filtros, [["igreja_id", "igreja-1"], ["status", "Ativo"]]);
    assert.equal(chamada.ordem, "id");
    assert.equal(chamada.signal, signal);
  }
});

test("ignora pré-cadastros, inativos e membros de outra igreja", async () => {
  const rows = ["Ativo", "Inativo", "Pré-Cadastro"].map((status, i) => ({ ...membro(String(i), "2000-11-13"), igreja_id: "igreja-1", status }));
  rows.push({ ...membro("outro", "2000-11-13"), igreja_id: "igreja-2", status: "Ativo" });
  const result = await buscarMembrosParaAniversarios(criarClient(rows), "igreja-1", true);
  assert.deepEqual(result.data.map((row) => row.id), ["0"]);
});

test("não solicita nomes para perfis não administrativos", async () => {
  const client = criarClient([]);
  const result = await buscarMembrosParaAniversarios(client, "igreja-1");
  assert.deepEqual(result, { data: [], error: null });
  assert.equal(client.chamadas[0].campos, "id, data_nascimento");
});

test("erro de permissão ou de rede é informado, nunca convertido em lista vazia de sucesso", async () => {
  for (const client of [criarClient([], { falharInicio: 0 }), criarClient([], { rejeitar: true })]) {
    const result = await buscarMembrosParaAniversarios(client, "igreja-1", true);
    assert.equal(result.data, null);
    assert.ok(result.error);
  }
});

test("erro na segunda página descarta a contagem parcial", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ ...membro(String(i).padStart(5, "0"), "2000-11-13"), igreja_id: "igreja-1", status: "Ativo" }));
  const result = await buscarMembrosParaAniversarios(criarClient(rows, { falharInicio: 1000 }), "igreja-1", true);
  assert.equal(result.data, null);
  assert.ok(result.error);
});

test("não consulta membros sem identificar a igreja", async () => {
  const client = criarClient([]);
  const result = await buscarMembrosParaAniversarios(client, "", true);
  assert.equal(client.chamadas.length, 0);
  assert.ok(result.error);
});
