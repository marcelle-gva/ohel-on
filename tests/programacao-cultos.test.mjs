import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  dataAgendaLegivel,
  intervaloValido,
} from "../lib/programacao-cultos.ts";

const migrationPath = new URL("../supabase/migrations/20261113172500_programacao_cultos_edicao_anual.sql", import.meta.url);
const fixturePath = new URL("./fixtures/programacao-cultos.fixture.sql", import.meta.url);
const pagePath = new URL("../app/(painel)/monitor-midia/historico-cultos/page.tsx", import.meta.url);

function sobrepoe(a, b) {
  return a.inicio < b.fim && a.fim > b.inicio;
}

function criarHarness() {
  const modelos = [{ id: "modelo-1", igreja_id: "igreja-1", nome: "Domingo", tipo: "Culto Especial", dia_semana: 0, inicio: "09:00", fim: "11:00", ativo: true, vigencia_desde: "2026-01-01T00:00:00Z" }];
  const sessoes = [{ id: "sessao-anterior", modelo_id: "modelo-1", titulo: "Domingo", inicio: "2026-11-08T12:00:00Z", fim: "2026-11-08T14:00:00Z", status: "encerrado" }, { id: "sessao-atual", modelo_id: "modelo-1", titulo: "Domingo", inicio: "2026-11-15T12:00:00Z", fim: "2026-11-15T14:00:00Z", status: "aberto" }];
  const anuais = [];
  return {
    editarModelo(id, alteracoes) {
      const modelo = modelos.find((item) => item.id === id);
      if (!modelo) throw new Error("not found");
      if (!intervaloValido(alteracoes.inicio, alteracoes.fim)) throw new Error("intervalo");
      const conflito = modelos.some((outro) => outro.id !== id && outro.ativo && outro.dia_semana === alteracoes.dia_semana && sobrepoe({ inicio: alteracoes.inicio, fim: alteracoes.fim }, { inicio: outro.inicio, fim: outro.fim }));
      if (conflito) throw new Error("conflito");
      Object.assign(modelo, alteracoes, { vigencia_desde: "2026-11-13T17:25:00Z" });
    },
    criarAnual(item) {
      if (!intervaloValido(item.inicio, item.fim)) throw new Error("intervalo");
      if (anuais.some((outro) => outro.ativo && outro.data === item.data && sobrepoe(item, outro))) throw new Error("conflito");
      anuais.push({ ...item, ativo: true });
    },
    snapshot() { return { modelos: structuredClone(modelos), sessoes: structuredClone(sessoes), anuais: structuredClone(anuais) }; },
  };
}

test("migration cria agenda anual separada, RLS por igreja e RPCs administrativas", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const fixture = await readFile(fixturePath, "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.programacoes_cultos_anuais/i);
  assert.match(migration, /FOR SELECT TO authenticated/i);
  assert.match(migration, /lower\(coalesce\(u\.role::text, ''\)\) = 'admin'/i);
  assert.match(migration, /REVOKE ALL ON public\.programacoes_cultos_anuais FROM PUBLIC, anon, authenticated/i);
  assert.match(migration, /GRANT SELECT ON public\.programacoes_cultos_anuais TO authenticated/i);
  for (const rpc of ["criar_programacao_culto", "editar_programacao_culto", "alternar_programacao_culto", "criar_programacao_culto_anual", "editar_programacao_culto_anual", "alternar_programacao_culto_anual"]) assert.match(migration, new RegExp(`FUNCTION public\\.${rpc}`));
  assert.match(migration, /materializar_sessoes_culto\(p_igreja_id\)/i);
  assert.match(migration, /vigencia_desde = v_agora/i);
  assert.doesNotMatch(migration, /INSERT INTO public\.culto_sessoes[\s\S]{0,300}programacoes_cultos_anuais/i);
  assert.match(fixture, /fixture_programacoes_cultos_anuais/);
});

test("edição de modelo preserva sessões anteriores e em andamento, mas recomeça vigência", () => {
  const harness = criarHarness();
  const antes = harness.snapshot();
  harness.editarModelo("modelo-1", { nome: "Domingo reformulado", tipo: "Culto Especial", dia_semana: 0, inicio: "10:00", fim: "12:00" });
  const depois = harness.snapshot();
  assert.deepEqual(depois.sessoes, antes.sessoes);
  assert.equal(depois.modelos[0].nome, "Domingo reformulado");
  assert.equal(depois.modelos[0].vigencia_desde, "2026-11-13T17:25:00Z");
});

test("agenda anual impede sobreposição no mesmo dia sem criar sessão", () => {
  const harness = criarHarness();
  harness.criarAnual({ data: "2026-12-20", inicio: "14:00", fim: "16:00", titulo: "Especial", tipo: "Culto Especial" });
  assert.throws(() => harness.criarAnual({ data: "2026-12-20", inicio: "15:00", fim: "17:00", titulo: "Conflito", tipo: "Culto Especial" }), /conflito/);
  assert.equal(harness.snapshot().sessoes.length, 2);
  assert.equal(harness.snapshot().anuais.length, 1);
});

test("helpers formatam data local e rejeitam intervalo invertido", () => {
  assert.equal(dataAgendaLegivel("2026-12-25"), "25/12/2026");
  assert.equal(intervaloValido("19:00", "21:00"), true);
  assert.equal(intervaloValido("21:00", "19:00"), false);
});

test("tela mantém agenda anual separada e link condicional do Culto no Lar", async () => {
  const page = await readFile(pagePath, "utf8");
  assert.match(page, /AgendaAnualCard/);
  assert.match(page, /programacoes_cultos_anuais/);
  assert.match(page, /secretaria\/mural\/culto-no-lar/);
  assert.match(page, /podeAcessar\(contexto, "mural", "ler"\)/);
});
