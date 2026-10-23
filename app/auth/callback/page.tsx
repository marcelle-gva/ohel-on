"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";
import { getPostAuthenticationPath } from "@/lib/auth";
import { supabaseCallback } from "@/lib/supabase-callback";

export default function AuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finishSignIn = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (params.has("error") || !code) {
        setErrorMessage("Não foi possível concluir o login com Google. Tente novamente.");
        return;
      }

      try {
        const { error } = await supabaseCallback.auth.exchangeCodeForSession(code);
        if (error) throw error;

        router.replace(await getPostAuthenticationPath(supabaseCallback));
      } catch (error) {
        console.error("Falha ao concluir o login com Google:", error);
        setErrorMessage("Não foi possível concluir o login com Google. Tente novamente.");
      }
    };

    void finishSignIn();
  }, [router]);

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-ohel-glow p-4">
      <Card className="w-full max-w-[400px] flex flex-col items-center px-8 py-8 border-gray-800 text-center">
        <Logo className="h-[100px] w-[200px] mb-4" />
        {errorMessage ? (
          <>
            <h1 className="text-white text-lg font-bold">Falha na autenticação</h1>
            <p className="text-sm text-gray-400 mt-3">{errorMessage}</p>
            <Link href="/" className="text-sm text-ohel-blue hover:underline mt-6">
              Voltar ao login
            </Link>
          </>
        ) : (
          <p className="text-sm text-gray-400">Validando sua autenticação...</p>
        )}
      </Card>
    </main>
  );
}
