"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function MembroAuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState("Validando seu acesso...");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finish = async () => {
      const callbackUrl = new URL(window.location.href);
      const code = callbackUrl.searchParams.get("code");
      const errorDescription = callbackUrl.searchParams.get("error_description") || callbackUrl.searchParams.get("error");

      if (errorDescription || !code) {
        setMessage("O link expirou ou não pôde ser validado. Solicite um novo link.");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setMessage("Não foi possível validar o link. Solicite um novo acesso.");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user.email?.toLowerCase();
      if (!email) {
        await supabase.auth.signOut();
        setMessage("O acesso não possui um e-mail válido.");
        return;
      }

      const { data: membro, error: memberError } = await supabase
        .from("membros")
        .select("id, status")
        .eq("email", email)
        .eq("status", "Ativo")
        .maybeSingle();

      if (memberError || !membro) {
        await supabase.auth.signOut();
        setMessage("Seu e-mail ainda não está vinculado a um membro ativo. Aguarde a aprovação da secretaria.");
        return;
      }

      router.replace("/area-membro");
    };

    void finish();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ohel-bg p-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-ohel-blue" aria-hidden="true" />
      <p className="max-w-md text-sm text-gray-300" role="status">{message}</p>
      {message !== "Validando seu acesso..." && <a href="/login-membro" className="text-sm text-ohel-blue hover:underline">Solicitar novo link</a>}
    </main>
  );
}
