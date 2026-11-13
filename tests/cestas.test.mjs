import test from "node:test";
import assert from "node:assert/strict";
import {
  combinarSugestoes,
  compromissoPorReserva,
  quantidadePorCestaSegura,
  separarCompromissos,
  totalNecessario,
} from "../lib/cestas.ts";

test("calcula o total da campanha sem misturar reserva com meta", () => {
  const item = { quantidade_necessaria: 6, quantidade_por_cesta: 2 };
  assert.equal(totalNecessario(item, 3), 6);
  assert.deepEqual(separarCompromissos([
    { quantidade: 2, status: "reservado" },
    { quantidade: 1, status: "entregue" },
    { quantidade: 4, status: "cancelado" },
  ]), { reservado: 2, entregue: 1 });
  assert.equal(compromissoPorReserva([
    { quantidade: 2, status: "reservado" },
    { quantidade: 1, status: "entregue" },
    { quantidade: 4, status: "cancelado" },
  ]), 3);
});

test("item legado só deriva quantidade por cesta quando a campanha é uma cesta", () => {
  const legado = { quantidade_necessaria: 8, quantidade_por_cesta: null };
  assert.equal(quantidadePorCestaSegura(legado, 1), 8);
  assert.equal(quantidadePorCestaSegura(legado, 2), null);
  assert.equal(totalNecessario(legado, 2), 8);
});

test("sugestões priorizam a história da própria igreja, deduplicam e não alteram dados", () => {
  const sugestoes = combinarSugestoes([
    { nome: "Arroz", unidade: "kg" },
    { nome: " arroz ", unidade: "KG" },
    { nome: "Cesta especial", unidade: "kit" },
  ]);
  assert.deepEqual(sugestoes.slice(0, 2), [
    { nome: "Arroz", unidade: "kg", origem: "histórico da igreja" },
    { nome: "Cesta especial", unidade: "kit", origem: "histórico da igreja" },
  ]);
  assert.ok(sugestoes.some((item) => item.nome === "Feijão" && item.origem === "catálogo básico"));
});
