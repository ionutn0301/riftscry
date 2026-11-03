# Managed accounts and private workspaces

RiftScry uses **Supabase Auth + hosted Postgres**. Social providers create and sign
in users through Supabase; the application does not store passwords or run an auth
server. The existing Astro/Vercel deployment continues to serve the app and Riot
API. Clerk is not required, so there is only one new service to configure.

## Provisioned project

The free project `riftscry` (`vpirgetchbflxwrwjgzm`) has been created in
`ionutn0301's Org`, Frankfurt (`eu-central-1`). The account and personal practice plan migrations are applied.
Hosted SQL tests passed for owner isolation, revision conflicts, direct-write
denial and anonymous denial, with all test identities rolled back. Supabase's
security and performance advisors returned no findings.

The public project URL/key are configured in Vercel Production and Development,
and on the `feat/supabase-accounts` preview branch. `PUBLIC_AUTH_PROVIDERS` is empty
until provider credentials are completed. Production and localhost redirect URLs
are configured. The UI shows a setup notice instead of offering broken sign-in buttons. Set it to `github`,
`google`, or the enabled comma-separated list after configuring the provider,
then rebuild. Other preview branches are not given account configuration.
Project URL: `https://vpirgetchbflxwrwjgzm.supabase.co`.

Migration filenames match the hosted versions `20261103140311` (accounts) and
`20261103195258` (practice plan). The original accounts filename had a different
creation timestamp; it is renamed without changing its SQL to match the already
applied hosted migration. Do not rerun either applied migration.

## One-time setup

1. Create a **Free** Supabase project in your chosen organization. No paid add-ons,
   development branches or compute upgrades are needed.
2. Apply migrations in `supabase/migrations/` in timestamp order through your linked
   Supabase migration workflow. Existing projects need only unapplied migrations;
   do not rerun the original account table migration.
3. In **Authentication → Sign In / Providers**, enable Google, GitHub and/or Discord.
   Register an OAuth application with each selected provider. Set its callback to
   the exact callback URL shown by Supabase, normally
   `https://<project-ref>.supabase.co/auth/v1/callback`. Keep client secrets only in
   Supabase's provider configuration. Disable email sign-up if you want social only.
4. In **Authentication → URL Configuration**, set the Site URL to
   `https://riftscry.vercel.app` and allow these exact redirect URLs:
   - `https://riftscry.vercel.app/auth/callback`
   - `http://localhost:4321/auth/callback` for local development
   - Your selected preview origin plus `/auth/callback`, if testing a preview
5. Copy `.env.example` to `.env.local`, and set the same public values in the
   appropriate Vercel environment. Redeploy after changing these build-time values:

   | Variable | Value |
   | --- | --- |
   | `PUBLIC_SUPABASE_URL` | Project API URL from Supabase Connect |
   | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Enabled `sb_publishable_…` key |
   | `PUBLIC_AUTH_PROVIDERS` | Comma-separated enabled providers, e.g. `google,github,discord` |

Never use a secret key or a service-role key in a public environment variable.
The social provider's callback is Supabase's URL; the application's allowed
redirect is RiftScry's `/auth/callback`. They are different URLs.

Visit `/account`, choose a provider, and sign in. First sign-in creates the account.
Returning sign-ins use the same managed identity. Account settings are available
from both navigation systems. Missing Supabase settings retain guest mode without
breaking the archive, notebook or existing browser data.

## What follows the account

| Existing feature | Signed-in behavior |
| --- | --- |
| Champion pool | Private synchronized selection |
| Notebook | Notes, saved loadouts, cards and reflections sync together |
| Build Memory | Separate records per selected Riot player inside the RiftScry account |
| Momentum | Bounded progress records sync per selected Riot player |
| Saved findings | Private synchronized findings |
| Player shortcuts | Most recent/legacy remembered player syncs |
| Reading continuity | Reviewed patch, resume position and focused signal sync |
| Personal practice plan | Display name, preferred role, custom focus and up to 8 self-tracked goals sync privately |
| Theme and reduced motion | Stay on this device |
| Riot response caches, temporary navigation and AI responses | Do not sync |

Selecting a Riot ID is a shortcut, **not verified Riot account linking**. Existing
Riot API approval, deployment protection, request budgets, Redis caching and AI
opt-in rules remain in force. Social auth does not bypass these rules or make
existing paid AI/Redis usage free.

## AI access and personal practice

AI analysis requires a signed-in, non-anonymous RiftScry account. The review API
verifies the bearer access token using Supabase Auth `getUser` before any Riot,
metadata, cache or AI work. Missing/invalid sessions return 401; unavailable Auth
or missing server configuration fails closed with 503. Existing same-origin POST,
Riot deployment gates and IP limits remain enforced; AI generation also has a
verified-account budget. Tokens and AI responses are never included in workspace
exports or persisted in the player response cache. Supabase manages its own session
storage. Concurrent AI POST responses are not deduplicated across identities.

Guests retain recorded summaries, deterministic item comparisons, timelines and
all existing guest notebook features. Match sign-in links carry a validated local
return destination; OAuth still uses the fixed `/auth/callback`. No AI request
starts automatically after sign-in. A rejected session opens explicit reauthentication
controls; **Reconnect account** also remains available when pending edits prevent
sign-out. Reauthentication preserves the local outbox. Provider credentials remain a prerequisite:
when `PUBLIC_AUTH_PROVIDERS` is empty, the account page explains that setup is
pending and offers guest access.

Account includes getting-started links and a personal practice plan. Display names
are up to 40 characters, focus up to 240, and up to 8 goals of 180 characters each.
The plan appears on the automatic briefing with checkboxes and a next-session
reset. The preferred role is a personal label, not a filter on recorded evidence.
These are user-authored intentions and manually checked goals, never an inferred
performance score or AI advice. Unsaved profile edits cannot silently replace
preferences that changed in another tab. Cloud conflicts use the existing account
resolution flow. The dedicated record is additionally capped at 8 KB in Postgres.

## Existing data and sync behavior

- Guests keep their original browser keys. Signing in never silently uploads them.
- **Import this browser's data** copies categories that do not already exist in the
  account. Existing account categories win. Guest originals remain untouched.
- To combine two existing notebooks, export from the guest notebook, sign in, then
  use the notebook's existing additive backup import. The account-wide export is
  a recovery archive, not a notebook import file.
- Each account has a separate local cache and durable outbox. Successful writes
  are marked synced only after Supabase acknowledges them. Offline changes survive
  navigation/reload and retry on focus, reconnect or **Retry sync**.
- Foreground/focus refresh pulls other devices' data. There is no constant polling
  or paid Realtime requirement. Open pages refresh when focused again.
- Each record carries a server revision. If another device edited the same record,
  both versions are retained locally and `/account` asks which to keep. The export
  contains both versions. Conflict resolution never silently merges note text.
- Signing out first flushes pending writes and refuses to discard unsynced edits.
  After successful sign-out the account cache is removed and guest data returns.
  Other tabs reload on session changes so stale React forms cannot cross accounts.
- Personal data requires browser storage. A failed/corrupt cache is retained and
  errors are shown; it is not silently replaced with an empty cloud record.

## Database boundary

`account_records` has `(user_id, record_key)` as its primary key and an FK to
`auth.users` with cascading deletion. RLS permits an authenticated user to read
only their own rows. Anonymous users have no access. Clients cannot insert,
update, transfer ownership or delete rows directly.

`save_account_record` is the exposed invoker RPC. Its private definer implementation
gets ownership exclusively from `auth.uid()`, validates keys and JSON, serializes
per-user writes, checks quotas and performs a revision compare-and-swap. The
private function uses an empty search path and explicit grants; it cannot accept
an arbitrary owner ID. The project must expose `public`, not `riftscry_private`.
The migration explicitly grants table reads, since new Supabase projects may not
automatically expose SQL-created tables.

Limits: 200 record categories/player records per account, 2 MB per record and 4 MB
of logical values per account. Notebook and Build Memory keep their tighter existing
limits. Null values are tombstones so a deleted record retains conflict history.
These caps constrain per-user growth; they do not guarantee unlimited free usage.

## Free tier and operations

Verified against Supabase's pricing on 2026-11-03: Free includes 50,000 monthly active
users, a 500 MB database, 5 GB egress and 1 GB file storage. Free projects may pause
after a week of inactivity, and there is a limit of two active free projects.
This implementation uses Auth and Database only, and does not enable a paid plan.
Database row/index overhead counts toward the project quota. Monitor project usage
before inviting many users. OAuth providers also require one-time app registration.

Sources: [Supabase pricing](https://supabase.com/pricing),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Verification

```bash
pnpm check
pnpm test
pnpm build
pnpm exec playwright test --config=playwright.accounts.config.ts
```

The database suite executes all actual migrations in PGlite/Postgres with isolated test
identities. It checks anonymous denial, RLS isolation, forbidden direct writes,
revision conflicts, malformed records, quotas and cascade deletion. Browser tests
use the actual Supabase SDK against deterministic mocked Auth/Data API responses
for PKCE handoff, guest migration, cross-device hydration, sign-out, account
isolation, offline recovery, conflict resolution, practice-plan persistence and
account-gated AI. The real local API is also tested for anonymous denial. Auth unit
tests use the real SDK with controlled Auth responses to verify failures and identity checks.

After configuring the hosted project, also run a real provider round trip and use
two real test accounts to verify cloud saves from a second browser. Mocked browser
tests cannot validate OAuth credentials, redirect allowlists or project settings.
