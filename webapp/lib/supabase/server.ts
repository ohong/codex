import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseServerClient(
  cookieResponse?: NextResponse
): SupabaseClient {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  if (
    process.env.NODE_ENV !== "production" &&
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.warn(
      "Using deprecated NEXT_PUBLIC_SUPABASE_ANON_KEY. Update to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        if (cookieResponse) {
          cookieResponse.cookies.set({ name, value, ...options });
          return;
        }

        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          console.warn("Unable to set Supabase cookie on this request.", error);
        }
      },
      remove(name: string, options: CookieOptions) {
        if (cookieResponse) {
          cookieResponse.cookies.set({
            name,
            value: "",
            ...options,
            maxAge: 0,
          });
          return;
        }

        try {
          cookieStore.delete({ name, ...options });
        } catch (error) {
          console.warn(
            "Unable to remove Supabase cookie on this request.",
            error
          );
        }
      },
    },
  });
}

export function applySupabaseCookies(
  source: NextResponse,
  target: NextResponse
) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}
