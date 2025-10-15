"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  CreditCard,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Pizza,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MenuCategory, PizzaItem } from "@/data/menu";
import { pizzaMenu } from "@/data/menu";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

interface AddressFormData {
  name: string;
  email: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  deliveryNotes?: string;
}

interface SavedCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface SupabaseProfile {
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  delivery_notes: string | null;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface StructuredOrderItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
}

interface StructuredOrder {
  items: StructuredOrderItem[];
  subtotal?: number;
  taxes?: number;
  fees?: number;
  total?: number;
  specialInstructions?: string;
  confirmationPrompt?: string;
}

interface GeminiOrderResponse {
  assistantMessage: string;
  requiresClarification?: boolean;
  clarifications?: string[];
  order?: StructuredOrder;
}

const defaultAssistantMessage: ChatMessage = {
  role: "assistant",
  content:
    "Hey there! I'm your Outta Sight pizza concierge. Tell me what you're craving and I'll take care of the order.",
  timestamp: Date.now(),
};

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<SupabaseProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressFormData>({
    name: "",
    email: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    deliveryNotes: "",
  });
  const [addressErrors, setAddressErrors] = useState<string[]>([]);
  const [addressStatus, setAddressStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [intentStatus, setIntentStatus] = useState<
    "idle" | "loading" | "linked" | "error"
  >("idle");
  const [intentError, setIntentError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([defaultAssistantMessage]);
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");
  const [sending, setSending] = useState(false);
  const [proposedOrder, setProposedOrder] = useState<StructuredOrder | null>(null);
  const [confirmationState, setConfirmationState] = useState<
    "idle" | "submitting" | "confirmed" | "error"
  >("idle");
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  const addressSaved = addressStatus === "saved";

  useEffect(() => {
    let active = true;

    const hydrateSession = async () => {
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();
      if (!active) return;
      setSession(existingSession);
      setInitializing(false);
    };

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setSavedCard(null);
        setSetupClientSecret(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setSavedCard(null);
      setSetupClientSecret(null);
      return;
    }

    const controller = new AbortController();
    const fetchProfile = async () => {
      try {
        setProfileError(null);
        const response = await fetch("/api/profile", {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to load profile");
        }

        const payload = (await response.json()) as {
          profile: SupabaseProfile | null;
        };

        setProfile(payload.profile);
      } catch (error) {
        if (controller.signal.aborted) return;
        setProfileError(
          error instanceof Error
            ? error.message
            : "We couldn't load your saved details."
        );
      }
    };

    fetchProfile();

    return () => controller.abort();
  }, [session]);

  useEffect(() => {
    if (!session) {
      setAddress({
        name: "",
        email: "",
        phone: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        postalCode: "",
        deliveryNotes: "",
      });
      setAddressStatus("idle");
      return;
    }

    setAddress({
      name: profile?.full_name ?? "",
      email: session.user.email ?? "",
      phone: profile?.phone ?? "",
      line1: profile?.address_line1 ?? "",
      line2: profile?.address_line2 ?? "",
      city: profile?.city ?? "",
      state: profile?.state ?? "",
      postalCode: profile?.postal_code ?? "",
      deliveryNotes: profile?.delivery_notes ?? "",
    });

    const isComplete = Boolean(
      (profile?.full_name ?? "").trim() &&
        (session.user.email ?? "").trim() &&
        (profile?.address_line1 ?? "").trim() &&
        (profile?.city ?? "").trim() &&
        (profile?.state ?? "").trim() &&
        (profile?.postal_code ?? "").trim()
    );

    setAddressErrors([]);
    setAddressStatus(isComplete ? "saved" : "idle");

    if (profile?.default_payment_method_id) {
      setSavedCard({
        brand: profile.card_brand ?? "Card",
        last4: profile.card_last4 ?? "0000",
        expMonth: profile.card_exp_month ?? 1,
        expYear: profile.card_exp_year ?? 2030,
      });
      setIntentStatus("linked");
    } else {
      setSavedCard(null);
      setIntentStatus("idle");
    }
  }, [profile, session]);

  useEffect(() => {
    if (
      !session ||
      !addressSaved ||
      savedCard ||
      !publishableKey ||
      !stripePromise ||
      intentStatus === "loading" ||
      setupClientSecret
    ) {
      return;
    }

    const controller = new AbortController();
    const loadSetupIntent = async () => {
      try {
        setIntentStatus("loading");
        setIntentError(null);
        const response = await fetch("/api/create-setup-intent", {
          method: "POST",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Unable to start Stripe setup.");
        }

        const payload = (await response.json()) as {
          clientSecret?: string;
        };

        if (!payload.clientSecret) {
          throw new Error("Stripe did not return a client secret.");
        }

        setSetupClientSecret(payload.clientSecret);
        setIntentStatus("idle");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to create setup intent", error);
        setIntentStatus("error");
        setIntentError(
          error instanceof Error
            ? error.message
            : "We couldn't reach Stripe. Double-check your API keys."
        );
      }
    };

    loadSetupIntent();

    return () => controller.abort();
  }, [
    session,
    addressSaved,
    savedCard,
    intentStatus,
    setupClientSecret,
  ]);
  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthMessage(null);

    if (!authEmail || !authPassword) {
      setAuthError("Email and password are required.");
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });

        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });

        if (error) throw error;

        if (!data.session) {
          setAuthMessage(
            "Check your inbox to confirm your email. You can sign in once it's verified."
          );
        } else {
          setAuthMessage("Account created! You're signed in.");
        }
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthMessage(null);
    setGoogleLoading(true);

    try {
      if (typeof window === "undefined") return;

      const returnTo =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      const redirectTo =
        window.location.origin +
        `/auth/callback${
          returnTo && returnTo !== "/" ? `?next=${encodeURIComponent(returnTo)}` : ""
        }`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "openid email profile",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Google sign-in could not be started."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthEmail("");
    setAuthPassword("");
    setAuthMode("sign-in");
  };

  const handleAddressChange = (field: keyof AddressFormData, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setAddressStatus("idle");
  };

  const validateAddress = (): boolean => {
    const errors: string[] = [];
    if (!address.name.trim()) errors.push("Full name is required");
    if (!address.email.trim()) errors.push("Email is required");
    if (!address.line1.trim()) errors.push("Street address is required");
    if (!address.city.trim()) errors.push("City is required");
    if (!address.state.trim()) errors.push("State is required");
    if (!address.postalCode.trim()) errors.push("ZIP code is required");

    setAddressErrors(errors);
    return errors.length === 0;
  };

  const handleAddressSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!validateAddress()) {
      setAddressStatus("error");
      return;
    }

    setAddressStatus("saving");

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          deliveryNotes: address.deliveryNotes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to save address");
      }

      const payload = (await response.json()) as {
        profile: SupabaseProfile | null;
      };

      setProfile(payload.profile);
      setAddressStatus("saved");
    } catch (error) {
      console.error("Failed to persist address", error);
      setAddressStatus("error");
      setAddressErrors([
        error instanceof Error
          ? error.message
          : "We couldn't save your address. Try again.",
      ]);
    }
  };

  const handleResetPayment = () => {
    setSavedCard(null);
    setIntentStatus("idle");
    setIntentError(null);
    setSetupClientSecret(null);
  };

  const handlePaymentLinked = (card: SavedCard) => {
    setSavedCard(card);
    setIntentStatus("linked");
    setIntentError(null);
    setSetupClientSecret(null);
  };

  const handleSend = async () => {
    if (!userInput.trim()) return;

    const nextMessage: ChatMessage = {
      role: "user",
      content: userInput.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, nextMessage]);
    setUserInput("");
    setSending(true);
    setConfirmationState("idle");
    setConfirmationError(null);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: nextMessage.content,
          history: messages.map(({ role, content }) => ({ role, content })),
          address,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Gemini could not interpret the request.");
      }

      const payload = (await response.json()) as GeminiOrderResponse;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload.assistantMessage,
          timestamp: Date.now(),
        },
      ]);
      setClarifications(payload.clarifications ?? []);
      setProposedOrder(payload.order ?? null);
    } catch (error) {
      console.error("Gemini conversation error", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `I ran into a problem understanding that: ${error.message}`
              : "I ran into a problem parsing that order.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!proposedOrder) return;
    setConfirmationState("submitting");
    setConfirmationError(null);

    try {
      const response = await fetch("/api/place-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: proposedOrder,
          address,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "We couldn't reach the ordering service.");
      }

      setConfirmationState("confirmed");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Your order is confirmed and queued! Keep an eye on your email for pickup or delivery details.",
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      console.error("Failed to confirm order", error);
      setConfirmationState("error");
      setConfirmationError(
        error instanceof Error
          ? error.message
          : "We hit an unexpected error while saving the order."
      );
    }
  };

  const activeStep = useMemo(() => {
    if (!addressSaved) return 0;
    if (!savedCard) return 1;
    if (confirmationState === "confirmed") return 3;
    return 2;
  }, [addressSaved, savedCard, confirmationState]);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-border/60 px-6 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Warming up your concierge…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <Card className="w-full max-w-md border-border/60 bg-card/90 shadow-card">
          <CardHeader className="items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-3xl text-primary shadow-glow">
              <Pizza className="h-8 w-8" />
            </div>
            <CardTitle className="font-display text-3xl">Outta Sight Concierge</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Sign in to reuse your saved delivery address and card details for faster ordering.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="ada@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    authMode === "sign-in" ? "current-password" : "new-password"
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use at least 8 characters. Supabase email confirmation may be required depending on your project settings.
                </p>
              </div>
              {authError && (
                <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {authError}
                </p>
              )}
              {authMessage && (
                <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-foreground">
                  {authMessage}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={authLoading || googleLoading}
              >
                {authLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {authMode === "sign-in" ? "Signing in" : "Creating account"}
                  </span>
                ) : authMode === "sign-in" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <div className="h-px flex-1 bg-border/70" />
              or continue with
              <div className="h-px flex-1 bg-border/70" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={googleLoading || authLoading}
              onClick={handleGoogleSignIn}
            >
              {googleLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to Google…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                  >
                    <path
                      fill="#4285F4"
                      d="M23.12 12.27c0-.78-.07-1.53-.21-2.27H12v4.3h6.24c-.27 1.4-1.08 2.58-2.3 3.38v2.8h3.72c2.18-2 3.46-4.95 3.46-8.21Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.72-2.8c-1.04.7-2.37 1.12-4.23 1.12-3.25 0-6-2.2-6.98-5.17H1.2v3.25C3.18 21.53 7.2 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.02 14.23A7.21 7.21 0 0 1 4.64 12c0-.77.14-1.52.38-2.23V6.52H1.2A11.95 11.95 0 0 0 0 12c0 1.89.45 3.68 1.2 5.48l3.82-3.25Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.76 0 3.3.61 4.52 1.8l3.35-3.35C17.95 1.2 15.23 0 12 0 7.2 0 3.18 2.47 1.2 6.52l3.82 3.25C6 6.95 8.75 4.75 12 4.75Z"
                    />
                  </svg>
                  Continue with Google
                </span>
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-muted-foreground">
            {authMode === "sign-in" ? (
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  setAuthMode("sign-up");
                  setAuthError(null);
                  setAuthMessage(null);
                }}
              >
                Need an account? Create one
              </button>
            ) : (
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  setAuthMode("sign-in");
                  setAuthError(null);
                  setAuthMessage(null);
                }}
              >
                Already have an account? Sign in
              </button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur-sm">
        <div className="container flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-glow">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-xl font-semibold">
                Outta Sight Pizza Assistant
              </p>
              <p className="text-sm text-muted-foreground">
                Signed in as {session.user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {savedCard && (
              <div className="hidden rounded-full border border-border/60 bg-muted/40 px-4 py-2 text-xs text-muted-foreground md:block">
                Card on file • {savedCard.brand.toUpperCase()} • •••• {savedCard.last4}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container flex flex-col gap-12 pb-20 pt-12">
          <div className="mx-auto max-w-4xl text-center md:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Guided concierge
            </p>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Natural-language pizza ordering powered by Gemini, Stripe, and your saved Supabase profile.
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
              Save your delivery details and card once, then ask for “One Tavern pie” or a fully custom order. We’ll clarify anything ambiguous, confirm the cart, and stage it for Outta Sight Pizza.
            </p>
          </div>

          {profileError && (
            <div className="mx-auto w-full max-w-3xl rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-center text-sm text-destructive">
              {profileError}
            </div>
          )}
          <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <div className="space-y-6">
              <StepCard
                index={0}
                activeIndex={activeStep}
                title="Delivery details"
                icon={<MapPin className="h-5 w-5" />}
                description="Tell us where this pizza party is happening. We’ll reuse it next time."
              >
                <form className="space-y-5" onSubmit={handleAddressSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name" required>
                      <Input
                        value={address.name}
                        onChange={(event) =>
                          handleAddressChange("name", event.target.value)
                        }
                        placeholder="Ada Lovelace"
                      />
                    </Field>
                    <Field label="Email" required>
                      <Input
                        type="email"
                        value={address.email}
                        onChange={(event) =>
                          handleAddressChange("email", event.target.value)
                        }
                        placeholder="ada@example.com"
                        disabled
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Email is tied to your Supabase login. Update it in auth if needed.
                      </p>
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Phone">
                      <Input
                        value={address.phone ?? ""}
                        onChange={(event) =>
                          handleAddressChange("phone", event.target.value)
                        }
                        placeholder="(212) 555-0199"
                      />
                    </Field>
                    <Field label="Address line 1" required>
                      <Input
                        value={address.line1}
                        onChange={(event) =>
                          handleAddressChange("line1", event.target.value)
                        }
                        placeholder="51 Division St"
                      />
                    </Field>
                  </div>
                  <Field label="Address line 2">
                    <Input
                      value={address.line2 ?? ""}
                      onChange={(event) =>
                        handleAddressChange("line2", event.target.value)
                      }
                      placeholder="Apt / Floor / Suite"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="City" required>
                      <Input
                        value={address.city}
                        onChange={(event) =>
                          handleAddressChange("city", event.target.value)
                        }
                        placeholder="New York"
                      />
                    </Field>
                    <Field label="State" required>
                      <Input
                        value={address.state}
                        onChange={(event) =>
                          handleAddressChange("state", event.target.value)
                        }
                        placeholder="NY"
                      />
                    </Field>
                    <Field label="ZIP" required>
                      <Input
                        value={address.postalCode}
                        onChange={(event) =>
                          handleAddressChange("postalCode", event.target.value)
                        }
                        placeholder="10002"
                      />
                    </Field>
                  </div>
                  <Field label="Delivery notes">
                    <Textarea
                      value={address.deliveryNotes ?? ""}
                      onChange={(event) =>
                        handleAddressChange("deliveryNotes", event.target.value)
                      }
                      placeholder="Buzzer 23. Leave with doorman if I don't answer."
                      className="min-h-[96px]"
                    />
                  </Field>
                  {addressErrors.length > 0 && (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                      <p className="font-semibold">We need a couple tweaks:</p>
                      <ul className="ml-4 list-disc space-y-1 pt-1">
                        {addressErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs text-muted-foreground">
                      Your address lives in the Supabase <code className="font-mono">profiles</code> table with row-level security.
                    </div>
                    <Button type="submit" disabled={addressStatus === "saving"}>
                      {addressStatus === "saving" ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Saving
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Save address
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </StepCard>

              <StepCard
                index={1}
                activeIndex={activeStep}
                title="Secure card on file"
                icon={<CreditCard className="h-5 w-5" />}
                description="We vault your card with Stripe so future orders are just a chat away."
                disabled={!addressSaved}
              >
                {!publishableKey || !stripePromise ? (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable Stripe Elements.
                  </div>
                ) : savedCard ? (
                  <SavedCardPreview card={savedCard} onReplace={handleResetPayment} />
                ) : intentStatus === "error" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                      {intentError ?? "Stripe could not start a setup intent."}
                    </div>
                    <Button variant="outline" onClick={handleResetPayment}>
                      Try again
                    </Button>
                  </div>
                ) : intentStatus === "loading" || !setupClientSecret ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing Stripe Elements…
                  </div>
                ) : (
                  <Elements
                    options={{
                      clientSecret: setupClientSecret,
                      appearance: {
                        theme: "flat",
                        variables: {
                          colorPrimary: "#FF5C39",
                          colorBackground: "transparent",
                          colorText: "#F6F7FB",
                          colorDanger: "#FF6B6B",
                          fontFamily: "Inter, system-ui, sans-serif",
                        },
                        rules: {
                          ".Input": {
                            border: "1px solid rgba(34, 40, 55, 0.65)",
                            borderRadius: "18px",
                            padding: "14px",
                            backgroundColor: "rgba(27, 32, 44, 0.6)",
                          },
                          ".Tab": {
                            borderRadius: "999px",
                            border: "1px solid rgba(34, 40, 55, 0.65)",
                          },
                          ".Tab--selected": {
                            backgroundColor: "rgba(255,92,57,0.15)",
                            color: "#F6F7FB",
                          },
                        },
                      },
                    }}
                    stripe={stripePromise}
                  >
                    <StripeSetupForm onLinked={handlePaymentLinked} />
                  </Elements>
                )}
              </StepCard>

              <StepCard
                index={2}
                activeIndex={activeStep}
                title="Chat & confirm"
                icon={<MessageSquare className="h-5 w-5" />}
                description="Describe your order conversationally. We’ll translate it to the menu and confirm before staging."
                disabled={!savedCard}
              >
                <div className="flex flex-col gap-4">
                  <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex flex-col gap-3">
                      {messages.map((message) => (
                        <MessageBubble key={message.timestamp} message={message} />
                      ))}
                    </div>
                    {clarifications.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          Clarifications needed
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {clarifications.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4">
                    <Textarea
                      value={userInput}
                      onChange={(event) => setUserInput(event.target.value)}
                      placeholder="e.g. One Tavern pie and a Caesar for delivery at 7pm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Tip: mention size (slice vs pie) or toppings and the agent will map it to the right menu item.
                      </p>
                      <Button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || !userInput.trim()}
                        className="min-w-[140px]"
                      >
                        {sending ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Sending
                          </span>
                        ) : (
                          "Send"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </StepCard>

              {proposedOrder && (
                <Card className="border-primary/50">
                  <CardHeader>
                    <CardTitle>Review & confirm</CardTitle>
                    <CardDescription>
                      Here’s what the agent understood. Make sure quantities and toppings look right before confirming.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <OrderSummary order={proposedOrder} menu={pizzaMenu} />
                    {confirmationError && (
                      <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {confirmationError}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-wrap items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setProposedOrder(null)}
                      disabled={confirmationState === "submitting"}
                    >
                      Adjust order
                    </Button>
                    <Button
                      type="button"
                      onClick={handleConfirmOrder}
                      disabled={confirmationState === "submitting"}
                    >
                      {confirmationState === "submitting" ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Finalizing
                        </span>
                      ) : confirmationState === "confirmed" ? (
                        "Order confirmed"
                      ) : (
                        "Confirm order"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>

            <aside className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                  <CardDescription>Track your progress through the flow.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <StatusRow
                    label="Address saved"
                    active={addressSaved}
                    description={
                      addressSaved
                        ? `${address.line1}, ${address.city}`
                        : "Add your delivery or pickup details"
                    }
                  />
                  <StatusRow
                    label="Card linked"
                    active={Boolean(savedCard)}
                    description={
                      savedCard
                        ? `${savedCard.brand.toUpperCase()} •••• ${savedCard.last4}`
                        : "Securely connect a card with Stripe"
                    }
                  />
                  <StatusRow
                    label="Order confirmed"
                    active={confirmationState === "confirmed"}
                    description={
                      confirmationState === "confirmed"
                        ? "We’ll place it with Outta Sight"
                        : "Chat with the agent to finalize"
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Menu cheat sheet</CardTitle>
                  <CardDescription>
                    We ground the assistant in Outta Sight’s menu so requests map cleanly to the cart.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {pizzaMenu.map((category) => (
                    <MenuCategoryList key={category.id} category={category} />
                  ))}
                </CardContent>
              </Card>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function StepCard({
  index,
  activeIndex,
  icon,
  title,
  description,
  children,
  disabled,
}: {
  index: number;
  activeIndex: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const statusIcon =
    index < activeIndex ? (
      <CheckCircle2 className="h-5 w-5 text-primary" />
    ) : index === activeIndex ? (
      <CircleDashed className="h-5 w-5 text-primary" />
    ) : (
      <CircleDashed className="h-5 w-5 text-muted-foreground" />
    );

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/60",
        disabled && "opacity-60",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {statusIcon}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-card",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-foreground"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function StripeSetupForm({ onLinked }: { onLinked: (card: SavedCard) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url:
          typeof window !== "undefined" ? window.location.href : undefined,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message ?? "Stripe could not verify this card.");
      setLoading(false);
      return;
    }

    const paymentMethodId = result.setupIntent?.payment_method;
    if (typeof paymentMethodId !== "string") {
      setError("Stripe did not provide a payment method ID.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/payment-method", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to store payment method");
      }

      const payload = (await response.json()) as { card: SavedCard };
      onLinked(payload.card);
    } catch (serverError) {
      setError(
        serverError instanceof Error
          ? serverError.message
          : "We couldn't save your card."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Linking card…
          </span>
        ) : (
          "Link card with Stripe"
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        We use a Stripe Setup Intent, so your card is securely vaulted and charged only when the order is submitted.
      </p>
    </form>
  );
}

function SavedCardPreview({
  card,
  onReplace,
}: {
  card: SavedCard;
  onReplace: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em]">Card on file</p>
          <p className="text-lg font-semibold text-primary-foreground">
            {card.brand.toUpperCase()} •••• {card.last4}
          </p>
          <p className="text-xs text-primary/80">
            Expires {card.expMonth.toString().padStart(2, "0")}/{card.expYear}
          </p>
        </div>
        <CreditCard className="h-8 w-8" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-primary/80">
          Stored with Stripe for off-session charges. Update any time.
        </p>
        <Button type="button" variant="outline" onClick={onReplace}>
          <RefreshCw className="mr-2 h-4 w-4" /> Replace card
        </Button>
      </div>
    </div>
  );
}

function OrderSummary({
  order,
  menu,
}: {
  order: StructuredOrder;
  menu: MenuCategory[];
}) {
  const getMenuItem = (id: string): PizzaItem | undefined => {
    for (const category of menu) {
      const found = category.items.find((item) => item.id === id);
      if (found) return found;
    }
    return undefined;
  };

  const subtotal =
    order.subtotal ??
    order.items.reduce((total, item) => {
      const menuItem = getMenuItem(item.id);
      const basePrice = item.price ?? menuItem?.price ?? 0;
      return total + basePrice * item.quantity;
    }, 0);

  const fees = order.fees ?? 0;
  const taxes = order.taxes ?? Math.round(subtotal * 0.08875 * 100) / 100;
  const total = order.total ?? subtotal + taxes + fees;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {order.items.map((item) => {
          const menuItem = getMenuItem(item.id);
          const unitPrice = item.price ?? menuItem?.price ?? 0;
          return (
            <div
              key={`${item.id}-${item.name}`}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3"
            >
              <div>
                <p className="font-semibold">
                  {item.quantity} × {menuItem?.name ?? item.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {menuItem?.description ?? "Custom item"}
                </p>
                {item.notes && (
                  <p className="pt-2 text-xs text-primary">Note: {item.notes}</p>
                )}
              </div>
              <p className="text-sm font-semibold">
                ${(unitPrice * item.quantity).toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Estimated tax</span>
          <span>${taxes.toFixed(2)}</span>
        </div>
        {fees > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Fees</span>
            <span>${fees.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-base font-semibold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
      {order.specialInstructions && (
        <div className="rounded-2xl border border-muted/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          Special instructions: {order.specialInstructions}
        </div>
      )}
      {order.confirmationPrompt && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          {order.confirmationPrompt}
        </div>
      )}
    </div>
  );
}

function MenuCategoryList({ category }: { category: MenuCategory }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        {category.title}
      </h3>
      <ul className="space-y-2 text-sm">
        {category.items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-border/60 bg-muted/30 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground">${item.price.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
            {item.tags && (
              <p className="pt-1 text-xs text-primary">Tags: {item.tags.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusRow({
  label,
  description,
  active,
}: {
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {active ? (
        <CheckCircle2 className="h-5 w-5 text-primary" />
      ) : (
        <CircleDashed className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}
