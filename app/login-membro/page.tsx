"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Loader2, LockKeyhole, UserRound } from "lucide-react";

export default function LoginMembroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const entrar = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErro("");
    setMensagem("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      const response = await fetch("/api/membros/situacao", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      const situacao = await response.json() as { status?: string; aprovado?: boolean; error?: string };
      if (!response.ok) throw new Error(situacao.error || "Seu usuário ainda não está vinculado a um membro.");
      if (!situacao.aprovado) {
        await supabase.auth.signOut();
        setMensagem("Seu cadastro está aguardando a aprovação do administrador da igreja. Você receberá uma confirmação quando o acesso for liberado.");
        return;
      }
      router.push("/area-membro");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível entrar na Área do Membro.");
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
        <p className="text-gray-400 text-xs text-center leading-relaxed mt-2 mb-5">Use o e-mail e a senha criados no pré-cadastro. O acesso só será liberado após a aprovação da igreja.</p>

        <form onSubmit={entrar} className="w-full flex flex-col gap-4">
          <Input label="E-mail cadastrado" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required className="bg-ohel-bg/50" />
          <Input label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required className="bg-ohel-bg/50" />
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando acesso...</> : <><LockKeyhole className="w-4 h-4 mr-2" /> Entrar na Área do Membro</>}
          </Button>
        </form>

        {mensagem && <p className="w-full mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200">{mensagem}</p>}
        {erro && <p className="w-full mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-200">{erro}</p>}

        <Link href="/login" className="text-xs text-ohel-blue hover:text-blue-400 mt-5">Voltar para Área Administrativa</Link>
      </Card>
    </main>
  );
}
