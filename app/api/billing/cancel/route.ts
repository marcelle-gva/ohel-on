import { NextResponse } from "next/server";
import {
  BillingHttpError,
  billingErrorMessage,
  getSafeSubscription,
  requireBillingAdmin,
  syncStripeSubscription,
} from "@/lib/billing-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, stripe, igrejaId } = await requireBillingAdmin(request);
    const body = await request.json().catch(() => ({}));
    const action = body.action === "resume" ? "resume" : body.action === "cancel" ? "cancel" : "";
    if (!action) {
      return NextResponse.json({ error: "Ação de faturamento inválida." }, { status: 400 });
    }

    const { data: current, error: currentError } = await admin
      .from("billing_subscriptions")
      .select("stripe_subscription_id, status, cancel_at_period_end")
      .eq("igreja_id", igrejaId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current?.stripe_subscription_id) {
      return NextResponse.json({ error: "Nenhuma assinatura ativa foi encontrada para esta igreja." }, { status: 404 });
    }

    if (action === "resume" && current.status === "canceled") {
      return NextResponse.json({ error: "Essa assinatura já foi encerrada e não pode ser reativada. Inicie uma nova assinatura." }, { status: 409 });
    }

    const updated = await stripe.subscriptions.update(current.stripe_subscription_id, {
      cancel_at_period_end: action === "cancel",
    });
    const subscription = await syncStripeSubscription(admin, updated, igrejaId);

    return NextResponse.json({
      subscription: getSafeSubscription(subscription),
      message:
        action === "cancel"
          ? "Cancelamento agendado. O acesso continua até o fim do período já pago."
          : "Assinatura reativada. A próxima renovação continuará normalmente.",
    });
  } catch (error) {
    const status = error instanceof BillingHttpError ? error.status : 500;
    return NextResponse.json({ error: billingErrorMessage(error, "Não foi possível atualizar a assinatura.") }, { status });
  }
}
