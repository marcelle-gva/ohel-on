import { NextResponse } from "next/server";
import {
  BillingHttpError,
  billingErrorMessage,
  getAppUrl,
  requireBillingAdmin,
} from "@/lib/billing-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { admin, stripe, igrejaId } = await requireBillingAdmin(request);
    const { data: subscription, error } = await admin
      .from("billing_subscriptions")
      .select("stripe_customer_id")
      .eq("igreja_id", igrejaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "A igreja ainda não possui um cadastro de cobrança." }, { status: 404 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getAppUrl(request)}/configuracoes/faturamento`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const status = error instanceof BillingHttpError ? error.status : 500;
    return NextResponse.json({ error: billingErrorMessage(error, "Não foi possível abrir o portal de cobrança.") }, { status });
  }
}
