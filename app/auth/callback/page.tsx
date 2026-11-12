"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const started = useRef(false);
  const [message, setMessage] = useState("Finalizando acesso com o Google...");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let active = true;
    let timeoutId: number | null = null;
    let subscription: { unsubscribe: () => void } | null = null;

    const finishSignIn = async () => {
      let session: Session | null = null;

      try {
        const callbackUrl = new URL(window.location.href);
        const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
        const oauthError =
          callbackUrl.searchParams.get("error_description") ||
          callbackUrl.searchParams.get("error") ||
          callbackUrl.searchParams.get("error_code") ||
          hashParams.get("error_description") ||
          hashParams.get("error") ||
          hashParams.get("error_code");

        if (oauthError) {
          setMessage(/expired|state/i.test(oauthError)
            ? "A confirmação do Google expirou antes de voltar ao sistema. Reinicie o acesso e conclua sem deixar a tela parada."
            : "Não foi possível concluir o acesso com o Google. Reinicie a tentativa para continuar.");
          return;
        }

        // Escuta primeiro o evento que confirma a sessão persistida pelo cliente
        // Supabase; getSession abaixo cobre o caso em que ela já foi restaurada.
        session = await new Promise<Session | null>((resolve) => {
          let settled = false;
          const finish = (value: Session | null) => {
            if (settled) return;
            settled = true;
            if (timeoutId !== null) {
              window.clearTimeout(timeoutId);
              timeoutId = null;
            }
            subscription?.unsubscribe();
            subscription = null;
            resolve(value);
          };

          timeoutId = window.setTimeout(() => finish(null), 45000);
          const authListener = supabase.auth.onAuthStateChange((event, nextSession) => {
            if (
              nextSession &&
              (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
            ) {
              finish(nextSession);
            }
          });
          subscription = authListener.data.subscription;

          void supabase.auth
            .getSession()
            .then(({ data, error }) => {
              if (error) {
                finish(null);
              } else if (data.session) {
                finish(data.session);
              }
            })
            .catch(() => finish(null));
        });

        if (!active) return;
        if (!session) {
          setMessage("A autenticação não concluiu a sessão. Verifique o retorno do Google e tente novamente.");
          return;
        }

        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (!active) return;
        if (factorError) {
          setMessage("A sessão foi iniciada, mas não foi possível verificar a autenticação em duas etapas.");
          return;
        }

        window.location.replace(factors.totp.length > 0 ? "/mfa" : "/dashboard");
      } catch {
        if (active) setMessage("Não foi possível concluir o acesso com o Google. Tente novamente.");
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        subscription?.unsubscribe();
        subscription = null;
      }
    };

    void finishSignIn();
    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      subscription?.unsubscribe();
      subscription = null;
    };
  }, []);

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
