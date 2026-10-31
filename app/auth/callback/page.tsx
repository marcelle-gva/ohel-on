"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState("Finalizando acesso com o Google...");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finishSignIn = async () => {
      const callbackUrl = new URL(window.location.href);
      const code = callbackUrl.searchParams.get("code");
      const oauthError = callbackUrl.searchParams.get("error_description")
        || callbackUrl.searchParams.get("error");

      if (oauthError || !code) {
        setMessage("Não foi possível concluir o acesso com o Google. Tente novamente.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage("Não foi possível validar a sessão do Google. Tente novamente.");
        return;
      }

      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) {
        setMessage("A sessão foi iniciada, mas não foi possível verificar a autenticação em duas etapas.");
        return;
      }

      router.replace(factors.totp.length > 0 ? "/mfa" : "/dashboard");
    };

    void finishSignIn();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ohel-bg p-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-ohel-blue" aria-hidden="true" />
      <p className="max-w-md text-sm text-gray-300" role="status">{message}</p>
      {message !== "Finalizando acesso com o Google..." && (
        <a href="/login" className="text-sm text-ohel-blue hover:underline">Voltar ao login</a>
      )}
    </main>
  );
}
