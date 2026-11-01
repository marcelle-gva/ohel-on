import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, syncStripeSubscription, updateInvoiceStatus } from "@/lib/billing-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function stripeObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET não configurada." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura Stripe ausente." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? `Assinatura inválida: ${error.message}` : "Assinatura inválida." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { error: eventError } = await admin.from("billing_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
  });

  if (eventError?.code === "23505") {
    const { data: previousEvent, error: previousEventError } = await admin
      .from("billing_webhook_events")
      .select("processed_at")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (previousEventError) return NextResponse.json({ error: previousEventError.message }, { status: 500 });
    if (previousEvent?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  }
  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = stripeObjectId(session.subscription as string | { id: string } | null | undefined);
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await syncStripeSubscription(admin, subscription, session.metadata?.igreja_id || session.client_reference_id || undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncStripeSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid": {
        await updateInvoiceStatus(admin, event.data.object as Stripe.Invoice, "paid");
        break;
      }
      case "invoice.payment_failed": {
        await updateInvoiceStatus(admin, event.data.object as Stripe.Invoice, "payment_failed");
        break;
      }
      default:
        break;
    }

    await admin
      .from("billing_webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar evento Stripe.";
    await admin
      .from("billing_webhook_events")
      .update({ processing_error: message })
      .eq("stripe_event_id", event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
