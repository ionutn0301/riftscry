# All-champion artwork coverage

Audited 2 November 2026. This research supports the
[Rift Cinema design](README.md); it is not a claim that an all-champion cinematic
implementation has shipped.

## Conclusion

RiftScry can provide a coherent cinematic presentation for **all 173 champions
in its current catalogue using official splash art**. Equivalent transparent
foreground figures are available for a smaller curated set. No complete official
transparent-figure collection was verified in this audit.

The production baseline should therefore be a complete official illustration
with deliberate framing, typography, camera movement and evidence controls.
Approved transparent foregrounds can enhance particular champions. Do not label
ordinary JPG splashes, circular portraits or cropped icons as character cutouts.

## Verified repository and official-catalogue coverage

| Check | Result |
| --- | --- |
| [Repository champion catalogue](../../src/data/champions.json) | 173 canonical IDs; asset version `16.21.1` |
| [Live official catalogue](https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/champion.json) | 173 IDs; exact match to the repository, with no missing or extra IDs |
| [Existing artwork manifest](../../src/data/artwork-manifest.json) | 173 matching entries, each with splash, loading portrait and icon URLs |
| [Approved cinematic foreground manifest](../../public/images/rift-cinema/asset-manifest.json) | Akali, Yasuo and Thresh: three locally inspected official transparent PNGs |
| Current foreground gap | 170 catalogue members do not have an approved local cinematic foreground |

This verifies metadata and URL coverage, **not a fresh successful download of
every artwork file**. The existing general artwork manifest has its own recorded
generation date/version; the catalogue comparison above used official
`16.21.1` metadata. The research did not download all champion images.

[Riot's Data Dragon documentation](https://developer.riotgames.com/docs/lol#data-dragon)
describes champion metadata and the splash, loading-screen and square-image
formats. Canonical IDs must come from the catalogue rather than display-name
guesses. Base-skin examples follow these documented conventions:

```text
https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg
https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg
https://ddragon.leagueoflegends.com/cdn/16.21.1/img/champion/Aatrox.png
```

The `_0` selects the base skin. Riot notes that not every skin/chroma metadata
entry has a separate splash. Data Dragon releases can also lag game patches;
use the published catalogue/version, not an assumed live-game version.

## Official homepage figures: six curated entries

The [official League homepage](https://www.leagueoflegends.com/en-us/) embeds six
1628 × 1628 PNG entries in its “Choose your champion” section. These are a
curated role showcase, not a documented endpoint for the whole roster.

| Champion | Exact original asset | Audit status |
| --- | --- | --- |
| Akali | [Riot PNG](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/befd42ad6d2564159a441d08cfc3bf511532eb74-1628x1628.png?accountingTag=LoL) | Locally inspected and used; original thin ring included |
| Yasuo | [Riot PNG](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/70c26e49de8a2c79ac3de144772d2debd195edff-1628x1628.png?accountingTag=LoL) | Locally inspected and used; original painted wind included |
| Lux | [Riot PNG](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/ff6c8c57411e5c7e0551b02334fccedc78866143-1628x1628.png?accountingTag=LoL) | Metadata candidate; visual/alpha approval pending |
| Jinx | [Riot PNG](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/f136500bd46f823d37515a72b867425d3a0b3e54-1628x1628.png?accountingTag=LoL) | Metadata candidate; visual/alpha approval pending |
| Thresh | [Riot PNG](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/dbdded937cd214bb2a1189697a9e4f49f8c04505-1628x1628.png?accountingTag=LoL) | Locally inspected and used; original ring/spectral effects included |
| Leona | [Riot PNG](https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/95daf6dd2b28f03d5ba2ea1fabbabc3bc3ff6e6e-1628x1628.png?accountingTag=LoL) | Metadata candidate; visual/alpha approval pending |

Representative official champion pages—[Aatrox](https://www.leagueoflegends.com/en-us/champions/aatrox/),
[Ahri](https://www.leagueoflegends.com/en-us/champions/ahri/) and
[Yunara](https://www.leagueoflegends.com/en-us/champions/yunara/)—use Data Dragon
splashes and ability assets. The inspected structured page data for Aatrox and
Yunara did not expose a general transparent-figure asset. This sample does not
prove that no other official marketing cutouts exist.

## Official champion package: directory findings

Riot's [Downloads page](https://www.leagueoflegends.com/en-us/league-of-legends-downloads/)
lists `Champion_Assets_Package.zip` as 940.2 MB. Its
[exact CDN archive](https://cmsassets.rgpub.io/sanity/files/dsfx7636/news/49a9001b73968d98f8f31247363d11e9b6ff1063.zip)
reported **962,801,942 bytes** and supported byte ranges. Its outer directory
contains two meaningful nested ZIPs, one directory entry and two macOS metadata
entries.

`Champion_Assets_Package/Individual_Files.zip` contains exactly these five files:

```text
Individual_Files/LOL_KA21_VI.psd
Individual_Files/LOL_KA21_SENNA.psd
Individual_Files/LOL_KA21_LULU.psd
Individual_Files/LOL_KA21_YASUO.psd
Individual_Files/LOL_KA21_VOLIBEAR.psd
```

`Champion_Assets_Package/LOL_Key_Art_2021.zip` contains exactly these two files:

```text
LOL_Key_Art_2021/LOL_KA21_8997x9699_Myan_v004.jpg
LOL_Key_Art_2021/LOL_Key Art 2021_8997x9699.psd
```

The listing establishes five individual PSD candidates and a composite key-art
JPG/PSD, not an all-champion image folder. **The PSDs were not opened: their layer
structure, transparency and suitability remain unverified.** The full archive
was not downloaded.

### Metadata audit method

1. Compare canonical-ID sets from the repository catalogue, general artwork
   manifest and official `16.21.1` JSON; separately count locally approved figures.
2. Read official page `__NEXT_DATA__` image entries to identify source URLs and
   dimensions. Do not infer cutout quality solely from `.png` or an alpha channel.
3. Read the package's HTTP headers, then request these bounded byte ranges:
   `962736385–962801941`, `962538275–962800418`, and `762103607–762365750`.
   Total archive bytes transferred: **589,845**.
4. Parse the outer ZIP end record and central directory. For each nested archive,
   decode its bounded final DEFLATE segment and parse its end record/central
   directory; the listed entry counts are five and two. No PSD pixels or layers
   were extracted or approved by this process.

## CommunityDragon's role

[CommunityDragon's own asset documentation](https://communitydragon.org/docs/assets)
lists splash art, square/round portraits, loading screens, chroma appearances,
ability videos and other game/client assets. It warns that paths can change and
directs consumers to champion JSON for the actual paths.

For example, [Aatrox's base-skin metadata](https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/266.json)
has JPG splash/loading paths and null chroma/video fields. Other skins can have
chroma-image paths; this is not evidence of complete premium base-champion
foreground coverage. No such complete collection was established here.

CommunityDragon is an independent archive of Riot-owned assets, as its
[project notice](https://www.communitydragon.org/) explains. It does not provide
an additional license or Riot endorsement. Prefer official static data and
press assets when available, retain provenance, and preserve the application's
Riot notices under the applicable
[developer policies](https://developer.riotgames.com/docs/lol) and
[Riot IP policy](https://www.riotgames.com/en/legal).

## Recommended authored asset pipeline

1. **Complete baseline:** resolve official base splash/loading/icon assets for
   every canonical ID. Retain complete source art; art-direct desktop and narrow
   compositions with reviewed focal points, readable text and intentional crops.
2. **Optional enhancement:** record an approved foreground only after inspecting
   the official original, alpha edges, visible anatomy and composition. Keep
   source URL, transformation history, dimensions and approval status in the
   manifest. Missing foregrounds remain absent; do not fabricate a cutout.
3. **Consistent experience:** use the same typography, camera language, selection
   behavior and evidence controls for full-illustration and layered variants.
   Atmosphere complements recognizable art rather than disguising poor edges.
4. **Bounded loading:** request selected artwork and limited likely-next assets.
   Do not preload the full roster. Image failure must retain identity, records
   and direct navigation.
5. **Review before expansion:** inspect representative small/large, humanoid and
   non-humanoid champions on desktop and mobile. Full-roster support is not a
   claim that every composition already has bespoke art direction.

This is a reviewable production plan, not a promise that bulk cutout production
or asset approval is complete.

## Data guard when expanding homepage selection

The current three-champion entrance assumes a numeric record exists. A read-only
audit of the **21 committed patch files** found **30 champions with no archived
ability-change records**, and **33 with no numeric record**. The additional three
are **Taric, Twisted Fate and Zilean**, whose available records are prose-only.
Leona and Lulu are examples with candidate official artwork but no record in
this committed interval.

An all-champion selector must support prose evidence and a truthful “no direct
change recorded in this archive” or history state. It must not reuse the current
numeric-record non-null assertion for every champion, invent a change, or
describe an empty archive interval as proof that a champion was unaffected by
the wider game. These counts concern this committed archive, not all League
history.
