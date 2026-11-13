import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  atualizarOracao,
  criarSequenciadorConsultas,
  excluirOracao,
  listarOracoes,
  obterIgrejaDaSessao,
  obterOracao,
} from "../lib/oracoes-client.ts";

const IGREJA = "10000000-0000-4000-8000-000000000001";
const OUTRA_IGREJA = "10000000-0000-4000-8000-000000000002";
const USUARIO = "20000000-0000-4000-8000-000000000001";
const PEDIDO = "30000000-0000-4000-8000-000000000001";

function fakeClient({ pedidoResponse = { data: [], error: null }, usuarioResponse = { data: { igreja_id: IGREJA }, error: null }, session = { user: { id: USUARIO } }, authError = null } = {}) {
  const calls = [];
  const responses = { pedidos_oracao: pedidoResponse, usuarios: usuarioResponse };
  const client = {
    calls,
    from(table) {
      calls.push(["from", table]);
      const response = responses[table] || { data: null, error: null };
      const builder = {
        select(columns) { calls.push(["select", columns]); return builder; },
        update(values) { calls.push(["update", values]); return builder; },
        delete() { calls.push(["delete"]); return builder; },
        eq(column, value) { calls.push(["eq", column, value]); return builder; },
        order(column, options) { calls.push(["order", column, options]); return builder; },
        range(from, to) { calls.push(["range", from, to]); return builder; },
        maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
        then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
      };
      return builder;
    },
    auth: {
      async getSession() {
        calls.push(["getSession"]);
        return { data: { session }, error: authError };
      },
    },
  };
  return client;
}

const pedido = {
  id: PEDIDO,
  nome_solicitante: "Ana",
  descricao: "Saúde",
  visibilidade: "Público",
  status: "Pendente",
  created_at: "2026-11-13T12:00:00Z",
};

test("lista usa tenant, ordenação estável e paginação explícita de 500", async () => {
  const client = fakeClient({ pedidoResponse: { data: [pedido], error: null } });
  const data = await listarOracoes(client, IGREJA);
  assert.deepEqual(data, [pedido]);
  assert.deepEqual(client.calls.filter(([name]) => name === "eq"), [["eq", "igreja_id", IGREJA]]);
  assert.deepEqual(client.calls.filter(([name]) => name === "order"), [
    ["order", "created_at", { ascending: false }],
    ["order", "id", { ascending: true }],
  ]);
  assert.deepEqual(client.calls.find(([name]) => name === "range"), ["range", 0, 499]);
});

test("erro de consulta é propagado e não vira lista vazia/sucesso", async () => {
  const client = fakeClient({ pedidoResponse: { data: null, error: { message: "falha de consulta RLS" } } });
  await assert.rejects(() => listarOracoes(client, IGREJA), (error) => error?.message === "falha de consulta RLS");
});

test("carregamento de uma oração exige igreja e id no mesmo tenant", async () => {
  const client = fakeClient({ pedidoResponse: { data: pedido, error: null } });
  const result = await obterOracao(client, IGREJA, PEDIDO);
  assert.equal(result.id, PEDIDO);
  assert.deepEqual(client.calls.filter(([name]) => name === "eq"), [
    ["eq", "igreja_id", IGREJA],
    ["eq", "id", PEDIDO],
  ]);
  await assert.rejects(() => obterOracao(client, OUTRA_IGREJA, "id-invalido"), /Pedido inválido/);
});

test("exclusão com erro RLS não confirma mutação", async () => {
  const client = fakeClient({ pedidoResponse: { data: null, error: { message: "new row violates row-level security policy" } } });
  await assert.rejects(() => excluirOracao(client, IGREJA, PEDIDO), (error) => error?.message.includes("row-level security"));
  assert.deepEqual(client.calls.filter(([name]) => name === "eq"), [
    ["eq", "id", PEDIDO],
    ["eq", "igreja_id", IGREJA],
  ]);
});

test("exclusão no-op não é sucesso e exclusão confirmada exige select id + maybeSingle", async () => {
  const noop = await excluirOracao(fakeClient({ pedidoResponse: { data: null, error: null } }), IGREJA, PEDIDO);
  assert.deepEqual(noop, { id: null, confirmado: false });

  const client = fakeClient({ pedidoResponse: { data: { id: PEDIDO }, error: null } });
  const success = await excluirOracao(client, IGREJA, PEDIDO);
  assert.deepEqual(success, { id: PEDIDO, confirmado: true });
  assert.deepEqual(client.calls.filter(([name]) => name === "select"), [["select", "id"]]);
  assert.equal(client.calls.filter(([name]) => name === "maybeSingle").length, 1);
});

test("atualização com erro/no-op não é sucesso; sucesso também é retornado por select id", async () => {
  const values = { nome_solicitante: "Ana", descricao: "Atualizado", visibilidade: "Privado", status: "Pendente" };
  const errorClient = fakeClient({ pedidoResponse: { data: null, error: { message: "permissão negada" } } });
  await assert.rejects(() => atualizarOracao(errorClient, IGREJA, PEDIDO, values), (error) => error?.message === "permissão negada");

  const noop = await atualizarOracao(fakeClient({ pedidoResponse: { data: null, error: null } }), IGREJA, PEDIDO, values);
  assert.deepEqual(noop, { id: null, confirmado: false });

  const client = fakeClient({ pedidoResponse: { data: { id: PEDIDO }, error: null } });
  const success = await atualizarOracao(client, IGREJA, PEDIDO, values);
  assert.deepEqual(success, { id: PEDIDO, confirmado: true });
  assert.deepEqual(client.calls.filter(([name]) => name === "eq"), [
    ["eq", "id", PEDIDO],
    ["eq", "igreja_id", IGREJA],
  ]);
  assert.deepEqual(client.calls.filter(([name]) => name === "select"), [["select", "id"]]);
});

test("igreja da sessão vem do usuario autenticado e igreja inválida não passa", async () => {
  const client = fakeClient();
  assert.equal(await obterIgrejaDaSessao(client), IGREJA);
  const invalidClient = fakeClient({ usuarioResponse: { data: { igreja_id: "não-uuid" }, error: null } });
  assert.equal(await obterIgrejaDaSessao(invalidClient), null);
  const crossTenantClient = fakeClient({ usuarioResponse: { data: { igreja_id: OUTRA_IGREJA }, error: null } });
  assert.equal(await obterIgrejaDaSessao(crossTenantClient), OUTRA_IGREJA);
});

test("sequenciador impede resposta antiga de reaparecer depois de nova consulta/mutação", () => {
  const sequenciador = criarSequenciadorConsultas();
  const antigo = sequenciador.proxima();
  const atual = sequenciador.proxima();
  assert.equal(sequenciador.vigente(antigo), false);
  assert.equal(sequenciador.vigente(atual), true);
  sequenciador.invalidar();
  assert.equal(sequenciador.vigente(atual), false);
});

test("páginas permanecem Client Components e não repetem a opção Em Oração", async () => {
  const lista = await readFile(new URL("../app/(painel)/secretaria/oracoes/page.tsx", import.meta.url), "utf8");
  const edicao = await readFile(new URL("../app/(painel)/secretaria/oracoes/editar/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(lista, /^"use client";/);
  assert.match(edicao, /^"use client";/);
  assert.equal((lista.match(/<option value="Em Oração">/g) || []).length, 1);
  assert.equal((edicao.match(/<option value="Em Oração">/g) || []).length, 1);
  assert.match(lista, /role="dialog"/);
  assert.match(lista, /aria-live="assertive"/);
});

test("lista completa não trunca em 500 e erro posterior não devolve um histórico parcial", async () => {
  const rows = Array.from({ length: 1205 }, (_, index) => ({ ...pedido, id: `fixture-${index}` }));
  const ranges = [];
  let falhar = false;
  const client = { from() {
    let inicio = 0, fim = 0;
    const q = { select(){return q;}, eq(){return q;}, order(){return q;}, range(a,b){inicio=a;fim=b;ranges.push([a,b]);return q;}, then(resolve,reject){return Promise.resolve(falhar && inicio >= 500 ? {data:null,error:{message:'falha posterior'}} : {data:rows.slice(inicio,fim+1),error:null}).then(resolve,reject);} };
    return q;
  }};
  assert.equal((await listarOracoes(client, IGREJA)).length, 1205);
  assert.deepEqual(ranges, [[0,499],[500,999],[1000,1499]]);
  falhar = true;
  await assert.rejects(() => listarOracoes(client, IGREJA), error => error.message === 'falha posterior');
});
