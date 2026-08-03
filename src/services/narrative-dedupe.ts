/**
 * Collapse near-duplicate narrative labels.
 *
 * Pan's clustering routinely emits several rows for one conversation — e.g.
 * "Father's Plea for Areen", "Father's Plea for Son Areen", and "Father's Plea
 * for Areen's Survival" are the same story with 168, 158, and 149 authors.
 * Exact-label matching keeps all three, which draws one band per row and reads
 * as three separate conversations when there is only one.
 *
 * Matching is by significant-word containment rather than edit distance: two
 * labels are the same narrative when the shorter one's meaningful words are
 * almost entirely contained in the longer one. That handles added qualifiers
 * ("Son", "'s Survival") without the false positives fuzzy string distance
 * produces on short, unrelated labels.
 */

/**
 * Words too common to distinguish one narrative from another. Deliberately
 * small — this is for structural filler, not topic filtering.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "its",
  "it",
  "this",
  "that",
  "his",
  "her",
  "their",
  "s",
]);

/** Share of the shorter label's words that must appear in the longer one. */
const CONTAINMENT_THRESHOLD = 0.7;

/** Reduce a label to its distinguishing words. */
export function significantWords(label: string): Set<string> {
  const words = label
    .toLowerCase()
    .replace(/[''’]s\b/g, "") // possessives: "Areen's" -> "Areen"
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * True when two labels describe the same narrative.
 *
 * Empty word sets (labels that were entirely stopwords or punctuation) only
 * match each other, so they can't swallow unrelated topics.
 */
export function isSameNarrative(a: string, b: string): boolean {
  const wa = significantWords(a);
  const wb = significantWords(b);
  if (wa.size === 0 || wb.size === 0) return wa.size === wb.size;

  const [smaller, larger] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  let shared = 0;
  for (const w of smaller) if (larger.has(w)) shared++;
  return shared / smaller.size >= CONTAINMENT_THRESHOLD;
}

/**
 * Collapse items whose labels describe the same narrative, keeping the
 * strongest of each group.
 *
 * @param items    Narrative-like rows, in any order.
 * @param labelOf  Reads the display label from an item.
 * @param weightOf Reads the "strength" used to pick a group's survivor
 *                 (typically author count).
 */
export function dedupeNarratives<T>(
  items: T[],
  labelOf: (item: T) => string,
  weightOf: (item: T) => number,
): T[] {
  const kept: T[] = [];

  // Strongest first, so the survivor of each group is the one we keep and
  // later near-matches collapse into it.
  for (const item of [...items].sort((a, b) => weightOf(b) - weightOf(a))) {
    const label = labelOf(item).trim();
    if (!label) continue;
    if (!kept.some((k) => isSameNarrative(labelOf(k), label))) {
      kept.push(item);
    }
  }

  return kept;
}
