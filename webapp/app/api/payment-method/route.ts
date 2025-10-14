import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2024-06-20",
    })
  : null;

const bodySchema = z.object({
  paymentMethodId: z.string().min(1),
});

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY. Cannot store payment methods." },
      { status: 500 }
    );
  }

  const supabase = getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
  }

  const { paymentMethodId } = parsed.data;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `stripe_customer_id, full_name, phone, address_line1, address_line2, city, state, postal_code`
    )
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Missing Stripe customer. Save your address before linking a card." },
      { status: 400 }
    );
  }

  try {
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: profile.stripe_customer_id,
      });
    } catch (error) {
      if (
        !(error instanceof Stripe.errors.StripeError) ||
        error.code !== "resource_already_exists"
      ) {
        throw error;
      }
    }

    await stripe.customers.update(profile.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const card = paymentMethod.card;

    if (!card) {
      throw new Error("Stripe payment method is not a card.");
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        default_payment_method_id: paymentMethodId,
        card_brand: card.brand,
        card_last4: card.last4,
        card_exp_month: card.exp_month,
        card_exp_year: card.exp_year,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      card: {
        brand: card.brand ?? "card",
        last4: card.last4 ?? "0000",
        expMonth: card.exp_month ?? 1,
        expYear: card.exp_year ?? 2030,
      },
    });
  } catch (error) {
    console.error("Failed to persist payment method", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to store payment method",
      },
      { status: 500 }
    );
  }
}
