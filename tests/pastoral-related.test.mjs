import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import vm from "node:vm";

// Verifica o DTO de nomes relacionados extraído do módulo, sem rede ou banco.
const file = path.resolve(import.meta.dirname, "../lib/pastoral-server.ts");
const ast = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "isolarPessoaRelacionada");
assert.ok(fn);
const source = ts.transpileModule(fn.getText(ast), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const projetar = vm.runInNewContext(`${source}\nisolarPessoaRelacionada`);

test("nome relacionado de outra igreja é omitido e igreja_id nunca vai ao cliente", () => {
  const outro = projetar({id:"atendimento",membros:{nome:"Nome privado",igreja_id:"outra"}},"igreja");
  assert.equal(outro.membros,null);
  const proprio = projetar({id:"atendimento",membros:{nome:"Maria",igreja_id:"igreja"}},"igreja");
  assert.equal(proprio.membros.nome,"Maria");
  assert.equal("igreja_id" in proprio.membros,false);
  assert.equal(projetar({membros:null},"igreja").membros,null);
});
