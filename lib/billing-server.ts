import "server-only";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const BILLING_PLAN = {
  code: "igreja_mensal",
  name: "Plano Igreja",
  amount: 8000,
  currency: "brl" as const,
  interval: "month" as const,
};

export type BillingProfile = {
  id: string;
  email: string | null;
  nome: string | null;
  role: string | null;
  igreja_id: string;
};

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY não configurada no servidor.");
  }
  return new Stripe(secretKey);
}

export async function requireBillingAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    throw new BillingHttpError("Sessão não informada.", 401);
  }

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    throw new BillingHttpError("Sessão inválida.", 401);
  }

  const { data: profile, error: profileError } = await admin
    .from("usuarios")
    .select("id, email, nome, role, igreja_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin" || !profile.igreja_id) {
    throw new BillingHttpError("Somente administradores da igreja podem gerenciar o faturamento.", 403);
  }

  return {
    admin,
    stripe: getStripe(),
    user: authData.user,
    profile: profile as BillingProfile,
    igrejaId: profile.igreja_id,
  };
}

export class BillingHttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingHttpError";
    this.status = status;
  }
}

export function billingErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function getAppUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return configuredUrl || new URL(request.url).origin;
}

export async function getOrCreateBillingPrice(stripe: Stripe) {
  const configuredPriceId = process.env.STRIPE_PRICE_ID?.trim();
  if (configuredPriceId) {
    const price = await stripe.prices.retrieve(configuredPriceId);
    if (
      !price.active ||
      price.unit_amount !== BILLING_PLAN.amount ||
      price.currency !== BILLING_PLAN.currency ||
      price.recurring?.interval !== BILLING_PLAN.interval
    ) {
      throw new Error("STRIPE_PRICE_ID não corresponde ao plano mensal de R$ 80,00.");
    }
    return price;
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((item) => item.metadata?.ohel_on_plan === BILLING_PLAN.code);
  if (!product) {
    product = await stripe.products.create({
      name: "OHEL ON — Plano Igreja",
      description: "Gestão completa para igrejas, com cobrança mensal e cancelamento a qualquer momento.",
      metadata: { ohel_on_plan: BILLING_PLAN.code },
    });
  }

  const prices = await stripe.prices.list({ product: product.id, active: true, type: "recurring", limit: 100 });
  const existingPrice = prices.data.find(
    (price) =>
      price.unit_amount === BILLING_PLAN.amount &&
      price.currency === BILLING_PLAN.currency &&
      price.recurring?.interval === BILLING_PLAN.interval,
  );
  if (existingPrice) return existingPrice;

  return stripe.prices.create({
    product: product.id,
    unit_amount: BILLING_PLAN.amount,
    currency: BILLING_PLAN.currency,
    recurring: { interval: BILLING_PLAN.interval },
    nickname: "OHEL ON — R$ 80/mês",
    metadata: { ohel_on_plan: BILLING_PLAN.code },
  });
}

export async function getOrCreateStripeCustomer(
  admin: ReturnType<typeof getSupabaseAdmin>,
  stripe: Stripe,
  profile: BillingProfile,
) {
  const { data: subscriptionRow, error: subscriptionError } = await admin
    .from("billing_subscriptions")
    .select("stripe_customer_id")
    .eq("igreja_id", profile.igreja_id)
    .maybeSingle();
  if (subscriptionError) throw new Error(subscriptionError.message);
  if (subscriptionRow?.stripe_customer_id) return subscriptionRow.stripe_customer_id;

  const { data: church, error: churchError } = await admin
    .from("igrejas")
    .select("nome, email")
    .eq("id", profile.igreja_id)
    .single();
  if (churchError || !church) throw new Error(churchError?.message || "Igreja não encontrada.");

  const customer = await stripe.customers.create({
    name: church.nome || profile.nome || undefined,
    email: profile.email || church.email || undefined,
    metadata: {
      igreja_id: profile.igreja_id,
      plan_code: BILLING_PLAN.code,
    },
  });

  const { error: upsertError } = await admin.from("billing_subscriptions").upsert(
    {
      igreja_id: profile.igreja_id,
      stripe_customer_id: customer.id,
      plan_code: BILLING_PLAN.code,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "igreja_id" },
  );
  if (upsertError) throw new Error(upsertError.message);

  return customer.id;
}

function timestampToIso(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function getStripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null;
}

export async function syncStripeSubscription(
  admin: ReturnType<typeof getSupabaseAdmin>,
  subscription: Stripe.Subscription,
  fallbackIgrejaId?: string,
) {
  const customerId = getStripeId(subscription.customer);
  let igrejaId = subscription.metadata?.igreja_id || fallbackIgrejaId || null;

  if (!igrejaId && customerId) {
    const { data: existing } = await admin
      .from("billing_subscriptions")
      .select("igreja_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    igrejaId = existing?.igreja_id || null;
  }

  if (!igrejaId) return null;

  const firstItem = subscription.items.data[0];
  const priceId = typeof firstItem?.price === "string" ? firstItem.price : firstItem?.price?.id || null;
  const latestInvoiceId = getStripeId(subscription.latest_invoice as string | { id: string } | null | undefined);
  const payload = {
    igreja_id: igrejaId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan_code: BILLING_PLAN.code,
    status: subscription.status,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_end: timestampToIso(firstItem?.current_period_end),
    cancel_at: timestampToIso(subscription.cancel_at),
    canceled_at: timestampToIso(subscription.canceled_at),
    last_invoice_id: latestInvoiceId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("billing_subscriptions")
    .upsert(payload, { onConflict: "igreja_id" })
    .select("igreja_id, plan_code, status, cancel_at_period_end, current_period_end, cancel_at, canceled_at, last_invoice_status")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateInvoiceStatus(
  admin: ReturnType<typeof getSupabaseAdmin>,
  invoice: Stripe.Invoice,
  status: "paid" | "payment_failed",
) {
  const customerId = getStripeId(invoice.customer);
  if (!customerId) return;

  const { error } = await admin
    .from("billing_subscriptions")
    .update({
      last_invoice_id: invoice.id,
      last_invoice_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
  if (error) throw new Error(error.message);
}

export function getSafeSubscription(subscription: {
  plan_code: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  last_invoice_status: string | null;
} | null) {
  return subscription
    ? {
        planCode: subscription.plan_code,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: subscription.current_period_end,
        cancelAt: subscription.cancel_at,
        canceledAt: subscription.canceled_at,
        lastInvoiceStatus: subscription.last_invoice_status,
      }
    : null;
}
