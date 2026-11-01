"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function AceitarConvitePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Validando seu convite...");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setMessage("Abra este link pelo e-mail de convite da Meta/Supabase.");
      else { setMessage(""); setLoading(false); }
    });
  }, []);

  const accept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setMessage("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setMessage("As senhas não conferem.");
    setSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Convite inválido.");
      router.push("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível aceitar o convite.");
      setSaving(false);
    }
  };

  return <main className="min-h-screen flex items-center justify-center bg-ohel-glow p-4"><Card className="w-full max-w-md"><div className="flex items-center gap-3 mb-5"><ShieldCheck className="w-7 h-7 text-cyan-400" /><div><h1 className="text-white text-xl font-bold">Aceitar convite</h1><p className="text-gray-400 text-xs">Administrador Ohel ON</p></div></div>{loading ? <div className="text-gray-300 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" /> {message}</div> : <form onSubmit={accept} className="flex flex-col gap-4"><p className="text-gray-300 text-sm">Defina uma senha para concluir seu acesso administrativo.</p><Input label="Nova senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /><Input label="Confirmar senha" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />{message && <p className="text-red-400 text-sm">{message}</p>}<Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Concluir cadastro"}</Button></form>}</Card></main>;
}
