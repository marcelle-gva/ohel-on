"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";

export default function AguardandoAprovacaoPage() {
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Falha ao sair da conta:", error);
      return;
    }
    router.replace("/");
  };

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-ohel-glow p-4">
      <Card className="w-full max-w-[420px] flex flex-col items-center px-8 py-8 border-gray-800 text-center">
        <Logo className="h-[100px] w-[200px] mb-4" />
        <h1 className="text-white text-lg font-bold">Aguardando aprovação</h1>
        <p className="text-sm text-gray-400 mt-3">
          Sua conta Google foi autenticada, mas ainda não está vinculada a um pré-cadastro aprovado.
          Confirme que informou o mesmo e-mail no cadastro pelo QR Code e aguarde a aprovação de um administrador.
        </p>
        <Button type="button" variant="secondary" className="w-full mt-6" onClick={handleLogout}>
          Sair da conta
        </Button>
      </Card>
    </main>
  );
}
