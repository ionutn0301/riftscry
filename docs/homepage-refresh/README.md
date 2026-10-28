# Homepage refresh

The homepage now leads with **“The Rift changes. You’re ready.”** It gives first-time
visitors a tangible example of RiftScry's archive and gives everyday visitors a direct
launch path for the player they already selected. The automatic briefing remains the
primary product action.

## Experience changes

The earlier homepage repeated its briefing description in several sections and appended
a small returning-player shortcut beneath the public actions. The new layout uses one
hero, a real before/after example, three familiar between-game tasks, and a separate
invitation to explore the archive.

| Visitor | Homepage behavior |
| --- | --- |
| Newcomer | **Get my briefing** opens the automatic lookup; **Find my games** opens player lookup. The archive preview works before entering an identity. |
| Returning player | The selected Riot ID and server become a prominent launcher with **Open my briefing**, **My matches**, **My builds**, **Catch up**, and **Change player**. |
| No valid stored identity or blocked storage | The public newcomer actions remain usable. Invalid stored values are not used for player links. |
| Another tab changes the player | Validated identity events update the launcher and all explicit-player destinations. |

The three everyday paths answer “What did I miss?”, “That build felt good”, and
“Okay. One more.” They lead to existing automatic catch-up, recorded builds, and
the next-game briefing. No new notes, cards, champion-pool authoring, or setup document
is required. The archive section retains direct exploration, champion browsing, and the
latest **archived** patch with its recorded date.

The visual treatment uses the existing Rift artwork, large display type, restrained
teal and brass accents, and small code-drawn illustrations. The content remains normal
document flow: the design introduces no carousel, scroll lock, or nested scrolling panel.

## Real examples, with their sources

`src/lib/home-signals.ts` selects up to three distinct, known champions from committed
patch data. It prefers compact numeric records and a mix of available buff, nerf and
neutral directions. Patch IDs are ordered numerically, so `26.21` precedes `26.9`.
If a newer patch cannot supply three eligible champions, older records fill the gap
without replacing a champion already selected from a newer patch.

Each example retains its exact before/after values, ability, metric label, champion
classification, patch ID and Riot source URL. Its **Read the full record** link reaches
the matching champion anchor on that patch page. **Riot’s notes** opens the original
source. Unknown champions and unchanged values are omitted; the selector does not
invent an example to fill an empty slot.

The panel explicitly says **From the archive**, **Latest archived patch**, and **An
archive example**. Archive freshness and a selected player's personal report are
different things. The homepage makes no claim that its examples came from the visitor's
games or that the newest committed entry is necessarily the current live patch.

## Interaction and data boundaries

- The homepage makes **zero `/api/player/*` requests**. Returning identity comes from
  the existing validated recent-player helper, including its legacy fallback.
- Public actions and the first complete archive example are server-rendered. Without
  JavaScript, the example's source links still work and the inactive switcher buttons
  remain disabled.
- The example switcher has explicit tab/panel relationships, a single active tab stop,
  and Arrow Left/Right, Home and End navigation. Switching examples changes no route
  or player state, and examples never rotate automatically.
- Homepage transitions respect both the operating system's reduced-motion preference
  and RiftScry's saved motion setting.
- Existing shared journey links still redirect from `/` to `/explore` with champion,
  patch, interval and saved reading-position information preserved.
- The seven-destination Rift map retains its existing focus return and responsive
  navigation behavior.

## Responsive and focused verification

The visual audit covered newcomer layouts at **320, 390, 768, 1440 and 1920 pixels**
wide, plus the returning-player state at **390 pixels**. Those six inspected contexts
showed no horizontal overflow, page errors, or homepage player API requests. The mobile
layout keeps the launcher and examples in one vertical reading order; long identities
wrap inside their own container.

The primary newcomer action is fully visible at 320×568. At 390×844, the first
example's before/after values are also fully visible before scrolling. Interactive
targets retain at least 44px height; the homepage has one normal document scroll.

Completed local release checks:

| Check | Result |
| --- | --- |
| Typecheck | 248 files; 0 errors, 0 warnings, 2 existing hints |
| Full unit suite | 461 tests passed across 47 files |
| Production build | Passed |
| Homepage Chromium scenarios against the production build | 30 executions passed |
| Homepage → player lookup integration | 1 passed |
| Archive-example unit tests | 3 passed |

Browser coverage includes newcomer and returning states, source-backed examples,
keyboard selection, no-JavaScript entry, storage failures and updates, legacy archive
links, reduced motion, and the map at narrow and short viewports. Unit checks cover
archive provenance, sparse-patch fallback, unique champions, unchanged/unknown records,
and input immutability.

The final source-specific selector checks also passed after strict TypeScript guards
were added. The full cross-browser CI and deployment verification results are recorded
in the release PR after they complete.

## Reviewed views

| View | Capture |
| --- | --- |
| Desktop homepage | [home-1440.webp](after/home-1440.webp) |
| Mobile homepage | [home-390.webp](after/home-390.webp) |
| Returning player on mobile | [return-390.webp](after/return-390.webp) |
| Desktop page overview | [overview-1440.webp](after/overview-1440.webp) |

The previous homepage captures remain in the
[automatic briefing audit](../automatic-briefing/README.md) for comparison.
