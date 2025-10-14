# QA plan

This checklist covers the golden path plus edge cases for the pizza concierge. Run everything against a Supabase project that has the `profiles` table and policies described in the README.

## Happy path

1. **Sign up / sign in**
   - Navigate to `/` while signed out. Verify the authentication card renders with the new art-direction.
   - Create a new account with email/password. Confirm Supabase either logs the user in immediately or sends a confirmation email (depends on your auth settings).
   - Sign out and sign back in with the same credentials.
2. **Profile bootstrap**
   - After signing in, confirm the header shows the signed-in email and the CTA hero reflects the style guide colors.
   - Ensure the address form is prefilled with only the Supabase email and empty fields on first run.
3. **Address persistence**
   - Complete every required address field and submit.
   - Refresh the page. All address fields should repopulate from Supabase and the step badge should show "Address saved".
   - Attempt to submit with a missing field (e.g., remove ZIP). Validate that inline error bullets display.
4. **Stripe card linking**
   - With the address saved, observe that the Stripe Payment Element loads automatically. Link a test card (`4242 4242 4242 4242`).
   - Verify the "Card on file" preview renders brand/last4 and that the header pill updates to the same info.
   - Hit "Replace card" and ensure a fresh Payment Element appears. Link a different test card to confirm overwriting works.
5. **Conversation + confirmation**
   - Chat "One Tavern pie". Confirm Gemini replies, clarifications show when needed, and the summary includes the proper menu item.
   - Confirm the order and watch the staged payload appear in the terminal logs (look for Stripe customer/payment method metadata).

## Edge cases

- **Missing Stripe keys** – Remove Stripe env vars and reload. The card step should surface an inline error instead of crashing.
- **Supabase auth failure** – Revoke the anon key temporarily. API calls (`/api/profile`) should return 500 and surface a banner.
- **Expired session** – Sign in, then clear cookies and submit the address form. The API should respond 401 and the UI should prompt a re-login.
- **Gemini unavailable** – Clear `GEMINI_API_KEY` and confirm the deterministic fallback still interprets menu items (check console logs for fallback notice).
- **Accessibility** – Tab through the form and chat controls to ensure focus outlines are present and readable.

## Visual regression spot-checks

- Hero badge, step cards, and chat bubbles should all follow the dark neon palette defined in `style-guide.json`.
- Buttons remain pill-shaped with glow on hover, and cards keep a 1.25rem radius.
