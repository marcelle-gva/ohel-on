"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FeedbackModal } from "@/components/ui/FeedbackModal";

interface BillingSubscription {
  planCode: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  lastInvoiceStatus: string | null;
}

interface BillingResponse {
  church: { id: string; name: string };
  plan: { name: string; amount: number; currency: string; interval: string };
  subscription: BillingSubscription | null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value));
}

function formatMoney(amountInCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amountInCents / 100);
}

function statusLabel(subscription: BillingSubscription | null) {
  if (!subscription) return "Ainda não assinante";
  if (subscription.cancelAtPeriodEnd) return "Cancelamento agendado";
  const labels: Record<string, string> = {
    active: "Ativa",
    trialing: "Período de teste",
    past_due: "Pagamento pendente",
    unpaid: "Pagamento não confirmado",
    incomplete: "Aguardando pagamento",
    incomplete_expired: "Checkout expirado",
    canceled: "Encerrada",
    paused: "Pausada",
    pending: "Aguardando início",
  };
  return labels[subscription.status] || subscription.status;
}

function statusClass(subscription: BillingSubscription | null) {
  if (!subscription || ["canceled", "incomplete_expired"].includes(subscription.status)) return "text-gray-400";
  if (subscription.cancelAtPeriodEnd || ["past_due", "unpaid", "incomplete"].includes(subscription.status)) return "text-amber-400";
  return "text-emerald-400";
}

export default function FaturamentoPage() {
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"checkout" | "cancel" | "resume" | "portal" | null>(null);
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
  };

  const loadBilling = async () => {
    const headers = await authHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }
    const response = await fetch("/api/billing", { headers, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setModal({ isOpen: true, type: "error", title: "Faturamento", message: data.error || "Não foi possível carregar os dados." });
    } else {
      setBilling(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBilling();
      const checkoutState = new URLSearchParams(window.location.search).get("checkout");
      if (checkoutState === "success") {
        setModal({ isOpen: true, type: "success", title: "Checkout concluído", message: "Recebemos seu cadastro. O status será atualizado assim que a Stripe confirmar a assinatura." });
        window.history.replaceState({}, "", "/configuracoes/faturamento");
      } else if (checkoutState === "cancelled") {
        setModal({ isOpen: true, type: "error", title: "Checkout cancelado", message: "Nenhuma cobrança foi criada. Você pode iniciar novamente quando quiser." });
        window.history.replaceState({}, "", "/configuracoes/faturamento");
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // A carga inicial é intencionalmente executada uma vez por montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscription = billing?.subscription || null;
  const isActive = Boolean(subscription && ACTIVE_STATUSES.has(subscription.status) && !subscription.cancelAtPeriodEnd);
  const canResume = Boolean(subscription?.cancelAtPeriodEnd && subscription.status !== "canceled");
  const isPendingPayment = Boolean(subscription && ["past_due", "unpaid", "incomplete"].includes(subscription.status));
  const planAmount = billing?.plan.amount || 8000;

  const startCheckout = async () => {
    setSaving("checkout");
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Faça login novamente.");
      const response = await fetch("/api/billing", { method: "POST", headers, body: "{}" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a assinatura.");
      window.location.assign(data.url);
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Assinatura", message: error instanceof Error ? error.message : "Erro inesperado." });
      setSaving(null);
    }
  };

  const changeCancellation = async (action: "cancel" | "resume") => {
    if (action === "cancel" && !window.confirm("Cancelar a renovação da assinatura? O acesso continuará até o fim do período já pago.")) return;
    setSaving(action);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Faça login novamente.");
      const response = await fetch("/api/billing/cancel", { method: "POST", headers, body: JSON.stringify({ action }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar a assinatura.");
      setBilling((current) => current ? { ...current, subscription: data.subscription } : current);
      setModal({ isOpen: true, type: "success", title: action === "cancel" ? "Cancelamento agendado" : "Assinatura reativada", message: data.message });
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Faturamento", message: error instanceof Error ? error.message : "Erro inesperado." });
    } finally {
      setSaving(null);
    }
  };

  const openPortal = async () => {
    setSaving("portal");
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("Faça login novamente.");
      const response = await fetch("/api/billing/portal", { method: "POST", headers, body: "{}" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível abrir o portal de cobrança.");
      window.location.assign(data.url);
    } catch (error) {
      setModal({ isOpen: true, type: "error", title: "Portal Stripe", message: error instanceof Error ? error.message : "Erro inesperado." });
      setSaving(null);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando faturamento...</div>;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-start gap-4">
        <Link href="/configuracoes" className="text-gray-400 hover:text-white mt-1"><ArrowLeft className="w-6 h-6" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><CreditCard className="w-6 h-6 text-cyan-400" /> Faturamento</h1>
          <p className="text-gray-400 text-sm mt-1">Uma assinatura simples para cada igreja, sem fidelidade.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-5">
        <Card className="border-cyan-500/20">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">Plano único OHEL ON</p>
              <h2 className="text-2xl font-bold text-white mt-2">{billing?.plan.name || "Plano Igreja"}</h2>
              <p className="text-gray-400 text-sm mt-2">Gestão completa para a igreja, com todos os módulos já disponíveis no sistema.</p>
            </div>
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3"><ShieldCheck className="w-6 h-6 text-cyan-400" /></div>
          </div>
          <div className="flex items-end gap-2 mb-6"><span className="text-4xl font-bold text-white">{formatMoney(planAmount)}</span><span className="text-gray-400 mb-1">/mês</span></div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-300">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sem taxa de adesão</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Cancele quando quiser</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Cobrança segura pela Stripe</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Acesso até o fim do ciclo pago</div>
          </div>
          {!subscription || ["canceled", "incomplete_expired"].includes(subscription.status) ? (
            <Button type="button" onClick={startCheckout} disabled={saving !== null} className="mt-7 w-full sm:w-auto">
              {saving === "checkout" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Assinar por {formatMoney(planAmount)}/mês</>}
            </Button>
          ) : null}
          <p className="text-[11px] text-gray-500 mt-4">O pagamento é concluído em uma página segura da Stripe. O OHEL ON não armazena os dados do cartão.</p>
        </Card>

        <Card className="border-gray-800">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
            <div><p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Status da igreja</p><h2 className={`text-xl font-bold mt-1 ${statusClass(subscription)}`}>{statusLabel(subscription)}</h2></div>
            {isActive ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <CalendarClock className="w-6 h-6 text-gray-500" />}
          </div>
          <div className="space-y-4 text-sm">
            <div><p className="text-gray-500">Igreja</p><p className="text-white mt-1">{billing?.church.name || "—"}</p></div>
            <div><p className="text-gray-500">Próxima renovação</p><p className="text-white mt-1">{formatDate(subscription?.currentPeriodEnd || null)}</p></div>
            {subscription?.cancelAtPeriodEnd && <p className="text-amber-300 text-xs leading-relaxed">A assinatura não será renovada. O acesso permanece até {formatDate(subscription.currentPeriodEnd)}.</p>}
            {isPendingPayment && <p className="text-amber-300 text-xs leading-relaxed">Há um pagamento pendente. Abra o portal Stripe para atualizar os dados de pagamento.</p>}
          </div>
          {subscription && !["canceled", "incomplete_expired"].includes(subscription.status) && (
            <div className="flex flex-col gap-2 mt-6">
              {canResume ? (
                <Button type="button" onClick={() => changeCancellation("resume")} disabled={saving !== null} className="w-full">{saving === "resume" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Reativar renovação</>}</Button>
              ) : (
                <Button type="button" onClick={() => changeCancellation("cancel")} disabled={saving !== null} variant="danger" className="w-full">{saving === "cancel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Cancelar renovação</>}</Button>
              )}
              <Button type="button" onClick={openPortal} disabled={saving !== null} variant="secondary" className="w-full">{saving === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ExternalLink className="w-4 h-4" /> Abrir portal de cobrança</>}</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
