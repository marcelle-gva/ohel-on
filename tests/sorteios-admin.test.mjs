import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  construirPromptPremio,
  detectarMimeImagem,
  parseNumeroManual,
  validarCadastroComprador,
  validarImagemRecebida,
} from "../lib/sorteios-admin.ts";

test("detecta JPEG, PNG e WebP por assinatura real, não apenas extensão", () => {
  assert.equal(detectarMimeImagem(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectarMimeImagem(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectarMimeImagem(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectarMimeImagem(Uint8Array.from([0x00, 0x01, 0x02])), null);
});

test("rejeita MIME declarado divergente e tamanho acima do limite", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(validarImagemRecebida(png, "image/jpeg"), { error: "O conteúdo da foto não corresponde ao MIME informado." });
  assert.match(validarImagemRecebida(new Uint8Array(8 * 1024 * 1024 + 1), "image/png").error, /8 MB/);
});

test("aceita somente número inteiro seguro e cadastro mínimo de comprador", () => {
  assert.equal(parseNumeroManual("0012"), 12);
  assert.equal(parseNumeroManual("12.5"), null);
  assert.equal(parseNumeroManual(Number.MAX_SAFE_INTEGER + 1), null);
  assert.equal(validarCadastroComprador("Ana", "11999999999"), null);
  assert.match(validarCadastroComprador("A", "11999999999"), /nome/);
  assert.match(validarCadastroComprador("Ana", "1"), /telefone/);
});

test("prompt usa prêmio sem dados aparentes de contato/participantes", () => {
  const prompt = construirPromptPremio("Cesta especial", "Contato 11999999999 ou teste@example.com");
  assert.match(prompt, /Cesta especial/);
  assert.doesNotMatch(prompt, /11999999999|teste@example.com/);
  assert.match(prompt, /Não inclua texto/);
});

test("migration não cria lançamentos financeiros e contém proteção/atomicidade administrativas", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261113164700_sorteios_vendedores_imagem.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists vendedor_membro_id/);
  assert.match(migration, /registrar_numero_manual_sorteio/);
  assert.match(migration, /for update/);
  assert.match(migration, /role = 'admin'/);
  assert.match(migration, /revoke all on function/);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.transacoes/i);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.contas_pagar/i);
});
