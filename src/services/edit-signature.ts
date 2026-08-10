/**
 * Strip client-appended edit signatures from post text.
 *
 * Skeets writes its own marker into the post body rather than into a field:
 *
 *   "…post text\n(Edited 9:55 PM via @skeetsapp.com)"
 *
 * The timestamp changes on every revision, so diffing raw text highlights that
 * line on every single version and drowns out the actual change. There is also
 * a bare variant with no attribution: "(Edited 21:24)".
 *
 * Note the space before the time is U+202F NARROW NO-BREAK SPACE, not U+0020 —
 * matching on a regular space silently fails to strip anything.
 */

/** U+202F narrow no-break space, as Skeets writes it. */
const NNBSP = " ";

/**
 * Matches an edit signature on its own trailing line.
 *
 * Both the 12-hour form with an AM/PM marker and the bare 24-hour form are
 * covered, with or without a `via @handle` attribution. Whitespace before the
 * time accepts the narrow no-break space, a regular space, or none, since we
 * cannot rely on every client agreeing with Skeets.
 */
const EDIT_SIGNATURE =
  /\s*\n?\((?:Edited|edited)[\s ]*\d{1,2}:\d{2}(?:[\s ]*(?:AM|PM|am|pm))?(?:[\s ]*via[\s ]*@?[^)]*)?\)\s*$/;

/**
 * Remove a trailing edit signature, if present.
 *
 * Only strips at the end of the text — a parenthetical mid-post that happens to
 * look like a signature is the author's own words and must survive.
 */
export function stripEditSignature(text: string): string {
  return text.replace(EDIT_SIGNATURE, "");
}

/** Whether the text carries a client-appended edit signature. */
export function hasEditSignature(text: string): boolean {
  return EDIT_SIGNATURE.test(text);
}

/**
 * True when two versions differ only by their edit signature.
 *
 * Useful for deciding whether a version is worth showing as a distinct entry:
 * a revision whose only change is its own timestamp is noise.
 */
export function differsOnlyBySignature(a: string, b: string): boolean {
  if (a === b) return false;
  return stripEditSignature(a) === stripEditSignature(b);
}

export { NNBSP as EDIT_SIGNATURE_SPACE };
