# AI-led companion research and implementation

Research date: 4 November 2026. These are qualitative product signals, not a representative player survey. Votes, personal anecdotes and vendor claims do not establish measured effectiveness.

## What players ask for

| Signal | Source | Product response |
| --- | --- | --- |
| Players distrust generic AI recommendations and confident claims that a different decision would have won a fight. | [League community discussion, May 2025](https://www.reddit.com/r/leagueoflegends/comments/1kp245i/ive_noticed_so_many_slopware_ai_powered_league/) | Use recorded match events and patch facts, link every explanation to evidence, and reject fabricated references or quantitative claims. Label interpretations and fallbacks. |
| Reading a patch number is easier than understanding what it means in a game. | [Summoner School patch interpretation discussion](https://www.reddit.com/r/summonerschool/comments/lg9ao1) | Explain the latest archived changes for the selected champion: recorded change, tentative implication, one thing to notice. Show the patch date and official source. |
| Trying to improve everything at once is overwhelming. | [Summoner School one-focus discussion](https://www.reddit.com/r/summonerschool/comments/ks8k33) | One automatic focus. Separate patch and post-game topics into tabs. Hide supporting details until requested. Remove manual goal and checklist controls. |
| Players report frustration with resource-heavy companion apps and advertising. | [Companion app discussion](https://www.reddit.com/r/leagueoflegends/comments/11pc3ik), [Blitz user report, January 2026](https://www.reddit.com/r/BlitzApp/comments/1q8lzji/why_is_blitzexe_using_110_gb_of_data_on_my_pc/) | Keep this release in the browser without another client, popups or a live overlay. Reuse cached AI output and avoid regeneration on unchanged background refreshes. |

## Market position

[Mobalytics](https://mobalytics.gg/lol/glp/app-download) advertises imports, scouting, matchup assistance, live insights and post-game analysis. This is vendor-described capability, not independent validation. RiftScry should not try to win by presenting more panels. Its narrower advantage is an understandable, source-linked explanation of **your recent game and your champion's patch**, with one next step and optional follow-up questions.

## Implementation plan and shipped scope

1. Restore the original full-screen world and the approved Akali/Yasuo/Thresh foreground assets. Retain those defaults when equivalent personal-champion assets are unavailable. This was merged separately in PR #83.
2. Consolidate model selection, structured generation, timeout and evidence checks into a shared server module used by the existing match review and the new coach.
3. Add an authenticated, same-origin coach endpoint. Build evidence server-side from at most three imported matches, optional timeline/item data and the latest local patch archive. Keep different modes, champions, roles and patches separate. Preserve upstream and per-account generation limits; cache interpretations for a day, keyed by evidence, patch, model and question.
4. Automatically generate a briefing once the import settles. Present **Next game**, **Latest patch**, and **Last game** as three topics with only one visible at a time. Offer a bounded follow-up question and a quiet focus view. Keep recorded details available below a disclosure.
5. Remove manual goals, checklist editing and the practice-plan navigation entry. Preserve legacy records in account exports rather than silently deleting user data. Profile name and preferred role remain editable.
6. Verify reference/number rejection, missing-data fallback, authentication, quota metadata, account changes and refresh behavior in tests. Exercise signed-in browser flows and capture phone/tablet/desktop layouts. Merge after checks pass.

The detailed match page retains an optional deeper AI review: opening it does not automatically spend a second generation allowance after the coach has already summarized the game.

## What the coach can and cannot conclude

The server supplies facts, never accepts browser-authored evidence, and omits player identifiers from model evidence. Model-written links are not used. Numeric and citation checks reduce fabricated detail; they do not prove that an interpretation is correct. Small samples do not establish a recurring weakness. Final inventory does not establish purchase order. A death event does not establish its cause. Missing direct champion changes do not imply that item, system or opponent changes have no effect.

If the model, response validation or provider fails, the UI says **Recorded facts** and offers a retry. It does not present a rule-based fallback as AI. Authentication and quota failures preserve their recovery states.

## Live-game boundary

[Riot's official developer documentation](https://developer.riotgames.com/docs/lol) describes game-integrity requirements and the local Live Client Data API. That API belongs to the player's running game at `127.0.0.1:2999`; a deployed website is not a native local companion. Products must respect Riot's restrictions on hidden information and dictating decisions. These requirements also apply to AI-generated recommendations.

This release therefore implements pre-game interpretation, post-game review and a quiet preparation view that can remain open. It does **not** claim to detect or analyze a live game. Real-time functionality is deferred until a compliant desktop architecture, permitted information scope and required Riot product approvals are established. The browser does not access game memory or bypass local security restrictions.

## Maintenance

Patch explanations use the latest **archived** patch, not a promise of real-time freshness. The ingestion workflow remains responsible for new patch data. Any future model change should run the evidence checks and behavioral fixtures, followed by a small human-reviewed live evaluation; mocked browser responses verify interface behavior, not model quality.
