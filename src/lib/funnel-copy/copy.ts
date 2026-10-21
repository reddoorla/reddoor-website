import {
  asHTML,
  asLink,
  isFilled,
  NotFoundError,
  RepositoryNotFoundError,
  type FilledImageFieldImage,
  type HTMLRichTextMapSerializer,
  type RichTextField,
} from "@prismicio/client";
import type { FunnelCopyDocumentData } from "../../../prismicio-types";
import { FUNNEL_COPY_DEFAULTS } from "./defaults";

type Defaults = typeof FUNNEL_COPY_DEFAULTS;
export type FunnelCopyKey = keyof Defaults;

/**
 * Every line of the booking funnel, resolved: the `funnel_copy` document's
 * value where Tim has written one, today's wording where he has not.
 */
export type FunnelCopy = {
  [K in FunnelCopyKey]: Defaults[K] extends string ? string : RichTextField;
} & {
  /** Null until a photo is uploaded; the pages then render exactly as before. */
  tim_photo: FilledImageFieldImage | null;
};

/**
 * Field by field, so clearing one box in Prismic brings back that one line
 * rather than blanking it on the live page. Anything that is not a non-blank
 * string or a filled rich text counts as unwritten, which covers a document
 * published before a field existed (the key is missing entirely).
 */
export function resolveFunnelCopy(
  data: Partial<FunnelCopyDocumentData> | null | undefined,
): FunnelCopy {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(FUNNEL_COPY_DEFAULTS) as FunnelCopyKey[]) {
    const fallback = FUNNEL_COPY_DEFAULTS[key];
    const value = (data as Record<string, unknown> | null | undefined)?.[key];
    if (typeof fallback === "string") {
      out[key] = typeof value === "string" && value.trim() ? value.trim() : fallback;
    } else {
      out[key] = isFilled.richText(value as RichTextField) ? value : fallback;
    }
  }
  const photo = data?.tim_photo;
  out.tim_photo = photo && isFilled.image(photo) ? photo : null;
  return out as FunnelCopy;
}

export const DEFAULT_FUNNEL_COPY: FunnelCopy = resolveFunnelCopy(undefined);

/** Alt text for Tim's photo: what he typed on the asset, else his name and role. */
export function photoAlt(photo: FilledImageFieldImage): string {
  return photo.alt?.trim() || "Tim Holmes, Creative Director";
}

const escapeHTML = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A link Tim pastes as `https://reddoorla.com/schedule` should stay on the site
 * the visitor is on (staging included) and keep client-side navigation, so the
 * site's own origin is dropped.
 */
export function localHref(url: string): string {
  const local = url.replace(/^https?:\/\/(www\.)?reddoorla\.com(?=\/|$)/i, "") || "/";
  // `https://reddoorla.com//elsewhere.example` must not become the
  // protocol-relative `//elsewhere.example`.
  return local.startsWith("//") ? url : local;
}

/**
 * The link schemes copy may use. The CSP allows inline script, so a
 * `javascript:` URL typed into a Prismic Web link would run; it renders as
 * plain text instead.
 */
const SAFE_HREF = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;

/**
 * Values the page inserts into the copy. The editor writes the token, e.g.
 * `{email}`, and never the value: the visitor's address is known only in their
 * own browser, and it is escaped before it reaches the markup.
 */
export type CopyValues = { email?: string };

/**
 * Rich text to the markup the pages used before the copy moved: one `<p>` per
 * paragraph carrying the page's own class, and links styled the way every
 * inline link on these pages already was.
 */
export function richHTML(field: RichTextField, pClass: string, values: CopyValues = {}): string {
  const serializer: HTMLRichTextMapSerializer = {
    paragraph: ({ children }) => `<p class="${pClass}">${children}</p>`,
    hyperlink: ({ node, children }) => {
      const href = asLink(node.data);
      if (!href || !SAFE_HREF.test(localHref(href))) return children;
      return `<a class="text-primary underline" href="${escapeHTML(localHref(href))}">${children}</a>`;
    },
  };
  let html = asHTML(field, { serializer }) ?? "";
  if (values.email !== undefined) {
    html = html.replaceAll("{email}", `<strong>${escapeHTML(values.email)}</strong>`);
  }
  return html;
}

/** The one method the loader needs, so a test can hand it a failing CMS. */
export type FunnelCopyReader = { getSingle(type: "funnel_copy"): Promise<{ data: unknown }> };

/**
 * Never throws. No document (the state until Tim's release is published), a
 * Prismic outage and a malformed answer all resolve to today's wording: a CMS
 * failure costs Tim's edits, never the booking page.
 */
export async function readFunnelCopy(reader: FunnelCopyReader): Promise<FunnelCopy> {
  try {
    const doc = await reader.getSingle("funnel_copy");
    return resolveFunnelCopy(doc?.data as Partial<FunnelCopyDocumentData> | undefined);
  } catch (err) {
    // A missing document is expected and not worth a log line; anything else
    // is, because the page will quietly show the fallback.
    if (!(err instanceof NotFoundError) || err instanceof RepositoryNotFoundError) {
      console.error("[funnel-copy] Prismic read failed, using the built-in copy:", err);
    }
    return DEFAULT_FUNNEL_COPY;
  }
}
