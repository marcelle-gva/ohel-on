"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Loader2, Mail, UserRound } from "lucide-react";

export default function LoginMembroPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const enviarLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErro("");
    setMensagem("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/membro/callback`,
        },
      });
      if (error) throw error;
      setMensagem("Enviamos um link seguro para seu e-mail. Abra o link no mesmo dispositivo para entrar na Área do Membro.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar o link de acesso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-ohel-glow p-4">
      <Card className="w-full max-w-[420px] flex flex-col items-center px-8 pt-7 pb-8 border-gray-800">
        <Logo className="h-[90px] w-[180px] mb-4" />
        <div className="w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3"><UserRound className="w-5 h-5 text-emerald-300" /></div>
        <h1 className="text-white text-lg font-bold text-center">Área do Membro</h1>
        <p className="text-gray-400 text-xs text-center leading-relaxed mt-2 mb-5">Informe o mesmo e-mail usado no seu cadastro. Enviaremos um link seguro, sem senha.</p>

        <form onSubmit={enviarLink} className="w-full flex flex-col gap-4">
          <Input label="E-mail cadastrado" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required className="bg-ohel-bg/50" />
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando link...</> : <><Mail className="w-4 h-4 mr-2" /> Enviar link de acesso</>}
          </Button>
        </form>

        {mensagem && <p className="w-full mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200">{mensagem}</p>}
        {erro && <p className="w-full mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-200">{erro}</p>}

        <Link href="/login" className="text-xs text-ohel-blue hover:text-blue-400 mt-5">Voltar para Área Administrativa</Link>
      </Card>
    </main>
  );
}
