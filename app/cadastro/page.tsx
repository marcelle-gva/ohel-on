"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Cadastro() {
  const router = useRouter();
  const [nomeIgreja, setNomeIgreja] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return setModal({ isOpen: true, type: "error", title: "Senhas diferentes", message: "A senha e a confirmação de senha não batem." });
    }
    
    if (password.length < 6) {
      return setModal({ isOpen: true, type: "error", title: "Senha curta", message: "A senha precisa ter no mínimo 6 caracteres." });
    }

    setLoading(true);

    try {
      // 1. Cria a Igreja (Tenant) e pega o ID gerado
      const { data: igrejaData, error: igrejaError } = await supabase
        .from('igrejas')
        .insert([{ nome: nomeIgreja }])
        .select()
        .single();

      if (igrejaError) throw new Error("Erro ao criar igreja: " + igrejaError.message);

      // 2. Cria o usuário no Auth passando os metadados (nome e igreja_id)
      // O gatilho no banco usará esses dados para criar o perfil automaticamente
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome: nomeUsuario,
            igreja_id: igrejaData.id
          }
        }
      });

      if (authError) throw new Error("Erro ao criar login: " + authError.message);

      setModal({ isOpen: true, type: "success", title: "Conta Criada", message: "Sua igreja foi cadastrada com sucesso! Redirecionando..." });
      
    } catch (err: any) {
      setModal({ isOpen: true, type: "error", title: "Erro no Cadastro", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModal({ ...modal, isOpen: false });
    if (modal.type === "success") router.push("/dashboard");
  };

  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-ohel-glow p-4 py-8">
      <FeedbackModal isOpen={modal.isOpen} onClose={handleCloseModal} type={modal.type} title={modal.title} message={modal.message} />
      
      <Card className="w-full max-w-[420px] flex flex-col items-center px-8 pt-6 pb-8 border-gray-800 relative mt-4">
        <Link href="/" className="absolute top-6 left-6 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="mb-4 mt-2">
          <Logo className="h-[90px] w-[180px]" />
        </div>
        
        <h2 className="text-white text-[15px] font-bold tracking-wide mb-6 uppercase text-center">
          Criar Conta da Igreja
        </h2>

        <form onSubmit={handleCadastro} className="w-full flex flex-col gap-3">
          <Input type="text" placeholder="Nome da Igreja" value={nomeIgreja} onChange={(e) => setNomeIgreja(e.target.value)} required className="bg-ohel-bg/50" />
          <Input type="text" placeholder="Seu Nome (Pastor/Admin)" value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} required className="bg-ohel-bg/50" />
          <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-ohel-bg/50" />
          
          <div className="relative">
            <Input 
              type={showPassword ? "text" : "password"} 
              placeholder="Senha (mínimo 6 caracteres)" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="bg-ohel-bg/50 pr-10" 
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[14px] text-gray-500 hover:text-white transition-colors">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative">
            <Input 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="Confirmar Senha" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              className="bg-ohel-bg/50 pr-10" 
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-[14px] text-gray-500 hover:text-white transition-colors">
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <Button type="submit" variant="primary" className="mt-4" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando conta...</> : "Criar Conta"}
          </Button>
        </form>

        <p className="text-xs text-gray-400 mt-5">
          Já tem conta? <Link href="/" className="text-white font-medium hover:underline">Fazer Login</Link>
        </p>
      </Card>
    </main>
  );
}