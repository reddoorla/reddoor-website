import * as prismic from "@prismicio/client";
import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";

/**
 * A document tagged `hide` in Prismic exists on staging and nowhere else.
 * This module decides, per process and per request, whether hidden content
 * is shown; `$lib/prismicio` turns the answer into a query filter. It lives
 * under `$lib/server` so the env read can never reach client code.
 */
export const HIDE_TAG = "hide";
/** Set to "show" on the staging site's environment; nothing else sets it. */
export const SHOW_HIDDEN_ENV = "PRISMIC_HIDDEN_CONTENT";
export const PREVIEW_COOKIE = "io.prismic.preview";
/** Appended to every query when hidden content is off. The API needs the array form. */
export const HIDE_FILTER = prismic.filter.not("document.tags", [HIDE_TAG]);

export type VisibilityInput = {
  dev: boolean;
  showHiddenEnv: string | undefined;
  previewCookie: string | undefined;
};

/** Hidden unless something says otherwise: dev, the staging variable, or a preview session. */
export function showsHiddenContent(input: VisibilityInput): boolean {
  if (input.dev) return true;
  if (input.showHiddenEnv?.trim() === "show") return true;
  return Boolean(input.previewCookie);
}

/** The live decision for this process and, given the cookie, this request. */
export function currentlyShowsHidden(previewCookie: string | undefined): boolean {
  return showsHiddenContent({ dev, showHiddenEnv: env[SHOW_HIDDEN_ENV], previewCookie });
}
