"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPostAuthenticationPath } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const oauthCallbackStarted = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthCallbackPending, setOauthCallbackPending] = useState(false);
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error" | "warning", title: "", message: "" });

  useEffect(() => {
    if (oauthCallbackStarted.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const timeoutId = window.setTimeout(() => {
      oauthCallbackStarted.current = true;
      setOauthCallbackPending(true);
      void (async () => {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          router.replace(await getPostAuthenticationPath(supabase));
        } catch (error) {
          console.error("Falha ao concluir o login com Google:", error);
          window.history.replaceState(null, "", window.location.pathname);
          setModal({
            isOpen: true,
            type: "error",
            title: "Falha na autenticação",
            message: "Não foi possível concluir o login com Google. Tente novamente.",
          });
          setOauthCallbackPending(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let authenticated = false;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      authenticated = true;
      router.replace(await getPostAuthenticationPath(supabase));

    } catch (error) {
      console.error("Falha no login:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: authenticated ? "Falha na verificação" : "Falha no Login",
        message: authenticated
          ? "Não foi possível verificar o nível de segurança da conta. Tente novamente."
          : "E-mail ou senha incorretos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL('/auth/callback', window.location.origin).toString(),
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("O provedor Google não retornou uma URL de autenticação.");
      window.location.assign(data.url);
    } catch (error) {
      console.error("Falha ao iniciar o login com Google:", error);
      setModal({ isOpen: true, type: "error", title: "Erro no Google", message: "Não foi possível conectar com o Google." });
      setLoading(false);
    }
  };

  if (oauthCallbackPending) {
    return (
      <main className="w-full h-screen flex items-center justify-center bg-ohel-glow p-4">
        <Card className="w-full max-w-[400px] flex flex-col items-center px-8 py-8 border-gray-800 text-center">
          <Logo className="h-[100px] w-[200px] mb-4" />
          <p className="text-sm text-gray-400">Validando sua autenticação...</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="w-full h-screen flex items-center justify-center bg-ohel-glow p-4">
      
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <Card className="w-full max-w-[400px] flex flex-col items-center px-8 pt-6 pb-8 border-gray-800">
        
        <div className="mb-4">
          <Logo className="h-[100px] w-[200px]" />
        </div>
        
        <h2 className="text-white text-[15px] font-bold tracking-wide mb-6 uppercase text-center">
          Ohel ON — Entrar na conta
        </h2>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          
          <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-ohel-bg/50" />

          <div className="relative">
            <Input type={showPassword ? "text" : "password"} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-ohel-bg/50 pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-[14px] text-gray-500 hover:text-white transition-colors cursor-pointer">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <Button type="submit" variant="primary" className="mt-2 w-full" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</> : "Entrar"}
          </Button>
        </form>

        <a href="#" className="text-xs text-ohel-blue hover:text-blue-400 mt-4 transition-colors">
          Esqueci minha senha
        </a>

        <div className="w-full flex items-center gap-4 my-6">
          <div className="h-px bg-gradient-to-r from-transparent to-gray-700 flex-1"></div>
          <span className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">ou</span>
          <div className="h-px bg-gradient-to-l from-transparent to-gray-700 flex-1"></div>
        </div>

        <Button type="button" variant="secondary" className="w-full text-sm flex items-center justify-center gap-2" onClick={handleGoogleLogin} disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Conectando ao Google...</>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar com Google
            </>
          )}
        </Button>

        <p className="text-xs text-gray-400 mt-5">
          Não tem conta? <Link href="/cadastro" className="text-white font-medium hover:underline">Cadastre-se</Link>
        </p>

      </Card>
    </main>
  );
}