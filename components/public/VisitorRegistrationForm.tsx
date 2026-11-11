"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

export function VisitorRegistrationForm({ igrejaId, igrejaNome }: { igrejaId: string; igrejaNome: string }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const response = await fetch("/api/visitantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igrejaId, nome, telefone, observacao }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar seu cadastro.");
      setEnviado(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar seu cadastro.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
        <h2 className="mt-4 text-xl font-bold text-white">Seja bem-vindo!</h2>
        <p className="mt-2 text-sm leading-6 text-gray-300">Seu cadastro foi enviado para a equipe da {igrejaNome}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-gray-800 bg-ohel-surface p-5 shadow-2xl sm:p-7">
      <div className="mb-6 flex items-center gap-3 border-b border-gray-800 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300"><UserPlus className="h-5 w-5" /></div>
        <div><h2 className="font-bold text-white">Conte-nos quem você é</h2><p className="text-xs text-gray-400">Preencha seus dados para a equipe receber sua visita.</p></div>
      </div>
      <div className="flex flex-col gap-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">Nome completo *<input required minLength={2} value={nome} onChange={(event) => setNome(event.target.value)} className="input-ohel mt-2 w-full rounded-lg px-4 py-3 text-sm normal-case tracking-normal" placeholder="Seu nome" /></label>
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">Telefone / WhatsApp<input value={telefone} onChange={(event) => setTelefone(event.target.value)} className="input-ohel mt-2 w-full rounded-lg px-4 py-3 text-sm normal-case tracking-normal" placeholder="(00) 00000-0000" /></label>
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-300">Observação<textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} className="input-ohel mt-2 min-h-24 w-full resize-y rounded-lg px-4 py-3 text-sm normal-case tracking-normal" placeholder="Como podemos acolher você?" /></label>
      </div>
      {erro && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{erro}</p>}
      <button type="submit" disabled={enviando} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-ohel-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-60">{enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : "Enviar cadastro"}</button>
    </form>
  );
}
