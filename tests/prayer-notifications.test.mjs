import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const helper = carregarTs(path.join(ROOT, "lib/member-prayer-notifications.ts"));
const {
  analisarAtualizacaoNotificacoesOracao,
  criarChaveStorageNotificacoesOracao,
  criarEstadoInicialNotificacoesOracao,
  lerEstadoNotificacoesOracao,
  normalizarNotificacoesOracao,
  projetarOracaoPublicada,
} = helper;

function carregarTs(filename, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const modulo = { exports: {} };
  cache.set(filename, modulo);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier.startsWith("@/")) return carregarTs(path.join(ROOT, specifier.slice(2) + ".ts"), cache);
    if (specifier.startsWith(".")) return carregarTs(path.resolve(path.dirname(filename), specifier + ".ts"), cache);
    throw new Error(`Import não permitido no teste: ${specifier}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
    localRequire,
    modulo,
    modulo.exports,
  );
  return modulo.exports;
}

const IGREJA = "10000000-0000-0000-0000-000000000001";
const MEMBRO = "20000000-0000-0000-0000-000000000001";
const APROVADA = "30000000-0000-0000-0000-000000000001";
const NOVA_APROVADA_ANTIGA = "30000000-0000-0000-0000-000000000002";

const row = (extras = {}) => ({
  id: APROVADA,
  igreja_id: IGREJA,
  nome_solicitante: "Ana",
  descricao: "Por uma família",
  created_at: "2024-01-01T12:00:00Z",
  status: "Em Oração",
  visibilidade: "Público",
  ...extras,
});

test("projeta somente oração pública aprovada, inclusive se foi criada antes da aprovação", () => {
  const pending = projetarOracaoPublicada(
    row({ status: "Pendente", descricao: "não deve aparecer" }),
    IGREJA,
  );
  const privatePrayer = projetarOracaoPublicada(
    row({ visibilidade: "Privado", descricao: "não deve aparecer" }),
    IGREJA,
  );
  const approved = projetarOracaoPublicada(
    row({ created_at: "2020-01-01T12:00:00-03:00", nome_solicitante: " " }),
    IGREJA,
  );

  assert.equal(pending, null);
  assert.equal(privatePrayer, null);
  assert.equal(approved?.id, APROVADA);
  assert.equal(approved?.requesterName, "Anônimo");
  assert.equal(approved?.publishedAt, "2020-01-01T15:00:00.000Z");
  assert.equal(approved?.href, `/oracao/${IGREJA}`);
  assert.equal(approved?.actionLabel, "Abrir espaço de oração");
});

test("primeira carga não dispara inundação e uma aprovação posterior vira nova pelo ID", () => {
  const initial = criarEstadoInicialNotificacoesOracao([APROVADA]);
  assert.deepEqual(analisarAtualizacaoNotificacoesOracao(initial, [APROVADA]).newIds, []);

  // created_at antigo não importa: um novo ID aprovado é detectado mesmo fora da janela recente.
  const transition = analisarAtualizacaoNotificacoesOracao(initial, [
    APROVADA,
    NOVA_APROVADA_ANTIGA,
  ]);
  assert.deepEqual(transition.newIds, [NOVA_APROVADA_ANTIGA]);
  assert.deepEqual(
    analisarAtualizacaoNotificacoesOracao(transition.state, [
      APROVADA,
      NOVA_APROVADA_ANTIGA,
    ]).newIds,
    [],
  );
});

test("a chave de leitura separa usuário, membro e igreja sem guardar o conteúdo", () => {
  const keyA = criarChaveStorageNotificacoesOracao("usuario-a", MEMBRO, IGREJA);
  const keyB = criarChaveStorageNotificacoesOracao("usuario-b", MEMBRO, IGREJA);
  assert.notEqual(keyA, keyB);

  const state = criarEstadoInicialNotificacoesOracao([APROVADA]);
  const restored = lerEstadoNotificacoesOracao(JSON.stringify(state));
  assert.deepEqual(restored?.seenIds, [APROVADA]);
  assert.equal(JSON.stringify(restored).includes("Por uma família"), false);
});

test("normalizador do cliente rejeita payloads privados ou links que não sejam a rota pública de oração", () => {
  const approved = projetarOracaoPublicada(row(), IGREJA);
  assert.ok(approved);
  const result = normalizarNotificacoesOracao([
    approved,
    { ...approved, id: "pendente", href: "/admin/oracoes/pendente" },
    { ...approved, id: "sem-tipo", type: "oracao_pendente" },
  ]);
  assert.deepEqual(result.map((item) => item.id), [APROVADA]);
});

function criarService(rows) {
  const chamadas = [];
  return {
    chamadas,
    from(tabela) {
      const chamada = { tabela, filtros: [] };
      chamadas.push(chamada);
      const query = {
        select(campos) {
          chamada.campos = campos;
          return query;
        },
        eq(campo, valor) {
          chamada.filtros.push([campo, valor]);
          return query;
        },
        order(campo, opcoes) {
          chamada.ordens ||= [];
          chamada.ordens.push([campo, opcoes]);
          return query;
        },
        limit(valor) {
          chamada.limit = valor;
          return query;
        },
        range(inicio, fim) {
          chamada.range = [inicio, fim];
          return query;
        },
        then(resolve, reject) {
          try {
            let data = rows.filter((item) =>
              chamada.filtros.every(([campo, valor]) => item[campo] === valor),
            );
            data = chamada.range
              ? data.slice(chamada.range[0], chamada.range[1] + 1)
              : data.slice(0, chamada.limit);
            return Promise.resolve(resolve({ data, error: null }));
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };
      return query;
    },
  };
}

function carregarRoute({ rows, negado } = {}) {
  const root = path.resolve(import.meta.dirname, "..");
  const service = criarService(rows || []);
  const access = {
    AcessoError: class AcessoError extends Error {
      constructor(message, status) {
        super(message);
        this.status = status;
      }
    },
    respostaErroAcesso(error) {
      return Response.json(
        { error: error?.message || "falha segura" },
        { status: error?.status || 500, headers: { "Cache-Control": "private, no-store" } },
      );
    },
    resolverAcesso: async () => {
      if (negado) throw new access.AcessoError("Acesso negado", negado);
      return {
        service,
        contexto: { igrejaId: IGREJA, membro: { id: MEMBRO } },
      };
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const modulo = { exports: {} };
    cache.set(filename, modulo);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "@/lib/access-server") return access;
      if (specifier.startsWith("@/")) return load(path.join(root, specifier.slice(2) + ".ts"));
      throw new Error(`Import não permitido no teste: ${specifier}`);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
      localRequire,
      modulo,
      modulo.exports,
    );
    return modulo.exports;
  }
  return { route: load(path.join(root, "app/api/membros/oracoes/notificacoes/route.ts")), service };
}

test("Route Handler limita igreja e critérios públicos, sem retornar pendentes", async () => {
  const { route, service } = carregarRoute({
    rows: [
      row(),
      row({ id: "pendente", status: "Pendente" }),
      row({ id: "privada", visibilidade: "Privado" }),
      row({ id: "outra-igreja", igreja_id: "outra-igreja" }),
    ],
  });
  const response = await route.GET(
    new Request("https://ohel.test/api/membros/oracoes/notificacoes", {
      headers: { Authorization: "Bearer ficticio" },
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.notifications.map((item) => item.id), [APROVADA]);
  assert.equal(body.notifications[0].body, "Por uma família");
  assert.equal(service.chamadas[0].campos, "id, nome_solicitante, descricao, created_at, status, visibilidade");
  assert.deepEqual(service.chamadas[0].filtros, [
    ["igreja_id", IGREJA],
    ["status", "Em Oração"],
    ["visibilidade", "Público"],
  ]);
  assert.deepEqual(service.chamadas[0].range, [0, 99]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("Route Handler rejeita sessão sem membro antes da consulta", async () => {
  const { route, service } = carregarRoute({ negado: 403 });
  const response = await route.GET(
    new Request("https://ohel.test/api/membros/oracoes/notificacoes"),
  );
  assert.equal(response.status, 403);
  assert.equal(service.chamadas.length, 0);
});
