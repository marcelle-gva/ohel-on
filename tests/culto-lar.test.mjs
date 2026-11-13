import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canModerate,
  canViewPost,
  detectarMimeFotoCultoLar,
  toCultoLarPostDTO,
  validarAutorizacaoImagem,
  validarCamposCultoLar,
  validarDataCultoLar,
  validarFotoCultoLar,
} from "../lib/culto-lar.ts";

const IGREJA = "10000000-0000-4000-8000-000000000001";
const OUTRA_IGREJA = "10000000-0000-4000-8000-000000000002";
const MEMBRO = "20000000-0000-4000-8000-000000000001";
const AUTOR = "30000000-0000-4000-8000-000000000001";
const POST = "40000000-0000-4000-8000-000000000001";

const basePost = (extra = {}) => ({
  id: POST,
  igreja_id: IGREJA,
  membro_id: MEMBRO,
  autor_usuario_id: AUTOR,
  casa_nome: "Casa Esperança",
  data_culto: "2026-11-13",
  titulo: "Palavra",
  referencia: "João 3:16",
  palavra: "Texto da Palavra ministrada.",
  foto_path: `${IGREJA}/${MEMBRO}/${POST}/foto.webp`,
  foto_mime: "image/webp",
  status: "Rejeitado",
  motivo_rejeicao: "A foto precisa ser refeita.",
  versao: 2,
  decidido_por: "50000000-0000-4000-8000-000000000001",
  decidido_em: "2026-11-13T12:00:00Z",
  created_at: "2026-11-13T11:00:00Z",
  updated_at: "2026-11-13T12:00:00Z",
  autor: { id: MEMBRO, nome: "Ana" },
  ...extra,
});

test("valida campos mínimos e rejeita datas civis impossíveis", () => {
  const ok = validarCamposCultoLar({
    casa_nome: "  Casa Esperança ",
    data_culto: "2024-02-29",
    titulo: "  Título ",
    referencia: "João 3:16",
    palavra: "  Palavra ministrada  ",
  });
  assert.deepEqual(ok, {
    ok: true,
    value: {
      casa_nome: "Casa Esperança",
      data_culto: "2024-02-29",
      titulo: "Título",
      referencia: "João 3:16",
      palavra: "Palavra ministrada",
    },
  });
  assert.equal(validarDataCultoLar("2023-02-29").ok, false);
  assert.equal(validarDataCultoLar("2026-02-30").ok, false);
  assert.equal(validarDataCultoLar("2026-11-13T00:00:00Z").ok, false);
});

test("exige autorização de imagem sem persistir uma declaração jurídica", () => {
  assert.deepEqual(validarAutorizacaoImagem("true"), { ok: true, value: true });
  assert.equal(validarAutorizacaoImagem("false").ok, false);
  assert.equal(validarAutorizacaoImagem(undefined).ok, false);
});

test("valida assinatura JPEG/PNG/WebP e MIME declarado, não extensão", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(detectarMimeFotoCultoLar(jpeg), "image/jpeg");
  assert.equal(detectarMimeFotoCultoLar(png), "image/png");
  assert.equal(detectarMimeFotoCultoLar(webp), "image/webp");
  assert.equal(validarFotoCultoLar(jpeg, "image/jpeg").ok, true);
  assert.equal(validarFotoCultoLar(jpeg, "image/png").ok, false);
  const excessiva = new Uint8Array(4 * 1024 * 1024 + 1);
  excessiva.set(png);
  assert.deepEqual(validarFotoCultoLar(excessiva, "image/png"), { ok: false, error: "A foto deve ter no máximo 4 MB." });
});

test("canModerate exige admin ou grupo Liderança com decisão real", () => {
  assert.equal(canModerate({ role: "admin", grupoNome: null, permissoes: [] }), true);
  assert.equal(canModerate({ role: "membro", grupoNome: "Liderança", permissoes: [{ modulo: "mural", acao: "aprovar" }] }), true);
  assert.equal(canModerate({ role: "membro", grupoNome: "Lideranca", permissoes: [{ modulo: "oracoes", acao: "editar" }] }), true);
  assert.equal(canModerate({ role: "membro", grupoNome: "Liderança", permissoes: [{ modulo: "monitor-midia", acao: "editar" }] }), false);
  assert.equal(canModerate({ role: "membro", grupoNome: "Secretaria", permissoes: [{ modulo: "mural", acao: "aprovar" }] }), false);
  assert.equal(canModerate({ role: "membro", grupoNome: "Liderança", permissoes: [{ modulo: "mural", acao: "ler" }] }), false);
});

test("visibilidade mantém pendente/rejeitado privado e aprovado na mesma igreja", () => {
  const membro = { id: MEMBRO, nome: "Ana", foto_url: null, cargo: "Pastora", departamento: "" };
  const viewer = { igrejaId: IGREJA, usuarioId: AUTOR, membro, role: "membro", grupoNome: null, permissoes: [] };
  assert.equal(canViewPost(viewer, basePost({ status: "Pendente" })), true);
  assert.equal(canViewPost(viewer, basePost({ status: "Rejeitado" })), true);
  assert.equal(canViewPost(viewer, basePost({ status: "Aprovado" })), true);
  assert.equal(canViewPost(viewer, basePost({ status: "Pendente", membro_id: "20000000-0000-4000-8000-000000000099" })), false);
  assert.equal(canViewPost(viewer, basePost({ igreja_id: OUTRA_IGREJA, status: "Aprovado" })), false);
  const contaReatribuida = { ...viewer, usuarioId: "30000000-0000-4000-8000-000000000099" };
  assert.equal(canViewPost(contaReatribuida, basePost({ status: "Pendente" })), false);
  assert.equal(canViewPost(contaReatribuida, basePost({ status: "Rejeitado" })), false);
  assert.equal(canViewPost(contaReatribuida, basePost({ status: "Aprovado" })), true);
  assert.equal(canViewPost({ ...contaReatribuida, grupoNome: "Liderança", permissoes: [{ modulo: "mural", acao: "aprovar" }] }, basePost({ status: "Pendente" })), true);
});

test("DTO não vaza motivo no mural nem path de Storage", () => {
  const row = basePost();
  const mural = toCultoLarPostDTO(row, { includePrivateReason: false });
  const privado = toCultoLarPostDTO(row, { includePrivateReason: true });
  assert.equal("motivo_rejeicao" in mural, false);
  assert.equal(privado.motivo_rejeicao, "A foto precisa ser refeita.");
  assert.equal("foto_path" in mural, false);
  assert.equal(mural.foto_endpoint, `/api/culto-lar/${POST}/foto`);
  assert.equal(mural.autor.nome, "Ana");
});

test("migration é aditiva, privada, sem URL pública e com CAS/histórico", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261113172600_culto_no_lar.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.culto_lar_posts/i);
  assert.match(sql, /create table if not exists public\.culto_lar_decisoes/i);
  assert.match(sql, /culto-lar-fotos', 'culto-lar-fotos', false/);
  assert.match(sql, /revoke all on table public\.culto_lar_posts, public\.culto_lar_decisoes from public, anon, authenticated/i);
  assert.match(sql, /as restrictive\s+for all to authenticated/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /p_versao bigint/i);
  assert.match(sql, /versao_anterior/i);
  assert.doesNotMatch(sql, /getPublicUrl|cartazes|stablepublic/i);
});
