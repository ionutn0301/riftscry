import { parse as parseHtml, HTMLElement } from "node-html-parser";

/**
 * Parser for Riot's patch-notes HTML.
 *
 * Structure (verified against patch 26.16, 2026-08-21):
 *   <h2 id="patch-champions">Champions</h2>
 *   <div class="patch-change-block">
 *     <h3 class="change-title">Azir</h3>
 *     <blockquote class="context"><p>summary…</p></blockquote>
 *     <h4 class="change-detail-title ability-title">Q - Conquering Sands</h4>
 *     <ul><li><strong>Damage</strong>: 60 / 80 ⇒ <strong>75 / 95</strong></li></ul>
 *   </div>
 *
 * Only the Champions / Items / Runes / Systems sections are ingested; other
 * sections (ARAM, Arena, skins…) are skipped but counted in the report so
 * nothing is dropped silently.
 */

export type RawLine = { label: string; before?: string; after?: string; text?: string };
export type RawBlock = { header: string; lines: RawLine[] };
export type RawSection = { name: string; summary?: string; blocks: RawBlock[] };
export type RawPatch = { champions: RawSection[]; items: RawSection[]; systems: RawSection[] };
export type ParseReport = {
  championCount: number;
  arrowLines: number;
  proseLines: number;
  unparsedBlocks: string[];
  skippedSections: Record<string, number>;
};

const ARROW = "⇒";
/**
 * Champions and items have fixed section ids. Riot invents new section ids
 * per patch for Summoner's Rift system changes ("patch-omnivamp",
 * "patch-role-quests", …) — any section NOT on the out-of-scope list maps to
 * systems, so real changes are never dropped by an unrecognized heading.
 */
const FIXED_TARGETS: Record<string, keyof RawPatch> = {
  "patch-champions": "champions",
  "patch-items": "items",
};
const OUT_OF_SCOPE =
  /aram|arena|swiftplay|brawl|urf|rotating|bugfix|qol|highlight|skins|chromas|upcoming|mythic|related|patch-top|thoughts|clash|esports|behavioral/i;

function targetFor(sectionId: string): keyof RawPatch | null {
  const fixed = FIXED_TARGETS[sectionId];
  if (fixed) return fixed;
  if (OUT_OF_SCOPE.test(sectionId)) return null;
  return "systems";
}
/** Badge prefixes Riot puts in front of some lines. */
const BADGE = /^\s*(?:NEW|UPDATED|REMOVED|ADJUSTED|RETURNING)\s*/i;

function cleanText(el: HTMLElement | string): string {
  const text = typeof el === "string" ? el : el.text;
  return text.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function parseLine(li: HTMLElement, report: ParseReport): RawLine | null {
  const text = cleanText(li);
  if (!text) return null;

  const arrowIdx = text.indexOf(ARROW);
  if (arrowIdx !== -1) {
    const left = text.slice(0, arrowIdx);
    const after = text.slice(arrowIdx + ARROW.length).trim();
    const colonIdx = left.indexOf(":");
    const label = cleanText(left.slice(0, colonIdx === -1 ? undefined : colonIdx)).replace(BADGE, "");
    // Some lines carry the colon inside the <strong> label too ("Label:: 200%").
    const before = colonIdx === -1 ? "" : left.slice(colonIdx + 1).replace(/^[\s:]+/, "").trim();
    if (label && before && after) {
      report.arrowLines += 1;
      return { label, before, after };
    }
  }

  // Prose line: "LABEL: text…" or free text.
  const stripped = text.replace(BADGE, "");
  const colonIdx = stripped.indexOf(":");
  report.proseLines += 1;
  if (colonIdx > 0 && colonIdx < 80) {
    return {
      label: cleanText(stripped.slice(0, colonIdx)),
      text: cleanText(stripped.slice(colonIdx + 1)),
    };
  }
  return { label: "Change", text: cleanText(stripped) };
}

function parseBlock(
  block: HTMLElement,
  sectionId: string,
  sectionTitle: string,
  report: ParseReport,
): RawSection[] {
  const title = block.querySelector("h3.change-title");

  if (title) {
    // Champion-style block: h3 names the section, h4s name ability groups.
    const name = cleanText(title);
    const summaryEl = block.querySelector("blockquote");
    const summary = summaryEl ? cleanText(summaryEl) : undefined;

    const blocks: RawBlock[] = [];
    let current: RawBlock | null = null;
    for (const el of block.querySelectorAll("h4, ul")) {
      if (el.tagName === "H4") {
        current = { header: cleanText(el), lines: [] };
        blocks.push(current);
      } else {
        if (!current) {
          current = { header: "General", lines: [] };
          blocks.push(current);
        }
        for (const li of el.querySelectorAll("li")) {
          const line = parseLine(li, report);
          if (line) current.lines.push(line);
        }
      }
    }
    return [{ name, summary, blocks: blocks.filter((b) => b.lines.length > 0 || blocks.length === 0) }];
  }

  // Item/system-style block: no h3 — each h4 IS a section name
  // (e.g. 26.4 items: <h4>Hexoptics C44</h4><blockquote/><ul/>).
  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  for (const el of block.querySelectorAll("h4, ul, blockquote")) {
    if (el.tagName === "H4") {
      current = { name: cleanText(el), blocks: [{ header: "General", lines: [] }] };
      sections.push(current);
    } else if (el.tagName === "BLOCKQUOTE") {
      if (current && !current.summary) current.summary = cleanText(el);
    } else {
      if (!current) continue;
      for (const li of el.querySelectorAll("li")) {
        const line = parseLine(li, report);
        if (line) current.blocks[0]!.lines.push(line);
      }
    }
  }
  if (sections.length === 0 && block.querySelectorAll("li").length > 0) {
    // Headerless block with real change lines (e.g. 26.2 "WASD"): name it
    // after its h2 section so nothing is dropped. Blockquote-only commentary
    // blocks (no <li>) are silently skipped.
    const fallback: RawSection = { name: sectionTitle, blocks: [{ header: "General", lines: [] }] };
    const summaryEl = block.querySelector("blockquote");
    if (summaryEl) fallback.summary = cleanText(summaryEl);
    for (const li of block.querySelectorAll("li")) {
      const line = parseLine(li, report);
      if (line) fallback.blocks[0]!.lines.push(line);
    }
    if (fallback.blocks[0]!.lines.length > 0) return [fallback];
    report.unparsedBlocks.push(`unnamed block in ${sectionId}`);
  }
  return sections;
}

export function parsePatchHtml(html: string): { raw: RawPatch; report: ParseReport } {
  const root = parseHtml(html);
  const raw: RawPatch = { champions: [], items: [], systems: [] };
  const report: ParseReport = {
    championCount: 0,
    arrowLines: 0,
    proseLines: 0,
    unparsedBlocks: [],
    skippedSections: {},
  };

  // querySelectorAll returns document order (DFS): h2 markers set the current
  // section, change blocks fall into the section that precedes them.
  let currentSection: string | null = null;
  let currentTitle = "";
  for (const el of root.querySelectorAll("h2[id^=patch-], div.patch-change-block")) {
    if (el.tagName === "H2") {
      currentSection = el.getAttribute("id") ?? null;
      currentTitle = cleanText(el);
      continue;
    }
    if (!currentSection) continue;
    const target = targetFor(currentSection);
    if (!target) {
      report.skippedSections[currentSection] = (report.skippedSections[currentSection] ?? 0) + 1;
      continue;
    }
    raw[target].push(...parseBlock(el, currentSection, currentTitle, report));
  }

  report.championCount = raw.champions.length;
  return { raw, report };
}
