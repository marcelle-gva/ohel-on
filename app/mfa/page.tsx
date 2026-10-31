"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";
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
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    const getFactor = async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors && factors.totp.length > 0) {
        setFactorId(factors.totp[0].id);
      } else {
        router.push("/dashboard");
      }
      setLoading(false);
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

      router.push("/dashboard");
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Código Inválido", message: "O código digitado está incorreto ou expirou. Tente novamente." });
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
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

        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors mt-6">
          <LogOut className="w-3.5 h-3.5" /> Sair desta conta
        </button>

      </Card>
    </main>
  );
}