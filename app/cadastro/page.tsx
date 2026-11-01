"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function CadastroBloqueadoPage() {
  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-ohel-glow p-4 py-8">
      <Card className="w-full max-w-[440px] flex flex-col items-center px-8 pt-8 pb-8 border-gray-800 text-center">
        <div className="mb-5">
          <Logo className="h-[90px] w-[180px]" />
        </div>

        <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-cyan-400" />
        </div>

        <h1 className="text-white text-lg font-bold tracking-tight">Cadastro administrativo por convite</h1>
        <p className="text-gray-400 text-sm leading-relaxed mt-3">
          O cadastro livre de novas igrejas está desativado. Para acessar o painel, o administrador precisa receber um convite do proprietário do sistema.
        </p>
        <p className="text-gray-500 text-xs leading-relaxed mt-3">
          Se você deseja apenas enviar seus dados como membro, solicite à secretaria o link de pré-cadastro ou o QR Code da sua igreja.
        </p>

        <Link href="/login" className="w-full mt-6">
          <Button type="button" variant="primary" className="w-full">Voltar para Entrar</Button>
        </Link>
      </Card>
    </main>
  );
}
