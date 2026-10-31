"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, CheckCheck, Loader2, MessageCircle, Send, Users } from "lucide-react";

type SendResult = {
  error?: string;
  count?: number;
  exceedsLimit?: boolean;
  maxRecipients?: number;
  total?: number;
  aceitosPelaMeta?: number;
  falhas?: number;
};

export default function NovaComunicacaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [exceedsLimit, setExceedsLimit] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });
  const [formData, setFormData] = useState({
    templateName: "",
    languageCode: "pt_BR",
    parameterText: "",
  });

  useEffect(() => {
    const loadRecipients = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setModal({ isOpen: true, type: "error", title: "Sessão encerrada", message: "Entre novamente para enviar uma comunicação." });
        return;
      }

      const response = await fetch("/api/whatsapp/send", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json() as SendResult;
      if (!response.ok) {
        setModal({ isOpen: true, type: "error", title: "Não foi possível carregar", message: result.error || "Verifique suas permissões e tente novamente." });
        return;
      }

      setRecipientCount(result.count ?? 0);
      setExceedsLimit(result.exceedsLimit === true);
    };

    void loadRecipients();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!consentConfirmed) {
      setModal({ isOpen: true, type: "error", title: "Confirme o consentimento", message: "Envie somente para pessoas que autorizaram receber mensagens da igreja." });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sua sessão expirou. Entre novamente.");

      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          templateName: formData.templateName,
          languageCode: formData.languageCode,
          parameterText: formData.parameterText,
          confirmConsent: consentConfirmed,
        }),
      });
      const result = await response.json() as SendResult;
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a comunicação.");

      const accepted = result.aceitosPelaMeta ?? 0;
      const failed = result.falhas ?? 0;
      setModal({
        isOpen: true,
        type: accepted > 0 ? "success" : "error",
        title: accepted > 0 ? "Envio processado" : "Nenhuma mensagem aceita",
        message: `A Meta aceitou ${accepted} de ${result.total ?? 0} mensagens${failed ? `; ${failed} falharam` : ""}. A entrega final será atualizada pelo webhook.`,
      });
    } catch (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Erro no envio",
        message: error instanceof Error ? error.message : "Não foi possível enviar a comunicação.",
      });
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModal((previous) => ({ ...previous, isOpen: false }));
    if (modal.type === "success") router.push("/gabinete/comunicacoes");
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={closeModal} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-3">
        <Link href="/gabinete/comunicacoes" className="text-gray-400 transition-colors hover:text-white" aria-label="Voltar às comunicações">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Nova Comunicação WhatsApp</h1>
          <p className="mt-0.5 text-xs text-gray-400">Envie um modelo aprovado pela Meta aos membros que autorizaram o contato.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-gray-800 bg-ohel-surface p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-sm text-gray-300">
              <div className="flex items-center gap-2 font-semibold text-green-400">
                <Users className="h-4 w-4" />
                {recipientCount === null ? "Consultando contatos..." : `${recipientCount} contatos autorizados`}
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-400">
                Considera somente membros ativos da sua igreja com telefone válido e consentimento WhatsApp registrado.
                {exceedsLimit ? " O limite por envio é 250." : ""}
              </p>
            </div>

            <label className="flex flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ohel-silver">
              Nome exato do modelo aprovado na Meta *
              <input
                name="templateName"
                required
                pattern="[A-Za-z0-9_]+"
                maxLength={512}
                value={formData.templateName}
                onChange={(event) => setFormData((previous) => ({ ...previous, templateName: event.target.value }))}
                placeholder="exemplo: aviso_culto"
                className="input-ohel w-full rounded-md px-3 py-2.5 text-xs normal-case tracking-normal"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ohel-silver">
              Idioma cadastrado no modelo *
              <input
                name="languageCode"
                required
                pattern="[a-z]{2}_[A-Z]{2}"
                value={formData.languageCode}
                onChange={(event) => setFormData((previous) => ({ ...previous, languageCode: event.target.value }))}
                placeholder="pt_BR"
                className="input-ohel w-full rounded-md px-3 py-2.5 text-xs normal-case tracking-normal"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ohel-silver">
              Variável 1 do corpo (se o modelo tiver {"{{1}}"})
              <textarea
                name="parameterText"
                maxLength={1024}
                value={formData.parameterText}
                onChange={(event) => setFormData((previous) => ({ ...previous, parameterText: event.target.value }))}
                placeholder="Texto que ocupará a variável {{1}} do modelo"
                className="input-ohel min-h-24 w-full resize-y rounded-md px-3 py-2 text-xs normal-case tracking-normal"
              />
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-gray-700 bg-ohel-bg p-3 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(event) => setConsentConfirmed(event.target.checked)}
                className="mt-0.5 accent-green-500"
              />
              <span>Confirmo que os destinatários deram consentimento e que este modelo está aprovado na Meta.</span>
            </label>

            <Button
              type="submit"
              variant="primary"
              disabled={loading || recipientCount === null || recipientCount === 0 || exceedsLimit || !consentConfirmed}
              className="w-full bg-green-500 py-2.5 text-xs text-white shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:bg-green-600"
            >
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                : <><Send className="mr-2 h-4 w-4" /> Enviar pelo WhatsApp</>}
            </Button>
          </form>
        </Card>

        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-gray-800 bg-[#0b141a] p-6">
          <div className="absolute inset-0 opacity-10 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover" />
          <div className="relative z-10 w-full max-w-[320px] overflow-hidden rounded-2xl border-4 border-gray-900 bg-[#efeae2] shadow-2xl">
            <div className="flex items-center gap-3 bg-[#075e54] p-3 text-white">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-300">
                <MessageCircle className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold">{formData.templateName || "Modelo aprovado"}</h2>
                <p className="text-[10px] text-green-100">{formData.languageCode}</p>
              </div>
            </div>
            <div className="flex min-h-[260px] flex-col justify-end p-4">
              <div className="max-w-[90%] self-end rounded-lg rounded-tr-none bg-white p-3 text-xs text-gray-800 shadow-sm">
                {formData.parameterText || "A prévia do texto depende do conteúdo do modelo aprovado na Meta."}
                <div className="mt-2 flex items-center justify-end gap-1 text-[9px] text-gray-400">
                  <span><CheckCheck className="inline h-3 w-3 text-blue-500" /> A entrega será confirmada pelo WhatsApp</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
