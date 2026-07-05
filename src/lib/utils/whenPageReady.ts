/**
 * Load-aware page readiness for the splash overlay.
 *
 * Vendored from @reddoorla/maintenance's `./client` subpath (added in
 * reddoorla/reddoor-maintenance#357, ships in 0.68.0).
 * TODO(fleet): once the site is on @reddoorla/maintenance ^0.68.0, delete
 * this file and import from "@reddoorla/maintenance/client" instead.
 *
 * Resolves when above-the-fold imagery has settled — or at `maxMs`, whichever
 * comes first — but never before `minMs`. Replaces the blind splash timer:
 * fast loads reveal as soon as the hero has painted, slow loads are capped at
 * the old timer's ceiling, and a broken image can't wedge the splash open
 * (`img.complete` is terminal for both load and error).
 */

export type PageReadyOptions = {
  /** Never resolve before this many ms — keeps the splash from flashing. Default 400. */
  minMs?: number;
  /** Always resolve by this many ms, loaded or not. Default 2500. */
  maxMs?: number;
  /** Selector for images that must settle first. Default `img[loading="eager"]`; false to skip. */
  waitForImages?: string | false;
  /** Also wait for the window `load` event. Default false — full load includes
   * every iframe and third-party script, which lags meaningful paint by seconds. */
  waitForDocument?: boolean;
  /** Extra readiness signals. Rejections count as settled. */
  signals?: ReadonlyArray<Promise<unknown>>;
};

export type PageReadyReason = "ready" | "timeout" | "no-dom";

const DEFAULT_MIN_MS = 400;
const DEFAULT_MAX_MS = 2500;
const DEFAULT_IMAGE_SELECTOR = 'img[loading="eager"]';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function documentComplete(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
}

function imageSettled(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener("load", () => resolve(), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  });
}

export function whenPageReady(options: PageReadyOptions = {}): Promise<PageReadyReason> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.resolve("no-dom");
  }

  const minMs = options.minMs ?? DEFAULT_MIN_MS;
  const maxMs = options.maxMs ?? DEFAULT_MAX_MS;
  const selector = options.waitForImages ?? DEFAULT_IMAGE_SELECTOR;

  const waits: Promise<unknown>[] = [];
  if (options.waitForDocument) waits.push(documentComplete());
  if (selector !== false) {
    for (const img of document.querySelectorAll<HTMLImageElement>(selector)) {
      waits.push(imageSettled(img));
    }
  }
  for (const signal of options.signals ?? []) waits.push(signal.catch(() => undefined));

  const ready = Promise.all(waits).then<PageReadyReason>(() => "ready");
  const capped =
    maxMs === Infinity
      ? ready
      : Promise.race([ready, delay(maxMs).then<PageReadyReason>(() => "timeout")]);

  return Promise.all([capped, delay(minMs)]).then(([reason]) => reason);
}

/** True when the user prefers reduced motion; false during SSR. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
