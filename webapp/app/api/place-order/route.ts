import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applySupabaseCookies,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

const orderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  price: z.number().optional(),
  notes: z.string().optional(),
});

const orderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  subtotal: z.number().optional(),
  taxes: z.number().optional(),
  fees: z.number().optional(),
  total: z.number().optional(),
  specialInstructions: z.string().optional(),
  confirmationPrompt: z.string().optional(),
});

const addressSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  deliveryNotes: z.string().optional(),
});

const requestSchema = z.object({
  order: orderSchema,
  address: addressSchema,
});

export async function POST(request: Request) {
  const cookieResponse = new NextResponse();
  const supabase = getSupabaseServerClient(cookieResponse);
  const respond = (
    body: unknown,
    init?: ResponseInit | undefined
  ): NextResponse => {
    const response = NextResponse.json(body, init);
    applySupabaseCookies(cookieResponse, response);
    return response;
  };
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return respond({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return respond({ error: "Invalid order payload" }, { status: 400 });
  }

  const { order, address } = parsed.data;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `stripe_customer_id, default_payment_method_id, card_brand, card_last4`
    )
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError) {
    return respond({ error: profileError.message }, { status: 500 });
  }

  console.info(
    "Outta Sight Pizza order",
    JSON.stringify(
      {
        user: session.user.email,
        order,
        address,
        payment:
          profile?.default_payment_method_id
            ? {
                customer: profile.stripe_customer_id,
                paymentMethod: profile.default_payment_method_id,
                label: `${profile.card_brand ?? "card"} •••• ${profile.card_last4 ?? "0000"}`,
              }
            : null,
      },
      null,
      2
    )
  );

  return respond({
    ok: true,
    message: "Order staged. Wire this payload to Outta Sight's ordering endpoint when available.",
  });
}
