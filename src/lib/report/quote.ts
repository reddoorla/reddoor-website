/**
 * The assistant's words as the page prints them, and the identity a statement
 * is known by. Kept apart from `model.ts` and `overrides.ts`: both need them,
 * and they already import each other.
 */

/**
 * The assistant's words as a reader sees them. The model's quote can carry
 * markdown emphasis, which a reader would see as stray asterisks: "**Example
 * Studio**" printed as stars on a document sent to a prospect. The emphasis
 * markers are dropped for display only; the words are untouched, so the quote
 * still survives being checked against the answer.
 */
export function displayQuote(text: string): string {
  const unemphasised = text
    .replace(/(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1/g, "$2")
    .replace(/(?<!\S)\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\S)/g, "$1")
    .trim();
  // The page wraps every quote in its own marks, so a quote that arrives
  // already wrapped printed doubled: ""with $2 million in revenue"". One
  // outer pair goes; a quote mark inside the sentence is content and stays.
  const wrapped = unemphasised.match(/^["“]([\s\S]*)["”]$/);
  return wrapped && !/["“”]/.test(wrapped[1] ?? "") ? (wrapped[1] ?? "").trim() : unemphasised;
}

/**
 * A statement's identity on the page: its quote as printed, with case and
 * whitespace folded. Several rows can share one quote, because the model splits
 * one sentence into several claims, and the page prints that sentence once. The
 * question it answered is not part of the identity: the same sentence is the
 * same statement whichever question drew it out.
 *
 * An empty quote has nothing to print under, so each such row keeps its own
 * question: two unquoted rows under two questions are two statements.
 */
export function statementIdentity(a: { engineQuote: string; query: unknown }): string {
  const folded = displayQuote(a.engineQuote).replace(/\s+/g, " ").trim().toLowerCase();
  return folded === "" ? `\u0000${String(a.query)}` : folded;
}
