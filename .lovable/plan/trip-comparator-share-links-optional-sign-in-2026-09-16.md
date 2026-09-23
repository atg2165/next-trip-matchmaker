# Trip Comparator: Share Links + Optional Sign-In

## Goal

1. **Shareable comparisons** — anyone can copy a link that reproduces the exact setup (home city, priorities, destinations) with no account needed.
2. **Optional accounts** — signing in lets people save comparisons and reopen them later from a "My Trips" page. Sharing stays account-free.

## Step 1 — Shareable links (no backend)

- Serialize the full app state (home city + custom home name, 5 priority sliders, destination list including custom cities and manually edited values) into a compact, URL-safe string in the page's search params, e.g. `/?s=...`.
- On page load, read the state from the URL and restore it exactly; fall back to current defaults when the parameter is absent or invalid (invalid data never breaks the page).
- Add a prominent **Share** button in the header: copies the current URL to the clipboard with a confirmation toast, so the recipient lands on the identical comparison.
- Keep the URL in sync as the user edits (replace-state, no history spam), so simply copying from the address bar also works.

## Step 2 — Backend & auth (Lovable Cloud)

- Enable Lovable Cloud: database, logins, and file of saved trips — no external accounts.
- Sign-in methods: **email + password** and **Google** sign-in.
- Pages:
  - `/auth` — public sign-in / sign-up page with both methods.
  - `/reset-password` — public page for the "forgot password" email flow.
- Header changes to reflect session: "Sign in" when logged out; account menu (My Trips, Sign out) when logged in.
- Password reset: "Forgot password?" on the auth page sends a reset email; the reset page lets the user set a new password.

## Step 3 — Saved trips & My Trips page

- New `trips` table: id, owner (linked to the signed-in user), trip name, the same serialized state used by share links, created/updated timestamps. Row-level security so each user sees only their own trips.
- **Save trip** button on the comparator: signed-in users name and save the current setup; signed-out users are invited to sign in first (saving is the only gated action — everything else stays open).
- `/trips` page (signed-in only): lists saved trips with name, home city, destination count, and date; open one to load it back into the comparator, rename, or delete it.
- Opening a saved trip loads its state exactly like a share link does.

## Step 4 — Polish

- Unique page titles/descriptions and social preview tags for the new pages (`/auth`, `/reset-password`, `/trips`).
- Same visual language as today: coral accent, current fonts and card styling.
- Mobile-friendly throughout.

## Technical notes

- Share state is a compact encoded string of the existing in-memory state; validation on load rejects malformed input and silently falls back to defaults.
- Auth via Lovable Cloud's built-in system; the protected `/trips` page redirects to `/auth` when signed out.
- Saved-trip state uses the identical serializer as share links, so saved trips and shared links stay interchangeable.
- No changes to scoring, city data, or flight estimation logic.
