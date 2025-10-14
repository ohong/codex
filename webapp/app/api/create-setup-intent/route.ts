import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2024-06-20",
    })
  : null;

export async function POST() {
  if (!stripe) {
    return NextResponse.json(
      {
        error:
          "Missing STRIPE_SECRET_KEY. Add it to your environment to enable card linking.",
      },
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      `full_name, phone, address_line1, address_line2, city, state, postal_code, stripe_customer_id`
    )
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!profile?.address_line1 || !profile.city || !profile.state || !profile.postal_code) {
    return NextResponse.json(
      { error: "Save your address before linking a card." },
      { status: 400 }
    );
  }

  let customerId = profile.stripe_customer_id ?? undefined;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        name: profile.full_name ?? undefined,
        phone: profile.phone ?? undefined,
        address: {
          line1: profile.address_line1 ?? undefined,
          line2: profile.address_line2 ?? undefined,
          city: profile.city ?? undefined,
          state: profile.state ?? undefined,
          postal_code: profile.postal_code ?? undefined,
          country: "US",
        },
        metadata: {
          supabase_user_id: session.user.id,
        },
      });

      customerId = customer.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    } else {
      await stripe.customers.update(customerId, {
        email: session.user.email ?? undefined,
        name: profile.full_name ?? undefined,
        phone: profile.phone ?? undefined,
        address: {
          line1: profile.address_line1 ?? undefined,
          line2: profile.address_line2 ?? undefined,
          city: profile.city ?? undefined,
          state: profile.state ?? undefined,
          postal_code: profile.postal_code ?? undefined,
          country: "US",
        },
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        source: "outta-sight-pizza-assistant",
        supabase_user_id: session.user.id,
      },
      customer: customerId,
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (setupError) {
    console.error("Stripe setup intent error", setupError);
    return NextResponse.json(
      {
        error:
          setupError instanceof Error
            ? setupError.message
            : "Stripe failed to create a setup intent.",
      },
      { status: 500 }
    );
  }
}
