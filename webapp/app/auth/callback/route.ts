import { NextResponse } from "next/server";

import {
  applySupabaseCookies,
  getSupabaseServerClient,
} from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect = requestUrl.searchParams.get("next") ?? "/";

  const cookieResponse = new NextResponse();
  const supabase = getSupabaseServerClient(cookieResponse);

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const safeRedirect =
    redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";

  const response = NextResponse.redirect(new URL(safeRedirect, request.url));
  applySupabaseCookies(cookieResponse, response);
  return response;
}
