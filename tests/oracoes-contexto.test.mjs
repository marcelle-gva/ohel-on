import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_FILE = path.join(ROOT, "app/(painel)/monitor-midia/historico-cultos/page.tsx");
const MONITOR_FILE = path.join(ROOT, "app/(painel)/monitor-midia/page.tsx");

const IGREJA_A = "igreja-a";
const IGREJA_B = "igreja-b";
const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const CULTO_A = "culto-a";
const CULTO_B = "culto-b";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function noop() {
  return null;
}

function carregarPaginaHistorico() {
  const modulo = { exports: {} };
  const react = {
    useEffect: noop,
    useLayoutEffect: noop,
    useMemo: (factory) => factory(),
    useRef: (current) => ({ current }),
    useState: (initial) => [initial, noop],
  };
  const jsxRuntime = { Fragment: Symbol("Fragment"), jsx: noop, jsxs: noop };
  const lucide = new Proxy({}, { get: () => noop });
  const mocks = new Map([
    ["react", react],
    ["react/jsx-runtime", jsxRuntime],
    ["next/link", noop],
    ["@/lib/supabase", { supabase: {} }],
    ["@/components/layout/AccessShell", { useAccess: () => null }],
    ["@/lib/access", { podeAcessar: () => false }],
    ["@/components/ui/Card", { Card: noop }],
    ["@/components/ui/Button", { Button: noop }],
    ["@/components/ui/Input", { Input: noop }],
    ["@/components/ui/FeedbackModal", { FeedbackModal: noop }],
    ["@/components/cultos/AgendaAnualCard", { AgendaAnualCard: noop }],
    ["lucide-react", lucide],
    ["@/lib/programacao-cultos", {
      anoAtualAgenda: () => "2026",
      DIAS_SEMANA: [],
      intervaloValido: () => true,
    }],
  ]);
  const code = ts.transpileModule(fs.readFileSync(HISTORY_FILE, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const localRequire = (specifier) => {
    if (mocks.has(specifier)) return mocks.get(specifier);
    throw new Error(`Import real proibido no harness: ${specifier}`);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
    filename: HISTORY_FILE,
  })(localRequire, modulo, modulo.exports);
  return modulo.exports;
}

function criarSupabaseFake({ session, userChurches = {}, responseByCulto = {}, sessionGate = null }) {
  let currentSession = session;
  const calls = [];
  const auth = {
    getSession: () => sessionGate
      ? sessionGate.promise
      : Promise.resolve({ data: { session: currentSession } }),
  };
  const fake = {
    auth,
    calls,
    setSession(nextSession) {
      currentSession = nextSession;
    },
    from(table) {
      const call = {
        table,
        fields: null,
        filters: [],
        signal: null,
        deferred: responseByCulto["__default"] || null,
      };
      calls.push(call);
      const query = {
        select(fields) {
          call.fields = fields;
          return query;
        },
        eq(field, value) {
          call.filters.push([field, value]);
          return query;
        },
        order(field, options) {
          call.order = [field, options];
          return query;
        },
        abortSignal(signal) {
          call.signal = signal;
          return query;
        },
        maybeSingle() {
          const userId = call.filters.find(([field]) => field === "id")?.[1];
          return Promise.resolve({
            data: userId ? { igreja_id: userChurches[userId] || null } : null,
            error: null,
          });
        },
        then(resolve, reject) {
          if (table !== "culto_registros") {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
          const cultoId = call.filters.find(([field]) => field === "culto_id")?.[1];
          const pending = responseByCulto[cultoId] || responseByCulto["__default"];
          if (!pending) {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
          return pending.promise.then(resolve, reject);
        },
      };
      return query;
    },
  };
  return fake;
}

function sessionFor(id) {
  return { user: { id } };
}

function contextFor(usuarioId, igrejaId) {
  return { usuarioId, igrejaId };
}

const historyPage = carregarPaginaHistorico();
const { carregarRegistrosHistorico, contextoHistoricoValido } = historyPage;

function findUseEffect(sourceFile) {
  let found = null;
  function visit(node) {
    if (found) return;
    if (ts.isCallExpression(node) && node.expression.getText(sourceFile) === "useEffect") {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

test("helper do histórico aplica usuário/igreja, cancela resposta velha e não restaura privado", async () => {
  const respostaA = deferred();
  const respostaB = deferred();
  const fake = criarSupabaseFake({
    session: sessionFor(USUARIO_A),
    userChurches: { [USUARIO_A]: IGREJA_A, [USUARIO_B]: IGREJA_B },
    responseByCulto: { [CULTO_A]: respostaA, [CULTO_B]: respostaB },
  });
  const controllerA = new AbortController();
  const controllerB = new AbortController();
  let ativoA = true;
  let ativoB = true;
  const escopoA = {
    contexto: contextFor(USUARIO_A, IGREJA_A),
    cultoId: CULTO_A,
    signal: controllerA.signal,
  };
  const escopoB = {
    contexto: contextFor(USUARIO_B, IGREJA_B),
    cultoId: CULTO_B,
    signal: controllerB.signal,
  };

  const antigo = carregarRegistrosHistorico(fake, escopoA, () => ativoA);
  await new Promise((resolve) => setImmediate(resolve));
  const chamadaA = fake.calls.find((call) => call.table === "culto_registros" && call.filters.some(([field, value]) => field === "culto_id" && value === CULTO_A));
  assert.ok(chamadaA, "a consulta antiga deve ter chegado ao registro deferred");
  assert.deepEqual(chamadaA.filters, [["igreja_id", IGREJA_A], ["culto_id", CULTO_A]]);
  assert.equal(chamadaA.signal, controllerA.signal);

  ativoA = false;
  controllerA.abort();
  fake.setSession(sessionFor(USUARIO_B));
  const novo = carregarRegistrosHistorico(fake, escopoB, () => ativoB);
  await new Promise((resolve) => setImmediate(resolve));
  const chamadaB = fake.calls.find((call) => call.table === "culto_registros" && call.filters.some(([field, value]) => field === "culto_id" && value === CULTO_B));
  assert.ok(chamadaB, "a consulta nova deve usar o novo culto");
  assert.deepEqual(chamadaB.filters, [["igreja_id", IGREJA_B], ["culto_id", CULTO_B]]);
  assert.equal(chamadaB.signal, controllerB.signal);

  respostaB.resolve({
    data: [{ id: "registro-b", titulo: "Histórico público B", criado_em: "2026-01-01T10:00:00Z" }],
    error: null,
  });
  assert.deepEqual((await novo).map((registro) => registro.id), ["registro-b"]);

  respostaA.resolve({
    data: [{ id: "privado-a", titulo: "Pedido privado A", criado_em: "2026-01-01T09:00:00Z" }],
    error: null,
  });
  assert.deepEqual(await antigo, [], "resposta da igreja/usuário anterior não pode voltar para o novo contexto");
  ativoB = false;
});

test("helper rejeita sessão trocada antes da consulta e transforma erro em histórico vazio", async () => {
  const sessionGate = deferred();
  const resposta = deferred();
  const fake = criarSupabaseFake({
    session: sessionFor(USUARIO_A),
    userChurches: { [USUARIO_A]: IGREJA_A, [USUARIO_B]: IGREJA_B },
    responseByCulto: { [CULTO_A]: resposta },
    sessionGate,
  });
  const controller = new AbortController();
  let ativo = true;
  const consulta = carregarRegistrosHistorico(
    fake,
    { contexto: contextFor(USUARIO_A, IGREJA_A), cultoId: CULTO_A, signal: controller.signal },
    () => ativo,
  );
  ativo = false;
  fake.setSession(sessionFor(USUARIO_B));
  sessionGate.resolve({ data: { session: sessionFor(USUARIO_A) } });
  assert.deepEqual(await consulta, []);
  assert.equal(fake.calls.some((call) => call.table === "culto_registros"), false, "logout/troca antes da sessão terminar não deve consultar o diário");

  const fakeError = criarSupabaseFake({
    session: sessionFor(USUARIO_A),
    userChurches: { [USUARIO_A]: IGREJA_A },
    responseByCulto: { [CULTO_A]: resposta },
  });
  const errorController = new AbortController();
  const errorConsulta = carregarRegistrosHistorico(
    fakeError,
    { contexto: contextFor(USUARIO_A, IGREJA_A), cultoId: CULTO_A, signal: errorController.signal },
    () => true,
  );
  await new Promise((resolve) => setImmediate(resolve));
  resposta.resolve({ data: null, error: { name: "PostgrestError", message: "falha simulada" } });
  assert.deepEqual(await errorConsulta, [], "erro do Supabase deve deixar o diário vazio, não manter dados antigos");
});

test("validador não confunde usuários/igrejas e não permite restaurar conteúdo privado de outro tenant", () => {
  assert.equal(contextoHistoricoValido(contextFor(USUARIO_A, IGREJA_A), sessionFor(USUARIO_A), { igreja_id: IGREJA_A }), true);
  assert.equal(contextoHistoricoValido(contextFor(USUARIO_A, IGREJA_A), sessionFor(USUARIO_B), { igreja_id: IGREJA_B }), false);
  assert.equal(contextoHistoricoValido(contextFor(USUARIO_A, IGREJA_A), sessionFor(USUARIO_A), { igreja_id: IGREJA_B }), false);
  assert.equal(contextoHistoricoValido(contextFor(USUARIO_A, IGREJA_A), null, { igreja_id: IGREJA_A }), false);
});

test("fonte do Histórico está ligada ao helper real e ao ciclo de autenticação", () => {
  const source = fs.readFileSync(HISTORY_FILE, "utf8");
  assert.equal(source.startsWith('"use client";'), true);
  assert.equal(source.includes("const contexto = useAccess();"), true);
  assert.equal(source.includes(".eq(\"igreja_id\", escopo.contexto.igrejaId)"), true);
  assert.equal(source.includes(".eq(\"culto_id\", escopo.cultoId)"), true);
  assert.equal(source.includes("const controller = new AbortController();"), true);
  assert.equal(source.includes("supabase.auth.onAuthStateChange"), true);
  assert.equal(source.includes("session.user.id !== usuarioId"), true);
  assert.equal(source.includes("contextoVersaoRef.current === versaoContexto"), true);
  assert.equal(source.includes("setRegistros([])"), true);
  assert.equal(source.includes("[sessaoSelecionada, contexto?.usuarioId, contexto?.igrejaId]"), true);
});

test("Monitor mantém guards tenant/session, abort e limpeza no listener sem importar serviços reais", () => {
  const source = fs.readFileSync(MONITOR_FILE, "utf8");
  const sourceFile = ts.createSourceFile(MONITOR_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const effect = findUseEffect(sourceFile);
  assert.ok(effect, "Monitor deve conservar o effect de carregamento");
  const effectText = effect.getText(sourceFile);
  assert.equal(effectText.includes("if (!contexto?.usuarioId || !contexto.igrejaId) return;"), true);
  assert.equal(effectText.includes("supabase.auth.getSession()"), true);
  assert.equal(effectText.includes("session.user.id !== contexto.usuarioId"), true);
  assert.equal(effectText.includes("user.igreja_id !== contexto.igrejaId"), true);
  assert.equal(effectText.includes("const controller = new AbortController();"), true);
  assert.equal(effectText.includes("controller.abort();"), true);
  assert.equal(effectText.includes("setOracoesSemana([]);"), true);
  assert.equal(effectText.includes("setOracoesPendentes([]);"), true);
  assert.equal(effectText.includes("setMuralRecente([]);"), true);
  assert.equal(effectText.includes("setVisitantesHoje([]);"), true);
  assert.equal(effectText.includes("contexto?.usuarioId, contexto?.igrejaId"), true);
});
