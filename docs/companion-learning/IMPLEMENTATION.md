# Second implementation pass

4 November 2026. Continues the recommendations in [AUDIT.md](AUDIT.md).
Implementation is on `feat/clearer-companion-build-learning` in
[PR #78](https://github.com/ionutn0301/riftscry/pull/78). Use that PR's latest checks,
merge state and deployment status as the current release record.

## Delivered

| Audit priority | Implemented behavior | Boundary |
| --- | --- | --- |
| P1: returning-player catch-up | `/catch-up`: select any champion and last played patch; show subsequent numeric and prose changes, recorded targeted hotfixes, source links and wider item/system updates. | Only ingested records. Baseline excluded; pre-archive or missing intervals explicitly partial. Unknown links rejected instead of clamped. |
| P1: freshness and source accuracy | Ingested official 26.22 and refreshed the identity catalog to 16.22.1. Fixed numeric paragraphs missing from parser/coverage counts. Reviewed Mel, Zaahen and Overlord’s Bloodmail overrides. | Source review is still necessary; unknown formulas stay neutral rather than acquiring invented impact scores. |
| P1: build tradeoffs | Six supported boot IDs plus the Deathcap/Hourglass/Veil family. Explicit opt-in alternative selection, side-by-side listed stats, shop-price difference, passive description and a contextual question. | Exact match patch, standard SR modes, eligible purchasable unrestricted items only. Unlisted stats remain unknown; no whole-build damage, best-item ranking or sell/replace-cost claim. |
| P1: context-specific progress | Added comparison-group, metric, sample and exclusion explanations, including support and ARAM behavior. | Existing Momentum computation, personal baseline and persistence are unchanged. |
| P2: champion learning pilot | `/learn` and three practice cards for Garen, Lux and Ashe. Each has a sourced mechanic, authored exercise, one cue, one review question and Notebook handoff. | Not expert-reviewed coaching or matchup recommendations. Later direct champion records automatically trigger a review-needed notice. |
| Discovery and UX | Guide task shortcuts, champion-page links and searchable task destinations. New flows use native forms, links and disclosures with keyboard focus and small-screen layouts. | Geometry and browser interaction still require CI/cloud-preview verification. |

The new returning flow is server-rendered from committed data and works without
JavaScript. It adds no API request to Riot, sign-in requirement, tracking, local
storage schema or runtime package. Existing shared item metadata powers item
comparisons. Practice cards are statically generated and use existing artwork.
Notebook links preserve champion context; they do not silently save a note or
prepopulate a takeaway.

## Reviewed sources and corrections

- [Official 26.22 notes](https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-22-notes/), dated 3 November 2026.
  The parser now retains Locke’s maximum stack damage, Rumble’s maximum AP ratio
  and Overlord’s Retribution paragraph. Zaahen’s cooldown before/after spans two
  separate list items and is corrected with an explicit override. Mel’s W
  overhaul is classified as a rework. Coverage is in `docs/coverage/26.22.json`.
- [Riot 16.22.1 item catalog](https://ddragon.leagueoflegends.com/cdn/16.22.1/data/en_US/item.json)
  confirms the reviewed comparison identities and reference properties. Actual
  in-app values come from each match’s own compatible historical catalog.
- Champion mechanics checked 4 November: [Garen](https://www.leagueoflegends.com/en-us/champions/garen/),
  [Lux](https://www.leagueoflegends.com/en-us/champions/lux/),
  [Ashe](https://www.leagueoflegends.com/en-us/champions/ashe/).
  Practice prompts are original editorial suggestions; they do not claim to be
  advice Riot published. Review cards after champion changes before extending
  `reviewedThrough`; source dates are explicit in the UI.

26.22 item headings use hashed CMS images without explicit item IDs. They have
not been added to the stricter personal item-identity supplement. The returning
catch-up and general patch archive show those item entries, while automatic
personal item matching remains restricted to verified identities.

## What still needs a separate investment

The audit did not recommend immediately building native overlays, automatic
video clipping or a universal adaptive-build engine. Those are still absent;
a browser timeline review is not a video replay. A broad matchup library needs
expert review and ongoing patch ownership. These are not represented as shipped.

The next evidence gate is the planned 5–8-player usability study and browser
verification at 320/390/1440px, with keyboard, history, no-JavaScript and retry
paths. Retention and competitor superiority have not been measured. The return
loop uses saved progress and useful learning, without pressure streaks.

See [VALIDATION.md](VALIDATION.md) for executed checks and the publication blocker.
