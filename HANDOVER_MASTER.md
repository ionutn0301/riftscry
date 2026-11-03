# RiftScry — master agent handover

Updated: 2026-11-03. Repository: [ionutn0301/riftscry](https://github.com/ionutn0301/riftscry).

## Start here

The latest request is to continue development, improve the first-use experience,
add personal functionality, and restrict AI analysis to signed-in users.

PR #77 is merged. The last verified main/production commit is
`9a910ea0b93560449d37256df737424304c2bdff`; CI run `41695519560` passed all 11 jobs.
Vercel production deployment `dpl_cbmJum4MZJK5MFLHVifnJJRHAFfa` was READY at that
commit. These observations precede the new changes below.

New implementation is on local branch `feat/account-personalization-ai-access`:
verified Supabase bearer sessions before all AI review work, guest sign-in links
that preserve the match, account-specific AI generation limits, and a private
practice plan with a display name, role, custom focus and up to eight manual goals.
Account includes first-use links; the briefing exposes the same checklist.
Recorded summaries, item comparisons, timelines and guest notebook features remain
available without an account. See [docs/ACCOUNTS.md](docs/ACCOUNTS.md).

**Release authorization:** the user explicitly approved publishing these changes
on `main` after the earlier automatic approval rejection. Use a normal fast-forward
push to `ionutn0301/riftscry` without rewriting remote history, then inspect GitHub
CI and the Vercel production deployment for the exact resulting main SHA. The local
checks below do not substitute for that release verification.

**Social login is still not activated.** The user authorized configuring Google
sign-in. Supabase dashboard authentication completed, and the Site URL is saved as
`https://riftscry.vercel.app`, with exact production and localhost callback URLs.
Google Cloud Console and its OAuth-client creation page were unavailable in the
browser, so OAuth client credentials could not be created. The Google provider
remains disabled; `PUBLIC_AUTH_PROVIDERS` is intentionally empty. Keep provider
secrets in Supabase and use the secure credential workflow, never chat or git.

## Next steps, in order

1. Publish the approved changes on `main` and verify the resulting release.
   Local type checks, unit/integration tests, production build, generated-route
   verification and a real local unauthenticated API test are covered. Browser
   tests are prepared but could not launch in this workspace: the standard download
   was truncated and a portable Chromium exited with SIGTRAP before opening pages.
   Inspect the account and player workflows in CI; capture and review desktop and
   390px screenshots before claiming complete visual verification.
2. Add branch-scoped public Supabase configuration to the new Vercel preview if
   needed; only the old accounts preview branch is currently configured. Keep the
   provider list empty until Google OAuth credentials are installed successfully.
3. Finish the Google OAuth client/provider setup. Supabase's provider callback is
   `https://vpirgetchbflxwrwjgzm.supabase.co/auth/v1/callback` (copy the exact value
   from the dashboard; the project ref is listed below). Add the exact chosen
   preview origin plus `/auth/callback` if testing a preview. No wildcard redirects.
4. Enable only configured providers in `PUBLIC_AUTH_PROVIDERS`, rebuild, and verify
   a real first sign-in/callback/sign-out round trip, two accounts, second-device
   sync, guest import, offline edits and conflicts. Mocked tests cannot validate
   OAuth credentials or a live provider's availability. Preserve deployment protection.

Both hosted migrations are applied. The source filenames now match the actual
hosted migration versions (`20261103140311` and `20261103195258`) so linked CLI
workflows do not mistake applied schema for pending migrations. Do not rerun the
initial table creation or create another project. Security and performance advisors
returned no findings after the practice-plan extension. Existing records are kept.

## Infrastructure and routing

| Resource | Identifier / state |
| --- | --- |
| Supabase project | `riftscry`, ref `vpirgetchbflxwrwjgzm`, Frankfurt `eu-central-1` |
| Supabase organization | `ionutn0301's Org`, ID `ldmybobswrglaxkvrpmx`; Free plan |
| Supabase API URL | `https://vpirgetchbflxwrwjgzm.supabase.co` |
| Initial applied migration | `supabase/migrations/20261103140311_account_workspaces.sql` |
| Practice plan migration | `supabase/migrations/20261103195258_personal_practice_plan.sql` |
| Vercel team | `ionutn0301s-projects`, ID `team_L6BlILw6401DMAX3LmdEfd9d` |
| Vercel project | `riftscry`, ID `prj_k5dcQpAhbwA78SgEzq62DZBuaLzC` |
| Production hostname | `riftscry.vercel.app` |
| Current local branch | `feat/account-personalization-ai-access` |
| Previous merged branch | `feat/supabase-accounts` |
| Verified preview build | Deployment `dpl_fxqQdb9F5bY5Knb35A79QArcotM9`, READY for application commit `91721a9ab14f55c93d8eb4ee62be8823e7ed950e` |
| Preview branch alias | `riftscry-git-feat-supabase-accounts-ionutn0301s-projects.vercel.app` |

`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and empty
`PUBLIC_AUTH_PROVIDERS` were set for Vercel Production/Development and branch-scoped
Preview for `feat/supabase-accounts`. Other preview branches were not configured.
Retrieve the publishable key from the connected project if needed; this handover
intentionally contains no credentials. Never expose a service-role/secret key.

The project was created with a quoted cost of $0, without paid add-ons. Free-tier
limits and inactivity pausing still apply; consult the dated pricing references in
`docs/ACCOUNTS.md` before promising ongoing free capacity. Existing Riot/Redis/AI
costs are separate from the new backend.

Vercel deployment protection remains enabled. The preview built successfully, but
the connector's preview-content/share-link calls reported unavailable access even
with the explicit team ID. No protection settings were weakened to work around it.
Use the appropriate authorized deployment access path if live preview QA is needed.

## What changed

| Feature | Account behavior |
| --- | --- |
| Champion pool | Private synchronized champion selection |
| Notebook | Notes, saved loadouts, cards, reflections, and existing notebook backups |
| Build Memory | Private records separated by Riot player inside the RiftScry account |
| Momentum | Bounded progress records per Riot player |
| Saved findings | Private synchronized kept records |
| Player shortcuts | Recent and legacy remembered player |
| Reading continuity | Reviewed patch, reading resume, and focused signal |
| Personal practice plan | Synced display name, preferred role, custom focus and manual checklist |
| Theme/motion preferences | Remain device-local |
| Riot API caches, temporary navigation, AI responses | Never uploaded by account sync |

An app account does **not** verify ownership of a selected Riot ID. Existing Riot
approval/access gates, server-only API credentials, Redis budgets/cache, explicit
AI opt-in, and bounded history imports remain intact.

### Storage and synchronization contract

- Guest records keep their original browser keys. Signing in does not silently
  import them. The Account page offers an explicit additive import.
- Import copies categories missing from the account. Existing categories, including
  tombstones, win. Guest originals remain unchanged. To merge two notebooks, use
  the notebook's existing merge-import format.
- Signed-in cache/outbox uses `riftscry:account:v1:<user-id>`. An allowlist limits
  which existing keys can be synced. Unresolved initial auth scope blocks personal
  writes; identity changes lock the scope and fully reload to discard stale forms.
- The local value and dirty flag are written atomically. Sync runs after edits,
  on focus, visibility restoration, and reconnect. There is no constant polling
  or paid Realtime dependency.
- Server revisions implement compare-and-swap. A stale write preserves both
  versions locally and asks the user which to keep; it does not silently merge text.
- Sign-out flushes and refuses to discard pending/conflicting edits. Successful
  sign-out clears the active account cache and restores the guest workspace.
- Workspace export is a recovery archive, including conflicting versions. It is
  **not** an importable notebook backup. The notebook has its own import/export.
- React consumers of `$account` use `useStore($account, { ssr: 'initial' })` so
  server-rendered disabled attributes hydrate correctly. Preserve this detail.

### Database boundary

`public.account_records` has a composite `(user_id, record_key)` primary key, an
`auth.users` foreign key with cascading deletion, RLS owner-only SELECT, and no
direct client INSERT/UPDATE/DELETE grants. Anonymous users cannot read or write it.

The public `save_account_record` wrapper invokes the private
`riftscry_private.save_account_record` implementation. Ownership comes exclusively
from `auth.uid()`. The function uses a fixed empty search path, explicit grants,
a per-user advisory transaction lock, JSON/key checks, quotas, and expected
revision checks. The private schema must not be exposed through the Data API.

Current caps: 200 records, 2 MB per value, 4 MB of logical values per user. Existing
feature-specific caps remain tighter where applicable. Null values act as
tombstones for revision/conflict history. This design constrains individual
growth; it does not promise unlimited free project storage.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/lib/account/storage.ts` | Scope, allowlisted adapter, account state, durable cache/outbox, quotas |
| `src/lib/account/server.ts` | Trusted Auth verification for every AI review request |
| `src/lib/account/practice-plan.ts` | Bounded custom preferences and checklist storage |
| `src/lib/account/client.ts` | Supabase SDK, PKCE/session lifecycle, cloud sync/import/sign-out/conflicts |
| `src/lib/account/sync.ts` | Pure reconciliation and acknowledgement logic |
| `src/lib/account/validation.ts` | Validate legacy guest records before import |
| `src/components/account/AccountPanel.tsx` | Account controls, export/import, sync errors/conflict actions |
| `src/components/account/SyncStatus.tsx` | Shared sync-status indicator |
| `src/pages/account.astro`, `src/pages/auth/callback.astro` | Account and OAuth-return routes |
| `src/layouts/Layout.astro`, `src/styles/account.css` | Shared bootstrap and presentation |
| `supabase/migrations/20261103140311_account_workspaces.sql` | Schema, RLS, RPC, grants, limits |
| `tests/account-e2e/accounts.spec.ts` | Actual SDK with deterministic mocked Auth/Data APIs |
| `tests/unit/account-database.test.ts` | Actual migration executed in PGlite/Postgres |
| `tests/unit/account-sync.test.ts`, `tests/unit/browser/account-storage.test.ts` | Reconciliation and storage isolation tests |

Existing personal-storage callers were adapted in the pool, companion notebook,
player identity, Build Memory, Momentum, findings, resume/signal utilities, and
their components/scripts. Do not introduce new direct `localStorage` calls for
account-owned records; use the adapter and extend its explicit key allowlist and
database validation together when necessary.

## Verification record and remaining CI work

The last verified main release (`9a910ea0b93560449d37256df737424304c2bdff`) passed
all 11 jobs in [CI run 252](https://github.com/ionutn0301/riftscry/actions/runs/41695519560).
The earlier PR #77 assertion failures and cancelled job are resolved on that commit.

The new local practice-plan/AI-access branch has these observed results:

| Check | Observed result |
| --- | --- |
| Typecheck | Pass; one pre-existing unused-import hint |
| Unit/integration/database suite | 713 tests, 69 files passed |
| Production build | Pass |
| Generated homepage/archive contracts | Pass; 624 generated pages |
| Real local review route | Guest and malformed bearer requests return 401 before Riot access; no-store response |
| Auth verification | Actual SDK with controlled Auth responses: valid, missing, malformed, expired/rejected, anonymous, unavailable and misconfigured cases |
| React interactions | AI opt-in, guest/expired gating, in-flight account change; checklist check/reset/remove, role save, account isolation and unsaved-preference conflict |
| Hosted migration | Practice-plan key and size bound applied; old records retained |
| Supabase advisors | No security or performance findings |
| Browser suites/screenshots | Prepared, not verified: browser download/launch failed before app pages opened |
| Main CI/deployment | Verify for the released main SHA; explicit main publication is now approved |
| Live Google OAuth | Not verified; provider credentials not installed |

Run the account/player browser suites in CI on the published main commit, and
review the captured 1440px/390px layouts. Old screenshots and CI runs do not verify
this branch. The browser tests use the real Supabase SDK with mocked Auth/Data API
responses; a real provider round trip still must be checked separately.

## Local setup and checks

Stack: Astro 7, React 19 islands, Nanostores, TypeScript, pnpm 11, Node >=22,
Vercel adapter. Added exact versions: `@supabase/supabase-js` 2.118.0 and
dev-only `@electric-sql/pglite` 0.5.14.

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
node scripts/verify-atlas.mjs
pnpm exec playwright install --with-deps chromium webkit
pnpm exec playwright test --config=playwright.accounts.config.ts
pnpm exec playwright test --config=playwright.player.config.ts
pnpm e2e
```

For the corrected player tests alone:

```bash
pnpm exec playwright test --config=playwright.player.config.ts player.spec.ts \
  --grep 'AI suggestion prefills|manual adjustments persist|material revision updates'
```

The account Playwright config uses a fake Supabase project and mock sessions; do
not replace them with production credentials. Its dev server uses localhost port
4325 and `ASTRO_DEV_BACKGROUND=1` to prevent Astro's agent-mode daemon detachment.
For normal development, follow `.env.example` and `pnpm dev`; only enable social
provider values after configuring the corresponding hosted provider.

The working checkout used during this task was
`/workspace/scratch/58b7bea679fd/riftscry`. Treat that as ephemeral; GitHub is the
durable source. An unrelated untracked temporary image under `public/story-review`
was left untouched and excluded from commits.

## Wider application context

The existing product has an immersive archive homepage, native route navigation,
automatic Riot-match briefings, patch catch-up/impact, player histories, match
review, Build Memory, Momentum, and an optional notebook. Preserve recorded
evidence versus personal notes, exact queue/patch/player scopes, accessible native
links, reduced-motion behavior, and the existing request budgets.

Useful reading:

- [Account setup and operations](docs/ACCOUNTS.md)
- [Product contract](PRODUCT.md) and [design contract](DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md) and [player release](docs/player-release.md)
- [Data provenance](docs/DATA.md) and [contributing checks](CONTRIBUTING.md)
- [First useful imported game](docs/first-result/README.md)
- [Momentum](docs/momentum/README.md)

Some historical architecture/release prose describes older homepage components or
browser-only behavior. The current route imports and account implementation take
precedence for present behavior. Inspect current code before extending an old design.

## Definition of completion for the next agent

The next release is complete when the merge and production deployment are confirmed,
the updated CI checks pass, a configured provider signs a real user into `/account`,
two real users remain isolated, cross-device saves work, and guest/offline data is
preserved. Update this file with that evidence and any remaining limitations.
