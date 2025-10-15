## Outta Sight Pizza assistant

This project is a full-stack Next.js app that lets a guest:

- capture delivery details,
- link a card using Stripe Setup Intents, and
- describe their order in natural language so the Gemini 2.5 computer-use model can translate it into the official menu from [thatsouttasight.com](https://www.thatsouttasight.com/).

The UI is built with TypeScript, the Next.js App Router, Tailwind CSS, and shadcn/ui primitives.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file in the `webapp` directory with the required secrets (see [Environment variables](#environment-variables)).

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Visit [http://localhost:3000](http://localhost:3000) to try the flow.

## Environment variables

Create `webapp/.env.local` (for local dev) or configure the same keys in Vercel → Project Settings → Environment Variables.

| Key | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase publishable key used by both server and browser clients. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe publishable key for the Elements client. |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key used by the Setup Intent and payment APIs. |
| `GEMINI_API_KEY` | ✅ | Server-side key for the Gemini 2.5 computer-use model. `GOOGLE_API_KEY` is also supported as a fallback. |
| `GEMINI_COMPUTER_USE_MODEL` | ➖ | Optional override for the Gemini model name. Defaults to `gemini-2.5-pro-exp-0827`. |

In production you should store these secrets in the hosting provider's env configuration (e.g. Vercel secrets). Never commit them to version control.

## Supabase schema

Create a `profiles` table linked to Supabase Auth so delivery details and the default payment method can be reused across sessions:

```sql
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  delivery_notes text,
  stripe_customer_id text,
  default_payment_method_id text,
  card_brand text,
  card_last4 text,
  card_exp_month integer,
  card_exp_year integer,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

alter table public.profiles enable row level security;

create policy "Users can view their profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can upsert their profile" on public.profiles
  for insert with check (auth.uid() = id)
  using (auth.uid() = id);

create policy "Users can update their profile" on public.profiles
  for update using (auth.uid() = id);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

If you already have a `profiles` table, add the Stripe-related columns and adjust the policies accordingly.

## How it works

- **Supabase-authenticated profiles** – Email/password auth ensures each guest has a persisted `profiles` row. Delivery addresses, Stripe customer IDs, and tokenized card metadata live there behind row-level security.
- **Address capture** – Users complete a structured form that validates required delivery fields and upserts the Supabase profile.
- **Stripe card linking** – Once the address is saved we POST to `/api/create-setup-intent`, create a Setup Intent with Stripe, and render the Payment Element so the guest can vault a card securely. On success `/api/payment-method` stores brand/last4 metadata in Supabase.
- **Gemini ordering agent** – Conversation history, address context, and an up-to-date menu are passed to `/api/gemini`, which calls the Gemini 2.5 computer-use model and returns structured order JSON. A deterministic fallback parser keeps the UI usable if the API key is missing.
- **Confirmation** – The interpreted order is surfaced for review. Confirming POSTs to `/api/place-order`, which currently logs the payload with the associated Stripe customer/payment method. Wire this endpoint to the real Outta Sight ordering integration when available.

## Deploying

This project is ready to ship to Vercel. After pushing to GitHub:

1. Create a new Vercel project and select this repo.
2. Add the environment variables above to the project settings.
3. Deploy – Vercel will build the Next.js app automatically.

For more on deploying the App Router to Vercel, see the [official docs](https://nextjs.org/docs/app/building-your-application/deploying).
