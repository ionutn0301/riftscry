# RiftScry voyage environments

These are original AI-generated environmental illustrations commissioned for the
RiftScry refactor on 27 October 2026. They depict abstract, noncanonical landscapes:
an overlook, exposed geological strata, and a quiet basin. They are not Riot Games
artwork, official locations, champion illustrations, or a reproduction of
Summoner's Rift. They do not carry Riot or League of Legends logos.

## Art direction and purpose

The environments belong to one visual world, with dark geological masses,
atmospheric depth, pale mineral light, and space for readable interface typography.
Each camera position has a distinct purpose in the journey:

- **Rift overlook:** the opening establishes a place and a route into the archive.
- **History strata:** the exposed layers support the transition from a champion's
  identity into dated historical records.
- **Return basin:** the quieter destination gives the personal briefing and a
  returning visitor's next action room to breathe.
- **Mobile overlook:** a separate portrait composition supports a full-screen
  mobile opening without forcing the desktop composition into a narrow crop.

These illustrations provide atmosphere and spatial continuity. Controls, source
records, labels, and navigation remain real HTML. An environmental illustration
does not stand in for evidence or imply a canonical in-game location.

Official champion names, icons, portraits, and splash art remain separate assets
from Riot's Data Dragon, subject to the applicable Riot policies. Do not replace
champion illustrations with generated approximations or destructive cutouts.

## Optimized deliverables

Converted with the existing Sharp installation to WebP at quality **86**, effort
**6**. The source dimensions and aspect ratios were retained. This pass changed
encoding only: no cropping, resizing, compositing, or art edits were performed.

| File | Dimensions | Bytes | KiB | Source PNG |
| --- | --- | ---: | ---: | --- |
| `rift-overlook.webp` | 1672 × 941 | 220,964 | 215.8 | `exec-5a8400e2-a95c-4bdb-bcc2-d565317047b3.png` |
| `history-strata.webp` | 1672 × 941 | 258,396 | 252.3 | `exec-a22e967c-e755-4244-a4d0-528aa8ce82a7.png` |
| `return-basin.webp` | 1672 × 941 | 201,394 | 196.7 | `exec-2fee1ac5-5a8f-43e8-a9e2-f9191345e282.png` |
| `rift-overlook-mobile.webp` | 941 × 1672 | 241,462 | 235.8 | `exec-0f6945f9-e24b-427e-8d2b-e437233319f7.png` |

All desktop illustrations are below 450 KB and the mobile illustration is below
250 KB, including when KB is interpreted as 1,000 bytes. Load the opening image
with appropriate priority; defer later environments until they are needed.
Select the portrait opening at mobile widths instead of loading both openings.

The original, unmodified PNG files are retained in the workspace at
`/workspace/scratch/ae33b5459228/generated_images/`. The source filename column
records each generated output's provenance. Keep those originals when migrating
or archiving the project.
