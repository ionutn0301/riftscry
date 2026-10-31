# Signal journey verification

This report describes the October 30 implementation on `feat/rift-signal-journey`.
The baseline was `ce1ce5f4d04217179feb7ef774dd31be9c6957f1`.

## Local checks

| Check | Result |
| --- | --- |
| Astro / TypeScript | 247 files checked; zero errors, warnings or hints |
| Unit and DOM integration suite | 52 files, 519 tests passed |
| Production Astro / Vercel build | Passed, including static archive routes and server bundles |
| Browser test discovery | General suite: 657 configured cases; player suite: 105 cases |
| Diff whitespace validation | Passed |

Browser test discovery confirms registration and imports; it is not browser
execution. The first CI run for PR #55 (41100849150) remained queued with no
runner or test steps assigned after publication; GitHub reported no failure
annotation. Browser acceptance remains pending. The current workflow runs both browser suites and uploads current
screenshots as `signal-journey` and `player-experience` artifacts.

The first concurrent unit/build run hit the existing five-second timeout on the
exhaustive voyage interval test. That test passed alone, and the full unit suite
passed when run without the simultaneous build. No assertion or timeout was
weakened to hide the failure.

The six follow-up homepage DOM regressions reproduce cold reload, arrival Back,
retained intervals for the same champion, public-context changes and clearing,
and explicit reveal/carry entry. The canonical opening query changes presentation
without overwriting an earlier exact record.

## Acceptance stories

- A newcomer reveals a real archive change, focuses either exact value, keeps
  the finding explicitly, opens it in Saved and restores it with browser Back.
- A returning visitor resumes a valid player or a prior champion record without
  a homepage API request or an unsolicited saved finding/reviewed baseline.
- Champion history, patch subjects and comparisons retain canonical subject,
  exact record fragment, explicit interval and query scope across selection,
  reload and Back. Empty scope and missing artwork have usable recovery paths.
- A selected player or match leads into the briefing without another lookup.
  A recorded loadout can be kept directly; a generated adjustment opens ready
  to save, with editable details available on demand.
- Keyboard and touch controls retain meaningful names, hidden scenes are inert,
  and source records remain readable with reduced motion or no JavaScript.
- Short screens, long identities, unavailable storage, partial imports, failures
  and retry actions remain part of the same scene structure.

## Visual access and deployment

The managed local preview service could not start because its preview daemon
mailbox was unavailable. The existing deployment requires Vercel authentication.
An attempt to use the supported Vercel access tool was rejected by automatic
approval review because it would create or reuse a shareable access link. No
deployment-protection bypass or shareable access link was created.

Current CI screenshots and browser results must be inspected before claiming
visual acceptance. Historical screenshots in earlier release folders describe
older implementations. Fixture-based player captures do not verify live Riot
service credentials or a real player's history.

## Measured cleanup

The seven retired shared presentation styles totalled 153,269 bytes of source.
The replacement shared shell is 21,181 source bytes at this checkpoint. Those
figures are source-file sizes, not transferred bundle sizes or runtime benchmarks.
The cleanup also removes five unused graphics dependencies and 88 retired files.
Removing already-unreachable code does not itself imply faster page loads.
