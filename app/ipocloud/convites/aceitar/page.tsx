"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";

export default function AceitarConviteIpoCloudPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [mensagem, setMensagem] = useState("Validando seu convite...");

  useEffect(() => {
    const aceitar = async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) { setStatus("error"); setMensagem("Convite sem token."); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus("error"); setMensagem("Abra o convite pelo e-mail e conclua o cadastro/login antes de aceitar."); return; }
      const response = await fetch("/api/ipocloud/convites/aceitar", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setStatus("error"); setMensagem(result.error || "Não foi possível aceitar o convite."); return; }
      setStatus("success");
      setMensagem("Seu acesso de administrador da organização foi ativado.");
    };
    void aceitar();
  }, [router]);

  return <main className="min-h-screen bg-ohel-glow flex items-center justify-center p-4"><Card className="w-full max-w-md text-center border-gray-800"><Logo className="mx-auto mb-5 h-16 w-32" />{status === "loading" && <Loader2 className="mx-auto h-9 w-9 animate-spin text-ohel-blue" />}{status === "success" && <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />}{status === "error" && <ShieldCheck className="mx-auto h-10 w-10 text-red-300" />}<h1 className="mt-4 text-lg font-bold text-white">Convite IPO CLOUD</h1><p className="mt-2 text-sm leading-relaxed text-gray-400">{mensagem}</p>{status === "success" && <button onClick={() => router.push("/dashboard")} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ohel-blue px-4 py-2 text-sm font-semibold text-white"><LogIn className="h-4 w-4" /> Entrar na organização</button>}{status === "error" && <button onClick={() => router.push("/login")} className="mt-6 text-sm text-ohel-blue hover:underline">Ir para o login</button>}</Card></main>;
}
