"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) throw error;

      setModal({
        isOpen: true,
        type: "success",
        title: "Verifique seu e-mail",
        message: "Se houver uma conta associada a este endereço, você receberá um link para redefinir a senha.",
      });
    } catch {
      setModal({
        isOpen: true,
        type: "error",
        title: "Não foi possível enviar",
        message: "Tente novamente em alguns instantes.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-ohel-glow p-4">
      <FeedbackModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
        message={modal.message}
      />
      <Card className="w-full max-w-[400px] flex flex-col items-center px-8 pt-6 pb-8 border-gray-800">
        <Link href="/login" className="self-start text-gray-400 hover:text-white transition-colors" aria-label="Voltar para o login">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Logo className="h-[100px] w-[200px]" />
        <h1 className="text-white text-[15px] font-bold tracking-wide mb-3 uppercase text-center">
          Recuperar senha
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          Informe seu e-mail para receber um link de redefinição.
        </p>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="bg-ohel-bg/50"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : "Enviar link"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
