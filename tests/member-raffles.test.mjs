import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";
import {
  dataSorteioEncerrada,
  obterDataAtualSaoPaulo,
  projetarSorteioMembro,
  selecionarSorteiosAtivos,
} from "../lib/member-raffles.ts";

const memberRafflesModule = {
  obterDataAtualSaoPaulo,
  selecionarSorteiosAtivos,
};

const root = path.resolve(import.meta.dirname, "..");
const IGREJA = "10000000-0000-0000-0000-000000000001";
const OUTRA_IGREJA = "10000000-0000-0000-0000-000000000002";

function carregarRota({ rows = [], erro = null, negado = null } = {}) {
  const chamadas = [];
  const service = {
    from(tabela) {
      const chamada = { tabela, filtros: [], campos: "", ordem: null, limite: null };
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
        order(campo, options) {
          chamada.ordem = [campo, options];
          return query;
        },
        limit(valor) {
          chamada.limite = valor;
          return query;
        },
        then(resolve, reject) {
          if (erro) return Promise.resolve({ data: null, error: erro }).then(resolve, reject);
          const filtradas = rows.filter((row) =>
            chamada.filtros.every(([campo, valor]) => row[campo] === valor),
          );
          return Promise.resolve({ data: filtradas, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const acessos = [];
  const source = ts.transpileModule(
    fs.readFileSync(path.join(root, "app/api/membros/sorteios/route.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const modulo = { exports: {} };
  const localRequire = (spec) => {
    if (spec === "@/lib/access-server") {
      class AcessoError extends Error {
        constructor(message, status) {
          super(message);
          this.status = status;
        }
      }
      return {
        AcessoError,
        resolverAcesso: async (_request, exigirMembro) => {
          acessos.push(exigirMembro);
          if (negado) throw new AcessoError("Acesso negado", negado);
          return { service, contexto: { igrejaId: IGREJA } };
        },
        respostaErroAcesso: (error) =>
          Response.json(
            { error: error?.message || "Falha segura" },
            { status: error?.status || 500, headers: { "Cache-Control": "private, no-store" } },
          ),
      };
    }
    if (spec === "@/lib/member-raffles") return memberRafflesModule;
    throw new Error(`Import não permitido no teste: ${spec}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, {
    filename: path.join(root, "app/api/membros/sorteios/route.ts"),
  })(localRequire, modulo, modulo.exports);
  return { rota: modulo.exports, chamadas, acessos };
}

function linha(overrides = {}) {
  return {
    id: "30000000-0000-0000-0000-000000000001",
    igreja_id: IGREJA,
    tipo: "sorteio",
    status: "ativo",
    nome: "Cesta de alimentos",
    descricao: "Escolha um número. O pagamento é conferido pela igreja.",
    valor_bilhete: 10,
    data_sorteio: "2026-11-20",
    cartaz_url: "https://cdn.example.test/cartaz.png",
    created_at: "2026-11-13T12:00:00Z",
    ...overrides,
  };
}

test("data de São Paulo e encerramento usam a data civil correta", () => {
  assert.equal(obterDataAtualSaoPaulo(new Date("2026-11-14T02:59:59Z")), "2026-11-13");
  assert.equal(obterDataAtualSaoPaulo(new Date("2026-11-14T03:00:00Z")), "2026-11-14");
  assert.equal(dataSorteioEncerrada("2026-11-12", "2026-11-13"), true);
  assert.equal(dataSorteioEncerrada("2026-11-13", "2026-11-13"), false);
  assert.equal(dataSorteioEncerrada(null, "2026-11-13"), false);
});

test("seleciona somente sorteios ativos, do tipo sorteio e ainda válidos", () => {
  const rows = [
    linha(),
    linha({ id: "passado", data_sorteio: "2026-11-12" }),
    linha({ id: "pausado", status: "pausado" }),
    linha({ id: "evento", tipo: "evento" }),
    linha({ id: "sem-data", data_sorteio: null }),
  ];
  assert.deepEqual(
    selecionarSorteiosAtivos(rows, "2026-11-13").map((item) => item.id),
    [rows[0].id, "sem-data"],
  );
});

test("projeção pública não expõe telefone, participante, igreja ou status", () => {
  const projetado = projetarSorteioMembro(
    linha({ telefone: "11999999999", participante_id: "privado", status: "ativo" }),
    "2026-11-13",
  );
  assert.ok(projetado);
  assert.equal(projetado.link_publico, `/sorteio/${projetado.id}`);
  assert.equal(projetado.premio, "Cesta de alimentos");
  assert.equal("telefone" in projetado, false);
  assert.equal("participante_id" in projetado, false);
  assert.equal("igreja_id" in projetado, false);
  assert.equal("status" in projetado, false);
});

test("API exige membro, restringe igreja, limita a consulta e seleciona somente campos públicos", async () => {
  const { rota, chamadas, acessos } = carregarRota({ rows: [linha(), linha({ id: "outra", igreja_id: OUTRA_IGREJA })] });
  const response = await rota.GET(new Request("https://ohel.test/api/membros/sorteios", { headers: { Authorization: "Bearer ficticio" } }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(acessos, [true]);
  assert.equal(body.sorteios.length, 1);
  assert.equal("telefone" in body.sorteios[0], false);
  assert.equal("sorteio_participantes" in body.sorteios[0], false);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].tabela, "sorteios");
  assert.deepEqual(chamadas[0].filtros, [["igreja_id", IGREJA], ["tipo", "sorteio"], ["status", "ativo"]]);
  assert.equal(chamadas[0].limite, 50);
  assert.equal(chamadas[0].campos, "id, tipo, status, nome, descricao, valor_bilhete, data_sorteio, cartaz_url, created_at");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("falha do banco vira erro privado e não retorna detalhes", async () => {
  const { rota } = carregarRota({ erro: { code: "DB_UNAVAILABLE", message: "SEGREDO SQL" } });
  const response = await rota.GET(new Request("https://ohel.test/api/membros/sorteios", { headers: { Authorization: "Bearer ficticio" } }));
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes("SEGREDO SQL"), false);
});

test("sessão negada não toca a tabela", async () => {
  const { rota, chamadas } = carregarRota({ negado: 403 });
  const response = await rota.GET(new Request("https://ohel.test/api/membros/sorteios", { headers: { Authorization: "Bearer ficticio" } }));
  assert.equal(response.status, 403);
  assert.equal(chamadas.length, 0);
});
