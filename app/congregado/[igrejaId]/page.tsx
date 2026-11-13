import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Logo } from "@/components/brand/Logo";
import { CongregadoRegistrationForm } from "@/components/public/CongregadoRegistrationForm";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CongregacaoOpcao = { id: string; nome: string };

export default async function CongregadoPage({
  params,
}: {
  params: Promise<{ igrejaId: string }>;
}) {
  const { igrejaId } = await params;
  if (!UUID_RE.test(igrejaId)) notFound();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) notFound();

  const service = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: igreja } = await service
    .from("igrejas")
    .select("id, nome")
    .eq("id", igrejaId)
    .maybeSingle();
  if (!igreja) notFound();

  const { data: congregacoes } = await service
    .from("congregacoes")
    .select("id, nome")
    .eq("igreja_id", igreja.id)
    .order("nome")
    .limit(100);

  return (
    <main className="min-h-screen bg-ohel-glow px-4 py-8 text-white sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <Logo className="mb-5 h-20 w-40" />
        <p className="text-center text-xs uppercase tracking-[0.2em] text-blue-300">Pré-cadastro de congregado</p>
        <h1 className="mt-2 text-center text-2xl font-bold">Seja bem-vindo à {igreja.nome}</h1>
        <p className="mb-6 mt-2 text-center text-sm leading-6 text-gray-400">
          Envie seus dados básicos para a secretaria. O formulário não cria usuário, cargo ou permissão.
        </p>
        <CongregadoRegistrationForm
          igrejaId={igreja.id}
          igrejaNome={igreja.nome}
          congregacoes={(congregacoes || []) as CongregacaoOpcao[]}
        />
      </div>
    </main>
  );
}
