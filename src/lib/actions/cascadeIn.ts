export type CascadeInOptions = {
  /** If false, the action is a no-op — children render as-is. */
  enabled?: boolean;
  /** Which descendants cascade. Defaults to the node's direct children. */
  selector?: string;
  /** ms between one item and the next. */
  step?: number;
  /** ms the fill itself takes. */
  duration?: number;
  /** How far each item travels on the way in. */
  translateY?: string;
  /** Ceiling on the house left-to-right offset; see below. */
  delayMax?: number;
};

/**
 * Reveals a list of siblings one after another as the list reaches the viewport.
 *
 * `animateIn` can only cascade horizontally — it derives an element's delay from
 * `rect.left / innerWidth`, so a column of rows, all sharing a left edge, all
 * get the SAME delay and arrive as one block. This adds the index term that a
 * vertical list needs, and keeps the horizontal one so the two compose: rows
 * cascade down a column, columns cascade across the page, and a grid of both
 * reads as a diagonal.
 *
 * It also exists because the rows it is aimed at are not all authored markup —
 * a rich-text body renders its own <p> per line, and there is nowhere to hang a
 * per-item action. Driving them from the container is the only way in without
 * overriding the paragraph renderer site-wide.
 *
 * Two behaviours worth keeping if this is ever refactored:
 *
 * - The hidden state is applied WITHOUT a transition, and the transition is
 *   attached only for the reveal. These rows are server-rendered visible and
 *   hidden at hydration; a transition on the hide makes them visibly fade OUT
 *   before they fade in.
 * - Nothing is hidden at all under reduced motion, or when disabled. The
 *   finished state is what the markup already renders, so an observer that
 *   never runs leaves the content readable rather than invisible.
 */
export function cascadeIn(node: HTMLElement, options?: CascadeInOptions) {
  const opts = options ?? {};
  if (opts.enabled === false) return { destroy() {} };
  if (typeof window === "undefined") return { destroy() {} };
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return { destroy() {} };

  const step = opts.step ?? 90;
  const duration = opts.duration ?? 1000;
  const translateY = opts.translateY ?? "25%";
  const delayMax = opts.delayMax ?? 200;

  const items = (
    opts.selector ? [...node.querySelectorAll(opts.selector)] : [...node.children]
  ).filter((el): el is HTMLElement => el instanceof HTMLElement);
  if (!items.length) return { destroy() {} };

  for (const item of items) {
    item.style.opacity = "0";
    item.style.transform = `translateY(${translateY})`;
  }

  const reveal = () => {
    for (const [i, item] of items.entries()) {
      // Same left-to-right term animateIn uses, so a cascade started here lines
      // up with one started by the action next to it.
      const across = delayMax * (item.getBoundingClientRect().left / window.innerWidth);
      const delay = Math.round(across + i * step);
      item.style.transition =
        `opacity ${duration}ms var(--transition-fast-slow) ${delay}ms, ` +
        `transform ${duration}ms var(--transition-fast-slow) ${delay}ms`;
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    }
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect(); // one-shot: it should not rewind on scroll-up
      reveal();
    },
    { threshold: 0.1 },
  );
  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    },
  };
}
