"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, Loader2, MessageCircle, Save, ShieldCheck, Webhook } from "lucide-react";

type Configuration = {
  configured: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string;
  updatedAt: string | null;
  encryptionKeyConfigured: boolean;
  webhookUrl: string;
  webhookConfigured: boolean;
};

export default function WhatsAppConfigurationPage() {
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getAuthorizationHeader = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
    return { Authorization: `Bearer ${data.session.access_token}` };
  }, []);

  const loadConfiguration = useCallback(async () => {
    const headers = await getAuthorizationHeader();
    const response = await fetch("/api/whatsapp/configuration", { headers, cache: "no-store" });
    const result = await response.json() as Configuration & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar a configuração.");
    setConfiguration(result);
    setPhoneNumberId(result.phoneNumberId);
    setBusinessAccountId(result.businessAccountId);
    setDisplayPhoneNumber(result.displayPhoneNumber);
  }, [getAuthorizationHeader]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadConfiguration()
        .catch(loadError => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Falha ao carregar configuração.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadConfiguration]);

  const saveConfiguration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const headers = await getAuthorizationHeader();
      const response = await fetch("/api/whatsapp/configuration", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, businessAccountId, displayPhoneNumber, accessToken }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar a configuração.");
      setAccessToken("");
      await loadConfiguration();
      setNotice("Instância salva com segurança. O token não é exibido novamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError("");
    setNotice("");
    try {
      const headers = await getAuthorizationHeader();
      const response = await fetch("/api/whatsapp/configuration", { method: "POST", headers });
      const result = await response.json() as { error?: string; displayPhoneNumber?: string; verifiedName?: string };
      if (!response.ok) throw new Error(result.error ?? "A Meta não confirmou a conexão.");
      setNotice(`Conexão válida${result.verifiedName ? `: ${result.verifiedName}` : ""}${result.displayPhoneNumber ? ` · ${result.displayPhoneNumber}` : ""}.`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Não foi possível testar a instância.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-10">
      <header className="flex items-center gap-4">
        <span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300"><MessageCircle className="h-6 w-6" /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Integrações</p><h1 className="text-2xl font-bold text-white">WhatsApp Cloud API</h1><p className="mt-1 text-sm text-gray-400">Configure a instância oficial da Meta para esta igreja.</p></div>
      </header>
      {error && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
        <>
          <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="font-semibold text-white">Credenciais da instância</h2><p className="mt-1 text-xs text-gray-500">O token fica criptografado no banco e nunca é enviado ao navegador.</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${configuration?.configured ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{configuration?.configured ? "Configurada" : "Pendente"}</span></div>
            <form onSubmit={saveConfiguration} className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Phone Number ID<input required inputMode="numeric" value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">WhatsApp Business Account ID<input required inputMode="numeric" value={businessAccountId} onChange={event => setBusinessAccountId(event.target.value)} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Telefone de exibição<input value={displayPhoneNumber} onChange={event => setDisplayPhoneNumber(event.target.value)} placeholder="+55 ..." className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <label className="flex flex-col gap-1.5 text-xs text-gray-400">Token de acesso da Meta<input required={!configuration?.configured} type="password" autoComplete="new-password" value={accessToken} onChange={event => setAccessToken(event.target.value)} placeholder={configuration?.configured ? "Já salvo; informe apenas para substituir" : "Cole o token de acesso permanente"} className="input-ohel rounded-lg px-3 py-2.5 text-sm text-white" /></label>
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 border-t border-gray-800 pt-4">
                <button type="button" onClick={() => void testConnection()} disabled={!configuration?.configured || testing} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-200 hover:border-gray-500 disabled:opacity-50">{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Testar conexão</button>
                <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar instância</button>
              </div>
            </form>
          </Card>

          <Card className="border-gray-800 bg-gray-900/70 p-5 sm:p-6">
            <div className="flex items-start gap-3"><Webhook className="mt-0.5 h-5 w-5 text-sky-300" /><div className="min-w-0 flex-1"><h2 className="font-semibold text-white">Retorno de entrega (webhook)</h2><p className="mt-1 text-xs leading-5 text-gray-400">Na configuração de Webhooks da Meta, informe a URL abaixo e assine o campo de mensagens. Sem webhook, o sistema só consegue confirmar que a Meta aceitou a solicitação — não que chegou ao destinatário.</p><input readOnly value={configuration?.webhookUrl ?? ""} className="mt-3 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-300" /><p className="mt-2 text-xs text-gray-500">Configure no ambiente Production da Vercel: <code>WHATSAPP_WEBHOOK_VERIFY_TOKEN</code>, <code>META_APP_SECRET</code> e <code>OHEL_INTEGRATION_ENCRYPTION_KEY</code>.</p></div></div>
            <div className="mt-4 flex items-center gap-2 border-t border-gray-800 pt-4 text-xs"><ShieldCheck className={`h-4 w-4 ${configuration?.encryptionKeyConfigured ? "text-emerald-300" : "text-amber-300"}`} /><span className="text-gray-300">{configuration?.encryptionKeyConfigured ? "Chave de criptografia configurada" : "Falta configurar OHEL_INTEGRATION_ENCRYPTION_KEY"}</span><span className={`ml-auto rounded-full px-2 py-1 ${configuration?.webhookConfigured ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{configuration?.webhookConfigured ? "Webhook pronto" : "Webhook incompleto"}</span></div>
          </Card>

          <p className="text-xs leading-5 text-gray-500">A Meta exige consentimento do destinatário e, fora da janela de atendimento de 24 horas, um modelo previamente aprovado. O painel permite enviar texto somente dentro da janela e modelos aprovados fora dela.</p>
        </>
      )}
    </div>
  );
}
