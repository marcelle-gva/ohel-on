"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type CongregacaoOpcao = { id: string; nome: string };

type Props = {
  igrejaId: string;
  igrejaNome: string;
  congregacoes: CongregacaoOpcao[];
};

export function CongregadoRegistrationForm({ igrejaId, igrejaNome, congregacoes }: Props) {
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [congregacaoId, setCongregacaoId] = useState("");
  const [conjugeNome, setConjugeNome] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");
    if (!consentimento) {
      setErro("Confirme a autorização para enviar os dados à secretaria.");
      return;
    }

    setEnviando(true);
    try {
      const response = await fetch("/api/congregados/pre-cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igrejaId,
          nome,
          dataNascimento,
          telefone,
          congregacaoId,
          conjugeNome,
          consentimento,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar seu pré-cadastro.");
      setEnviado(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar seu pré-cadastro.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <Card className="w-full border-gray-800 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
        <h2 className="mt-4 text-xl font-bold text-white">Pré-cadastro recebido!</h2>
        <p className="mt-2 text-sm leading-6 text-gray-300">
          A secretaria da {igrejaNome} vai conferir os dados e entrar em contato quando necessário.
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full border-gray-800 p-5 sm:p-7">
      <form onSubmit={enviar} className="flex flex-col gap-5" aria-busy={enviando}>
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ohel-blue/10 text-ohel-blue">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-white">Seus dados</h2>
            <p className="text-xs text-gray-400">Informe somente o necessário para a secretaria.</p>
          </div>
        </div>

        <Input
          label="Nome completo *"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          minLength={3}
          maxLength={120}
          autoComplete="name"
          required
          placeholder="Seu nome"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Data de nascimento"
            type="date"
            value={dataNascimento}
            onChange={(event) => setDataNascimento(event.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
          <Input
            label="Telefone / WhatsApp"
            type="tel"
            value={telefone}
            onChange={(event) => setTelefone(event.target.value)}
            maxLength={40}
            autoComplete="tel"
            placeholder="(00) 00000-0000"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="congregacao" className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">
            Congregação
          </label>
          <select
            id="congregacao"
            value={congregacaoId}
            onChange={(event) => setCongregacaoId(event.target.value)}
            className="input-ohel w-full rounded-lg px-4 py-3 text-sm"
          >
            <option value="">Selecione (opcional)</option>
            {congregacoes.map((congregacao) => (
              <option key={congregacao.id} value={congregacao.id}>{congregacao.nome}</option>
            ))}
          </select>
        </div>

        <Input
          label="Nome do cônjuge"
          value={conjugeNome}
          onChange={(event) => setConjugeNome(event.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder="Opcional"
        />

        <label className="flex items-start gap-3 rounded-xl border border-gray-700 bg-ohel-bg/60 p-4 text-xs leading-5 text-gray-300">
          <input
            type="checkbox"
            checked={consentimento}
            onChange={(event) => setConsentimento(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-ohel-blue"
            required
          />
          <span>Autorizo o envio destes dados para a secretaria da igreja para organização do cadastro e contato. Este formulário não cria uma conta de acesso.</span>
        </label>

        {erro && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{erro}</p>}
        <Button type="submit" variant="primary" disabled={enviando} className="w-full py-3">
          {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : "Enviar pré-cadastro"}
        </Button>
      </form>
    </Card>
  );
}
