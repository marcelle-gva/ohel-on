import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function erro(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function autorizar(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: erro("Sessão não informada.", 401) };
  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return { error: erro("Sessão inválida.", 401) };
  const { data: platformAdmin } = await admin.from("ipocloud_platform_admins").select("id").eq("auth_user_id", authData.user.id).eq("ativo", true).maybeSingle();
  if (!platformAdmin) return { error: erro("Somente o Admin Geral da IPO CLOUD pode gerenciar clientes.", 403) };
  return { admin, user: authData.user };
}

export async function GET(request: Request) {
  const authorized = await autorizar(request);
  if ("error" in authorized) return authorized.error;
  const { data, error } = await authorized.admin.from("ipocloud_clientes").select("id, nome, slug, plano, limite_igrejas, status, created_at").order("created_at", { ascending: false });
  if (error) return erro(error.message, 500);
  return NextResponse.json({ clientes: data || [] });
}

export async function POST(request: Request) {
  const authorized = await autorizar(request);
  if ("error" in authorized) return authorized.error;
  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome || "").trim();
  const slug = String(body.slug || nome).trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const plano = String(body.plano || "Igreja individual").trim();
  const limite = Number(body.limite_igrejas || 1);
  const primeiraIgreja = String(body.primeira_igreja || "").trim();
  if (nome.length < 2 || slug.length < 2 || primeiraIgreja.length < 2) return erro("Informe cliente, slug e nome da primeira igreja.");
  if (!Number.isInteger(limite) || limite < 1 || limite > 10000) return erro("O limite de igrejas deve ser um número entre 1 e 10.000.");

  const { data: cliente, error: clienteError } = await authorized.admin.from("ipocloud_clientes").insert({ nome, slug, plano, limite_igrejas: limite }).select("id, nome, slug, plano, limite_igrejas, status, created_at").single();
  if (clienteError || !cliente) return erro(clienteError?.code === "23505" ? "Já existe um cliente com este slug." : clienteError?.message || "Não foi possível criar o cliente.", clienteError?.code === "23505" ? 409 : 500);

  const { data: igreja, error: igrejaError } = await authorized.admin.from("igrejas").insert({ nome: primeiraIgreja }).select("id, nome").single();
  if (igrejaError || !igreja) {
    await authorized.admin.from("ipocloud_clientes").delete().eq("id", cliente.id);
    return erro(igrejaError?.message || "Não foi possível criar a primeira igreja.", 500);
  }
  const { error: vinculoError } = await authorized.admin.from("igrejas").update({ ipocloud_cliente_id: cliente.id }).eq("id", igreja.id);
  if (vinculoError) {
    await authorized.admin.from("igrejas").delete().eq("id", igreja.id);
    await authorized.admin.from("ipocloud_clientes").delete().eq("id", cliente.id);
    return erro(vinculoError.message, 500);
  }
  return NextResponse.json({ cliente, igreja }, { status: 201 });
}
