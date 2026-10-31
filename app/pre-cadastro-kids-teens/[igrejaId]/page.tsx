"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Baby, CheckCircle, Heart, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/brand/Logo";

const initialForm = {
  nome: "",
  data_nascimento: "",
  nome_responsavel: "",
  parentesco_responsavel: "",
  telefone_responsavel: "",
  pessoas_autorizadas: "",
  informacoes_saude: "",
};

function calculateAge(birthDate: string) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default function PreCadastroKidsTeensPage() {
  const params = useParams<{ igrejaId: string }>();
  const churchId = params.igrejaId;
  const [form, setForm] = useState(initialForm);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState({
    isOpen: false,
    type: "error" as "success" | "error" | "warning",
    title: "",
    message: "",
  });

  const age = useMemo(() => calculateAge(form.data_nascimento), [form.data_nascimento]);
  const groupName = age === null ? "" : age <= 11 ? "Kids" : age <= 17 ? "Teens" : "Fora da faixa";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!churchId) {
      setFeedback({ isOpen: true, type: "error", title: "Link inválido", message: "O link de pré-cadastro não identifica uma igreja." });
      return;
    }

    if (age === null || age < 0 || age > 17) {
      setFeedback({ isOpen: true, type: "warning", title: "Faixa etária não atendida", message: "Este formulário é para Kids de até 11 anos e Teens de 12 a 17 anos." });
      return;
    }

    if (!consentAccepted) {
      setFeedback({ isOpen: true, type: "warning", title: "Consentimento necessário", message: "O responsável legal precisa autorizar o uso dos dados para concluir o pré-cadastro." });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from("kids_teens_pre_cadastros").insert([{
        igreja_id: churchId,
        nome: form.nome.trim(),
        data_nascimento: form.data_nascimento,
        nome_responsavel: form.nome_responsavel.trim(),
        parentesco_responsavel: form.parentesco_responsavel.trim(),
        telefone_responsavel: form.telefone_responsavel.trim(),
        pessoas_autorizadas: form.pessoas_autorizadas.trim() || null,
        informacoes_saude: form.informacoes_saude.trim() || null,
        consentimento_responsavel: consentAccepted,
      }]);

      if (error) throw error;
      setSubmitted(true);
      setForm(initialForm);
      setConsentAccepted(false);
    } catch (error) {
      console.error("Erro ao enviar pré-cadastro Kids/Teens:", error);
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Não foi possível enviar",
        message: "Confira sua conexão ou tente novamente. Se o problema continuar, procure a equipe da igreja.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-ohel-glow px-4 py-8 text-white">
      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback((current) => ({ ...current, isOpen: false }))}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
      />

      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <Logo className="mb-3 h-20 w-40" />

        {submitted ? (
          <Card className="w-full border-gray-800 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-400">
              <CheckCircle className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-bold text-white">Pré-cadastro recebido!</h1>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              A equipe Kids & Teens da igreja vai revisar as informações e entrar em contato com o responsável.
            </p>
          </Card>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/20 bg-pink-400/10 px-3 py-1.5 text-xs font-medium text-pink-200">
                <Baby className="h-4 w-4" /> Igreja Kids & Teens
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Pré-cadastro</h1>
              <p className="mt-2 text-sm text-gray-400">
                Kids: até 11 anos. Teens: de 12 a 17 anos. O cadastro deve ser preenchido por um responsável legal.
              </p>
            </div>

            <Card className="w-full border-gray-800 p-5 sm:p-7">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <section className="space-y-4">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-pink-200">
                    <Baby className="h-4 w-4" /> Dados do menor
                  </h2>
                  <Input
                    label="Nome completo *"
                    value={form.nome}
                    onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                    required
                    maxLength={150}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                    <Input
                      label="Data de nascimento *"
                      type="date"
                      value={form.data_nascimento}
                      onChange={(event) => setForm((current) => ({ ...current, data_nascimento: event.target.value }))}
                      required
                    />
                    <div className="rounded-lg border border-gray-700 bg-ohel-bg px-4 py-3 text-sm text-gray-300" aria-live="polite">
                      Faixa: <span className="font-semibold text-white">{groupName || "informe a data"}</span>
                      {age !== null && age >= 0 && age <= 17 ? ` (${age} anos)` : ""}
                    </div>
                  </div>
                </section>

                <section className="space-y-4 border-t border-gray-800 pt-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-blue-200">
                    <ShieldCheck className="h-4 w-4" /> Responsável legal
                  </h2>
                  <Input
                    label="Nome completo do responsável *"
                    value={form.nome_responsavel}
                    onChange={(event) => setForm((current) => ({ ...current, nome_responsavel: event.target.value }))}
                    required
                    maxLength={150}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Parentesco *"
                      placeholder="Ex.: mãe, pai, tutor"
                      value={form.parentesco_responsavel}
                      onChange={(event) => setForm((current) => ({ ...current, parentesco_responsavel: event.target.value }))}
                      required
                      maxLength={80}
                    />
                    <Input
                      label="WhatsApp do responsável *"
                      type="tel"
                      autoComplete="tel"
                      placeholder="(00) 00000-0000"
                      value={form.telefone_responsavel}
                      onChange={(event) => setForm((current) => ({ ...current, telefone_responsavel: event.target.value }))}
                      required
                      maxLength={30}
                    />
                  </div>
                </section>

                <section className="space-y-4 border-t border-gray-800 pt-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-100">
                    <Heart className="h-4 w-4" /> Cuidado e segurança
                  </h2>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">
                      Pessoas autorizadas a retirar
                    </label>
                    <textarea
                      value={form.pessoas_autorizadas}
                      onChange={(event) => setForm((current) => ({ ...current, pessoas_autorizadas: event.target.value }))}
                      maxLength={1000}
                      rows={3}
                      placeholder="Informe nomes completos e, se necessário, o parentesco. Opcional."
                      className="input-ohel w-full resize-y rounded-lg px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ohel-silver">
                      Alergias, medicamentos ou cuidados importantes
                    </label>
                    <textarea
                      value={form.informacoes_saude}
                      onChange={(event) => setForm((current) => ({ ...current, informacoes_saude: event.target.value }))}
                      maxLength={2000}
                      rows={3}
                      placeholder="Informe apenas o necessário para o cuidado durante as atividades. Opcional."
                      className="input-ohel w-full resize-y rounded-lg px-4 py-3 text-sm"
                    />
                    <p className="text-[11px] leading-5 text-gray-500">
                      As informações de saúde são opcionais e devem ser limitadas ao que a equipe precisa saber para cuidar do menor.
                    </p>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-700 bg-ohel-bg/60 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(event) => setConsentAccepted(event.target.checked)}
                      required
                      className="mt-1 h-4 w-4 accent-blue-500"
                    />
                    <span className="text-xs leading-5 text-gray-300">
                      Declaro ser responsável legal pelo menor e autorizo o envio e o uso destas informações
                      pela igreja para organização das atividades Kids & Teens, contato com a família e
                      cuidados necessários durante as atividades. Confirmo que os dados informados são corretos.
                    </span>
                  </label>
                </section>

                <Button type="submit" variant="primary" disabled={saving || age === null || age < 0 || age > 17} className="w-full py-3">
                  {saving ? "Enviando pré-cadastro..." : "Enviar pré-cadastro"}
                </Button>
              </form>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
