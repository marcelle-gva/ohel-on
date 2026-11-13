import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

function carregarCalculos() {
  const filename = path.join(root, "lib/financeiro/calculos.ts");
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modulo = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })
    (undefined, modulo, modulo.exports);
  return modulo.exports;
}

const { calcularIndicadoresFinanceiros } = carregarCalculos();

const caixa = {
  id: "10000000-0000-0000-0000-000000000001",
  nome: "Conta fictícia",
  tipo: "Conta Bancária",
  saldoInicialCentavos: 10000,
};

const transacao = (extras = {}) => ({
  id: "20000000-0000-0000-0000-000000000001",
  tipo: "Receita",
  mesReferencia: "2026-11",
  valorCentavos: 5000,
  caixaId: caixa.id,
  ...extras,
});

const conta = (extras = {}) => ({
  id: "30000000-0000-0000-0000-000000000001",
  descricao: "Conta fictícia",
  dataVencimento: "2026-11-20",
  status: "Pendente",
  valorCentavos: 2500,
  ...extras,
});

test("saldo inicial não vira receita e conta bancária reflete lançamentos em centavos", () => {
  const resultado = calcularIndicadoresFinanceiros({
    periodo: "2026-11",
    hojeSaoPaulo: "2026-11-13",
    caixas: [caixa],
    transacoes: [transacao(), transacao({ id: "2", tipo: "Despesa", valorCentavos: 2000 })],
    contasPagar: [],
  });

  assert.equal(resultado.receitasCentavos, 5000);
  assert.equal(resultado.despesasCentavos, 2000);
  assert.equal(resultado.saldoMovimentoCentavos, 3000);
  assert.equal(resultado.saldoContasCentavos, 13000);
  assert.equal(resultado.contas[0].movimentoCentavos, 3000);
});

test("contas a pagar previstas não viram despesa; somente Pago é liquidado", () => {
  const resultado = calcularIndicadoresFinanceiros({
    periodo: "2026-11",
    hojeSaoPaulo: "2026-11-13",
    caixas: [caixa],
    transacoes: [],
    contasPagar: [
      conta(),
      conta({ id: "2", status: "Pago", valorCentavos: 3000 }),
      conta({ id: "3", status: "Cancelado", valorCentavos: 900 }),
      conta({ id: "4", dataVencimento: "2026-10-30", valorCentavos: 700 }),
    ],
  });

  assert.equal(resultado.receitasCentavos, 0);
  assert.equal(resultado.despesasCentavos, 0);
  assert.equal(resultado.contasPagarResumo.previstoCentavos, 5500);
  assert.equal(resultado.contasPagarResumo.pagoCentavos, 3000);
  assert.equal(resultado.contasPagarResumo.emAbertoCentavos, 2500);
  assert.equal(resultado.contasPagarResumo.canceladoCentavos, 900);
  assert.equal(resultado.contasPagar.length, 3);
});

test("tipo desconhecido não duplica transferência nem altera saldo", () => {
  const resultado = calcularIndicadoresFinanceiros({
    periodo: "2026-11",
    hojeSaoPaulo: "2026-11-13",
    caixas: [caixa],
    transacoes: [
      transacao({ id: "1", tipo: "Transferência", valorCentavos: 4000 }),
      transacao({ id: "2", tipo: "Receita", valorCentavos: 1000 }),
    ],
    contasPagar: [],
  });

  assert.equal(resultado.receitasCentavos, 1000);
  assert.equal(resultado.saldoMovimentoCentavos, 1000);
  assert.equal(resultado.saldoContasCentavos, 11000);
  assert.equal(resultado.linhasIgnoradas, 1);
});
