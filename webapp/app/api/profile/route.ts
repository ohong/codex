import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applySupabaseCookies,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  deliveryNotes: z.string().optional(),
});

export async function GET() {
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

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `full_name, phone, address_line1, address_line2, city, state, postal_code, delivery_notes, stripe_customer_id, default_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year`
    )
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    return respond({ error: error.message }, { status: 500 });
  }

  return respond({ profile: data ?? null });
}

export async function PUT(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return respond({ error: "Invalid address payload" }, { status: 400 });
  }

  const payload = parsed.data;

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: session.user.id,
        full_name: payload.name ?? null,
        phone: payload.phone ?? null,
        address_line1: payload.line1,
        address_line2: payload.line2 ?? null,
        city: payload.city,
        state: payload.state,
        postal_code: payload.postalCode,
        delivery_notes: payload.deliveryNotes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (upsertError) {
    return respond({ error: upsertError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `full_name, phone, address_line1, address_line2, city, state, postal_code, delivery_notes, stripe_customer_id, default_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year`
    )
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    return respond({ error: error.message }, { status: 500 });
  }

  return respond({ profile: data ?? null });
}
