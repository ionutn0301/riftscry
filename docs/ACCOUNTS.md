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
and on the `feat/supabase-accounts` preview branch. `PUBLIC_AUTH_PROVIDERS=google` selects Google as the only offered provider.
The app also checks the hosted Auth `/settings` endpoint and only renders a usable
button when `external.google` is true. Google is enabled and the owner confirmed a
successful real sign-in on 2026-11-04. Production and localhost redirect URLs are
configured. If the hosted provider is disabled later, the UI shows a setup notice
instead of offering a broken sign-in button. Changing the provider allowlist still requires a rebuild. Other preview branches are not given account configuration.
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
| Profile preferences | Display name and preferred role sync privately; legacy focus/goals are retained for export |
| Theme and reduced motion | Stay on this device |
| Riot response caches, temporary navigation and AI responses | Do not sync |

Selecting a Riot ID is a shortcut, **not verified Riot account linking**. Existing
Riot API approval, deployment protection, request budgets, Redis caching and AI
authorization rules remain in force. Social auth does not bypass these rules or make
existing paid AI/Redis usage free.

## AI access and profile preferences

AI analysis requires a signed-in, non-anonymous RiftScry account. The review and coach APIs
verify the bearer access token using Supabase Auth `getUser` before any Riot,
metadata, cache or AI work. Missing/invalid sessions return 401; unavailable Auth
or missing server configuration fails closed with 503. Existing same-origin POST,
Riot deployment gates and IP limits remain enforced; AI generation also has a
verified-account budget. Tokens and AI responses are never included in workspace
exports or persisted in the player response cache. Supabase manages its own session
storage. Concurrent AI POST responses are not deduplicated across identities.

Guests retain recorded summaries, deterministic item comparisons, timelines and
all existing guest notebook features. Match sign-in links carry a validated local
return destination; OAuth still uses the fixed `/auth/callback`. The signed-in briefing automatically requests a coach response after its match
import settles. A detailed match review still requires its explicit action. A rejected session opens explicit reauthentication
controls; **Reconnect account** also remains available when pending edits prevent
sign-out. Reauthentication preserves the local outbox. Provider credentials remain a prerequisite:
when the provider allowlist is empty, the hosted provider is disabled, or its settings
cannot be checked, the account page offers guest access and reports the setup or
connection status. Provider availability is checked again immediately before OAuth.

Account includes getting-started links and profile preferences. Display names
are up to 40 characters. The preferred role is a personal label, not a filter on
recorded evidence. The coach selects a focus automatically; manual goal, checklist
and focus controls have been removed. Legacy fields stay in the existing record
for export compatibility and are preserved when preferences change.
Unsaved profile edits cannot silently replace
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


## My profile and navigation

`/profile` is the private profile page. It includes the signed-in email, provider
labels read from Auth, editable display name/role and a saved Riot player shortcut. It uses the existing account record
and RLS boundary; this release needs no schema migration. No public user directory
or public profile URL is created. A late identity response is discarded after an
account switch. Provider names are display-only and never authorize AI or database
access.

Account is a persistent user-icon button in both headers, including the immersive
homepage. Account and My profile have explicit tabs. New sign-ins land on
`/profile` unless a validated match/reading destination was requested; the fixed
`/auth/callback` remains unchanged. The profile's Riot shortcut is explicitly a
saved lookup, not verified ownership.

## Google activation and future reconfiguration

Google sign-in is active. On 2026-11-04 the hosted provider was enabled, the app
reached the Google account chooser, and the owner confirmed a successful sign-in.
Credentials were not copied into the app or repository. The following steps are
retained for future reconfiguration; they are not pending setup work:

1. In [Google Auth Platform](https://console.cloud.google.com/auth/clients), select
   the intended project and create a **Web application** OAuth client. Configure
   the app's consent details and user access as appropriate for the release.
2. Add `https://riftscry.vercel.app` as the JavaScript origin, and this exact
   authorized redirect URI: `https://vpirgetchbflxwrwjgzm.supabase.co/auth/v1/callback`.
3. Save the client ID and client secret **only in Supabase → Authentication →
   Sign In / Providers → Google**, enable the provider and save. Never put the
   secret in the app, a public variable, git, or chat.
4. Reload `/account`, sign in with a real Google test account, and verify return
   to `/profile` (or the selected match), a synced preference from a second
   browser, and sign-out. Automated fixtures cannot prove the real consent flow.

The app requests only `openid email profile` and explicitly presents Google's
account chooser. It does not request Drive, Gmail, or offline Google API access.
The existing AI authorization boundary remains enforced on the server.

## Riot Sign On readiness

Riot Sign On (RSO) exists. Riot requires an approved production application and a
separately approved RSO client; a development/personal API key alone is insufficient.
This deployment has no RSO client configuration, so no Riot login/link button is
enabled and manually selected Riot IDs are never shown as verified identities.

After Riot grants access, evaluate a managed Supabase custom OIDC provider
(`custom:riot`) using the exact issuer, credentials, callback rules, scopes, and
client authentication method issued by Riot. Supabase supports custom OIDC providers
on the current Free plan. Compatibility and any email-optional behavior must be
verified with that issued client before enabling it. Preserve the existing Google
workspace by using authenticated identity linking for existing users. Never merge
accounts by Riot display name, tag, saved PUUID, or user-editable metadata. A verified
Riot connection must come from the authorized RSO identity/account response.

Sources: [Riot RSO requirements](https://support-developer.riotgames.com/hc/en-us/articles/22801670382739-RSO-Riot-Sign-On),
[League RSO integration](https://developer.riotgames.com/docs/lol#rso-integration),
[Supabase custom OAuth/OIDC](https://supabase.com/docs/guides/auth/custom-oauth-providers),
[Google provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).
