import { NextResponse } from "next/server";
import {
  BILLING_PLAN,
  BillingHttpError,
  billingErrorMessage,
  getAppUrl,
  getOrCreateBillingPrice,
  getOrCreateStripeCustomer,
  getSafeSubscription,
  requireBillingAdmin,
} from "@/lib/billing-server";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string) {
  const status = error instanceof BillingHttpError ? error.status : 500;
  return NextResponse.json({ error: billingErrorMessage(error, fallback) }, { status });
}

export async function GET(request: Request) {
  try {
    const { admin, igrejaId } = await requireBillingAdmin(request);
    const [{ data: subscription, error: subscriptionError }, { data: church, error: churchError }] = await Promise.all([
      admin
        .from("billing_subscriptions")
        .select("plan_code, status, cancel_at_period_end, current_period_end, cancel_at, canceled_at, last_invoice_status")
        .eq("igreja_id", igrejaId)
        .maybeSingle(),
      admin.from("igrejas").select("nome").eq("id", igrejaId).single(),
    ]);

    if (subscriptionError) throw new Error(subscriptionError.message);
    if (churchError || !church) throw new Error(churchError?.message || "Igreja não encontrada.");

    return NextResponse.json({
      church: { id: igrejaId, name: church.nome },
      plan: {
        code: BILLING_PLAN.code,
        name: BILLING_PLAN.name,
        amount: BILLING_PLAN.amount,
        currency: "BRL",
        interval: "month",
      },
      subscription: getSafeSubscription(subscription),
    });
  } catch (error) {
    return errorResponse(error, "Não foi possível carregar o faturamento.");
  }
}

export async function POST(request: Request) {
  try {
    const { admin, stripe, profile, igrejaId } = await requireBillingAdmin(request);
    const { data: existingSubscription, error: existingError } = await admin
      .from("billing_subscriptions")
      .select("stripe_subscription_id, status, cancel_at_period_end")
      .eq("igreja_id", igrejaId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (
      existingSubscription?.stripe_subscription_id &&
      ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(existingSubscription.status)
    ) {
      return NextResponse.json({ error: "Esta igreja já possui uma assinatura ou uma cobrança em andamento." }, { status: 409 });
    }

    const [price, customerId] = await Promise.all([
      getOrCreateBillingPrice(stripe),
      getOrCreateStripeCustomer(admin, stripe, profile),
    ]);
    const origin = getAppUrl(request);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: igrejaId,
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: {
        metadata: {
          igreja_id: igrejaId,
          plan_code: BILLING_PLAN.code,
        },
      },
      metadata: {
        igreja_id: igrejaId,
        plan_code: BILLING_PLAN.code,
      },
      billing_address_collection: "required",
      allowed_payment_method_types: ["card"],
      locale: "pt-BR",
      success_url: `${origin}/configuracoes/faturamento?checkout=success`,
      cancel_url: `${origin}/configuracoes/faturamento?checkout=cancelled`,
    });

    if (!session.url) throw new Error("A Stripe não retornou o endereço do Checkout.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return errorResponse(error, "Não foi possível iniciar a assinatura.");
  }
}
