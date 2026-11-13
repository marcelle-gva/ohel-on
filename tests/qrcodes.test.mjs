import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const require = createRequire(import.meta.url);
const igrejaId = "11111111-1111-4111-8111-111111111111";

async function carregarHelper() {
  const source = await readFile(new URL("../lib/qrcode-public.ts", import.meta.url), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const moduloTranspilado = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "./public-site") return { obterOrigemPublica: () => "https://www.ipocloud.com.br" };
    return require(specifier);
  };
  new Function("require", "module", "exports", transpiled)(localRequire, moduloTranspilado, moduloTranspilado.exports);
  return moduloTranspilado.exports;
}

test("links públicos usam o domínio oficial e rotas distintas", async () => {
  const {
    criarLinkPublicoCongregado,
    criarLinkPublicoQr,
    criarLinkPublicoVisitante,
  } = await carregarHelper();
  assert.equal(
    criarLinkPublicoCongregado(igrejaId),
    `https://www.ipocloud.com.br/congregado/${igrejaId}`,
  );
  assert.equal(
    criarLinkPublicoVisitante(igrejaId),
    `https://www.ipocloud.com.br/visitante/${igrejaId}`,
  );
  assert.equal(criarLinkPublicoQr("congregado", igrejaId), criarLinkPublicoCongregado(igrejaId));
  assert.equal(criarLinkPublicoQr("visitante", igrejaId), criarLinkPublicoVisitante(igrejaId));
});

test("helper rejeita IDs que poderiam alterar a origem ou o caminho", async () => {
  const { criarLinkPublicoCongregado, criarLinkPublicoVisitante } = await carregarHelper();
  assert.equal(criarLinkPublicoCongregado("https://evil.example/igreja"), "");
  assert.equal(criarLinkPublicoVisitante(""), "");
  assert.equal(criarLinkPublicoVisitante(`${igrejaId}/extra`), "");
});

test("API protegida exige resolverAcesso e permissão por módulo", async () => {
  const source = await readFile(new URL("../app/api/qrcodes/route.ts", import.meta.url), "utf8");
  assert.match(source, /resolverAcesso\(request\)/);
  assert.match(source, /podeAcessar\(contexto, modulo, "ler"\)/);
  assert.match(source, /criarLinkPublicoCongregado/);
  assert.match(source, /criarLinkPublicoVisitante/);
});

test("pré-cadastro público não aceita role/permissões e grava somente status inicial", async () => {
  const source = await readFile(new URL("../app/api/congregados/pre-cadastro/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /role\s*:/);
  assert.doesNotMatch(source, /permiss/);
  assert.match(source, /status:\s*"Pré-Cadastro"/);
  assert.match(source, /\.eq\("igreja_id", igrejaId\)/);
});
