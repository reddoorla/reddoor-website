/**
 * Straight quotes (`'` U+0027, `"` U+0022) → typographic marks.
 *
 * Tim, Discord 2026-09-17, with screenshots: "our website has footprints all
 * over the place but sometimes uses the correct apostrophe. How do we correct
 * it so it only uses the beautiful apostrophes?" — and the same ask in March:
 * "These need to be quote marks not inch marks."
 *
 * Measured before writing this: 200 straight apostrophes and 83 straight double
 * quotes across 54 of the 81 published Prismic documents, against only 83 curly
 * marks site-wide. That is a content problem with no content fix — rewriting 54
 * documents by hand corrects today's copy and nothing typed tomorrow. So the
 * correction lives on the read path instead (see `$lib/prismicio`), which
 * catches every document, every slice, the meta tags and the OG card routes at
 * once because they all read through the same client.
 *
 * ## The length invariant
 *
 * Rich text is an array of blocks, each `{ text, spans }`, where every span
 * (link, bold, italic) addresses the text by character offset. Change the
 * LENGTH of `text` and every span past the edit shifts — a link silently
 * wanders off its words. Every substitution here is one character for one
 * character, so offsets are preserved by construction; `smartQuotes` asserts
 * that at run time and hands back the input untouched rather than corrupt a
 * document if it ever stops being true.
 */

const LEFT_DOUBLE = "\u201C"; // “
const RIGHT_DOUBLE = "\u201D"; // ”
const LEFT_SINGLE = "\u2018"; // ‘
const RIGHT_SINGLE = "\u2019"; // ’

/**
 * Words that open with an elided letter. After one of these a leading `'` is an
 * apostrophe (`’til`) and curls like a CLOSING mark, not an opening one — the
 * case naive implementations get backwards, because positionally it looks
 * exactly like the start of a quotation.
 */
const ELISIONS = new Set([
  "bout",
  "cause",
  "em",
  "fraid",
  "gainst",
  "n",
  "neath",
  "nother",
  "nuff",
  "round",
  "til",
  "till",
  "tis",
  "twas",
  "twere",
  "twould",
]);

/**
 * Characters after which a quote mark OPENS rather than closes: any whitespace
 * (`\s` covers the no-break space too), an opening bracket, a dash of any
 * length, or an already-typographic opening mark — that last one is what makes
 * a nested single quote inside a double-quoted phrase come out right, because
 * the pass reads back the character it has just written.
 */
const OPENS_AFTER = /[\s([\-\u2012\u2013\u2014\u201C\u2018]/;

/** A value that is markup or code, not prose. */
const LOOKS_LIKE_CODE = /[<{}]/;

const HAS_STRAIGHT_MARK = /['"]/;

/**
 * An address rather than a sentence. All three shapes require the whole value
 * to be one whitespace-free token, so prose that merely mentions a link is
 * still corrected.
 */
function looksLikeUrl(value: string): boolean {
  const token = value.trim();
  if (token === "" || /\s/.test(token)) return false;
  return (
    /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(token) || // https:, mailto:, tel:, //cdn…
    /^\.{0,2}\//.test(token) || // /medtech, ./x, ../x
    /^[\w-]+(?:\.[\w-]+)+(?:\/.*)?$/.test(token) // reddoorla.com/portfolio
  );
}

/** Is the `'` at `index` the elided head of a word (`'90s`, `'til`) ? */
function isElision(source: string, index: number): boolean {
  const rest = source.slice(index + 1);
  if (/^\d{2}(?!\d)/.test(rest)) return true; // '90s, '26
  const word = /^[A-Za-z]+/.exec(rest);
  return word !== null && ELISIONS.has(word[0].toLowerCase());
}

/**
 * Replace the straight marks in one string with typographic ones.
 *
 * Left untouched: anything holding markup or code (`<`, `{`, `}`), anything
 * that is a bare URL, and anything with no straight mark in it (which also
 * makes the function idempotent — a second pass finds nothing left to do).
 */
export function smartQuotes(input: string): string {
  if (!HAS_STRAIGHT_MARK.test(input)) return input;
  if (LOOKS_LIKE_CODE.test(input)) return input;
  if (looksLikeUrl(input)) return input;

  const out = [...input];
  // A surrogate pair (emoji) is two code units but one entry here, so indices
  // into `out` are not indices into `input`. Track the source offset alongside
  // it for the elision look-ahead, which reads the original string.
  let offset = 0;
  for (let i = 0; i < out.length; i++) {
    const char = out[i];
    const here = offset;
    offset += char.length;
    if (char !== "'" && char !== '"') continue;

    const opening = i === 0 || OPENS_AFTER.test(out[i - 1]);
    if (char === '"') {
      out[i] = opening ? LEFT_DOUBLE : RIGHT_DOUBLE;
    } else {
      // Not in an opening position → a contraction or possessive (`We’ll`,
      // `dogs’`), or the close of a nested quotation (`‘hello’`).
      out[i] = !opening || isElision(input, here) ? RIGHT_SINGLE : LEFT_SINGLE;
    }
  }

  const result = out.join("");
  // Rich-text spans address `text` by character offset (see the file header).
  // A substitution that changed the length would move every span after it, so
  // refuse the edit instead of corrupting the document.
  return result.length === input.length ? result : input;
}

/**
 * Field names that hold identifiers or addresses rather than prose. Prismic
 * repeats these inside link fields, image fields and rich-text spans, so the
 * check is by name at every depth rather than by path.
 *
 * `alt` is deliberately absent: alt text is prose and gets the same treatment
 * as body copy.
 */
const NON_PROSE_KEYS = new Set([
  "api_id",
  "href",
  "id",
  "key",
  "kind",
  "lang",
  "link_type",
  "mimetype",
  "provider_name",
  "slice_label",
  "slice_type",
  "slug",
  "slugs",
  "src",
  "tags",
  "target",
  "type",
  "uid",
  "url",
  "variation",
  "version",
]);

/** Does a value under this field name get the typographic treatment? */
export function isProseKey(key: string): boolean {
  return !NON_PROSE_KEYS.has(key) && !/_(?:id|url)$/.test(key);
}

/**
 * Walk a Prismic document's `data` and correct every prose string in it.
 *
 * Returns the input by reference when nothing changed, so the common case
 * (a document that was already typed correctly) allocates nothing.
 *
 * Arrays inherit their parent's field name: a repeatable group under `items`
 * is prose because `items` is, and a list of link objects is still filtered
 * key by key once the walk reaches the objects inside it.
 */
export function smartQuoteData<T>(value: T, key = ""): T {
  if (typeof value === "string") {
    return (isProseKey(key) ? (smartQuotes(value) as unknown as T) : value) as T;
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((entry) => {
      const mapped = smartQuoteData(entry, key);
      if (mapped !== entry) changed = true;
      return mapped;
    });
    return (changed ? next : value) as T;
  }

  // Plain objects only. A Date or any other class instance has no place in a
  // Prismic API response, and rebuilding one from its entries would lose it.
  if (value !== null && typeof value === "object" && isPlainObject(value)) {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      const mapped = smartQuoteData(entryValue, entryKey);
      if (mapped !== entryValue) changed = true;
      next[entryKey] = mapped;
    }
    return (changed ? (next as T) : value) as T;
  }

  return value;
}

function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * The document-level entry point: correct `data`, leave the envelope (`id`,
 * `uid`, `url`, `href`, `tags`, `lang`, …) exactly as the API sent it.
 */
export function smartQuoteDocument<T extends { data: unknown }>(document: T): T {
  const data = smartQuoteData(document.data);
  return data === document.data ? document : { ...document, data };
}
