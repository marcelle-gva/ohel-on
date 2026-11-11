import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Logo } from "@/components/brand/Logo";
import { VisitorRegistrationForm } from "@/components/public/VisitorRegistrationForm";

export const dynamic = "force-dynamic";

export default async function VisitantePage({ params }: { params: Promise<{ igrejaId: string }> }) {
  const { igrejaId } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) notFound();
  const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: igreja } = await service.from("igrejas").select("id, nome").eq("id", igrejaId).maybeSingle();
  if (!igreja) notFound();

  return (
    <main className="min-h-screen bg-ohel-glow px-4 py-8 text-white sm:py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <Logo className="mb-5 h-20 w-40" />
        <p className="text-center text-xs uppercase tracking-[0.2em] text-purple-300">Recepção de visitantes</p>
        <h1 className="mt-2 text-center text-2xl font-bold">Seja bem-vindo à {igreja.nome}</h1>
        <p className="mt-2 mb-6 text-center text-sm leading-6 text-gray-400">Será uma alegria receber você. Deixe seus dados para nossa equipe acolher sua visita.</p>
        <VisitorRegistrationForm igrejaId={igreja.id} igrejaNome={igreja.nome} />
      </div>
    </main>
  );
}
