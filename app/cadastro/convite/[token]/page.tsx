"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPostAuthenticationPath } from "@/lib/auth";

export default function ChurchAdminInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successDestination, setSuccessDestination] = useState("/");
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setModal({ isOpen: true, type: "error", title: "Senha curta", message: "Use uma senha com pelo menos 8 caracteres." });
      return;
    }
    if (password !== confirmPassword) {
      setModal({ isOpen: true, type: "error", title: "Senhas diferentes", message: "A senha e a confirmação não correspondem." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { nome: name.trim(), church_signup_token: token } },
      });
      if (error) throw error;
      if (data.session) {
        setSuccessDestination(await getPostAuthenticationPath(supabase));
        setModal({ isOpen: true, type: "success", title: "Acesso criado", message: "Sua conta de administrador foi criada. Redirecionando…" });
      } else {
        setSuccessDestination("/");
        setModal({ isOpen: true, type: "success", title: "Confirme seu e-mail", message: "Enviamos uma mensagem de confirmação. Use o e-mail indicado no convite e depois entre no sistema." });
      }
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Não foi possível aceitar o convite", message: error instanceof Error ? error.message : "Verifique o link e o e-mail informado." });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModal(current => ({ ...current, isOpen: false }));
    if (modal.type === "success") router.push(successDestination);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ohel-glow p-4 py-8">
      <FeedbackModal isOpen={modal.isOpen} onClose={closeModal} type={modal.type} title={modal.title} message={modal.message} />
      <Card className="relative mt-4 flex w-full max-w-[440px] flex-col items-center border-gray-800 px-8 pb-8 pt-6">
        <Link href="/" className="absolute left-6 top-6 text-gray-400 transition-colors hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="mb-4 mt-2"><Logo className="h-[90px] w-[180px]" /></div>
        <h1 className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-white">Convite de administrador</h1>
        <p className="mb-6 text-center text-xs leading-5 text-gray-400">Crie sua conta usando exatamente o e-mail que recebeu o convite. O link é de uso único e expira após sete dias.</p>
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
          <Input required placeholder="Seu nome" value={name} onChange={event => setName(event.target.value)} className="bg-ohel-bg/50" />
          <Input required type="email" placeholder="E-mail do convite" value={email} onChange={event => setEmail(event.target.value)} className="bg-ohel-bg/50" />
          <div className="relative">
            <Input required minLength={8} type={showPassword ? "text" : "password"} placeholder="Senha (mínimo 8 caracteres)" value={password} onChange={event => setPassword(event.target.value)} className="bg-ohel-bg/50 pr-10" />
            <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-[14px] text-gray-500 hover:text-white">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </div>
          <Input required minLength={8} type="password" placeholder="Confirme sua senha" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="bg-ohel-bg/50" />
          <Button type="submit" variant="primary" className="mt-3" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando convite…</> : "Criar conta de administrador"}</Button>
        </form>
      </Card>
    </main>
  );
}
