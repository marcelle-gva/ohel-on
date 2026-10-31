"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setModal({ isOpen: true, type: "error", title: "Senhas diferentes", message: "A senha e a confirmação não coincidem." });
      return;
    }

    if (password.length < 6) {
      setModal({ isOpen: true, type: "error", title: "Senha curta", message: "A senha precisa ter no mínimo 6 caracteres." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setModal({ isOpen: true, type: "success", title: "Senha atualizada", message: "Sua senha foi redefinida. Você já pode entrar com a nova senha." });
    } catch {
      setModal({ isOpen: true, type: "error", title: "Link inválido ou expirado", message: "Solicite um novo link de redefinição e tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/login");
  };

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-ohel-glow p-4">
      <FeedbackModal
        isOpen={modal.isOpen}
        onClose={handleCloseModal}
        type={modal.type}
        title={modal.title}
        message={modal.message}
      />
      <Card className="w-full max-w-[400px] flex flex-col items-center px-8 pt-6 pb-8 border-gray-800">
        <Link href="/recuperar-senha" className="self-start text-gray-400 hover:text-white transition-colors" aria-label="Solicitar outro link">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Logo className="h-[100px] w-[200px]" />
        <h1 className="text-white text-[15px] font-bold tracking-wide mb-6 uppercase text-center">
          Definir nova senha
        </h1>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div className="relative">
            <Input
              label="Nova senha"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              className="bg-ohel-bg/50 pr-10"
            />
            <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[38px] text-gray-500 hover:text-white transition-colors">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="Confirmar nova senha"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              className="bg-ohel-bg/50 pr-10"
            />
            <button type="button" aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"} onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-[38px] text-gray-500 hover:text-white transition-colors">
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Atualizando...</> : "Atualizar senha"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
