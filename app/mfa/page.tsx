"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPostAuthenticationPath } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ShieldCheck, Loader2, LogOut } from "lucide-react";

export default function MfaChallengePage() {
  const router = useRouter();
  
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [setupError, setSetupError] = useState("");
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const getFactor = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.replace("/");
          return;
        }

        const authPath = await getPostAuthenticationPath(supabase);
        if (authPath !== "/mfa") {
          router.replace(authPath);
          return;
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        if (factors.totp.length === 0) {
          setSetupError("Sua conta exige uma verificação MFA que ainda não é compatível com esta tela. Entre em contato com o administrador.");
          return;
        }

        setFactorId(factors.totp[0].id);
      } catch (error) {
        console.error("Falha ao preparar a verificação MFA:", error);
        setSetupError("Não foi possível validar sua sessão. Tente entrar novamente.");
      } finally {
        setLoading(false);
      }
    };
    getFactor();
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code
      });
      
      if (verifyError) throw verifyError;

      const destination = await getPostAuthenticationPath(supabase);
      if (destination !== "/dashboard") {
        throw new Error("A verificação MFA ainda não foi concluída.");
      }

      router.replace(destination);
    } catch (error) {
      console.error("Falha ao verificar o fator MFA:", error);
      setModal({ isOpen: true, type: "error", title: "Código Inválido", message: "O código digitado está incorreto ou expirou. Tente novamente." });
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/"); // <-- Volta para a raiz (login)
  };

  if (loading) return <div className="w-full h-screen bg-ohel-bg flex items-center justify-center text-white">Carregando...</div>;

  return (
    <main className="w-full h-screen flex items-center justify-center bg-ohel-glow p-4">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <Card className="w-full max-w-[400px] flex flex-col items-center px-8 pt-8 pb-8 border-gray-800">
        
        <div className="w-16 h-16 bg-ohel-blue/10 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8 text-ohel-blue" />
        </div>

        <h2 className="text-white text-lg font-bold tracking-wide mb-2 text-center">
          Verificação em Duas Etapas
        </h2>
        <p className="text-gray-400 text-xs text-center mb-6">
          Abra seu aplicativo autenticador e insira o código de 6 dígitos gerado para a conta OHEL ON.
        </p>

        {setupError ? (
          <>
            <p className="text-sm text-red-400">{setupError}</p>
            <Button type="button" variant="secondary" className="w-full mt-4" onClick={handleLogout}>
              Voltar ao login
            </Button>
          </>
        ) : (
        <form onSubmit={handleVerify} className="w-full flex flex-col gap-5">
          
          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              maxLength={6}
              placeholder="000 000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              className="input-ohel w-full px-4 py-4 rounded-lg text-center text-2xl tracking-[0.5em] font-bold"
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={verifying || code.length < 6}>
            {verifying ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
            ) : (
              "Confirmar Código"
            )}
          </Button>
        </form>
        )}

        {!setupError && <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors mt-6">
          <LogOut className="w-3.5 h-3.5" /> Sair desta conta
        </button>}

      </Card>
    </main>
  );
}