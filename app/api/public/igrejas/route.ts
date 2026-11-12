import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("igrejas")
    .select("id, nome, logo_url")
    .order("nome", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: "Não foi possível carregar as igrejas." }, { status: 500 });
  return NextResponse.json(
    { igrejas: data || [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
