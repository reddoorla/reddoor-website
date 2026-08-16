import { animateIn, type AnimateInOptions } from "./animateIn";

export type CascadeInOptions = Pick<
  AnimateInOptions,
  "enabled" | "duration" | "delayMax" | "translateY"
> & {
  /** Which descendants animate. Defaults to the node's direct children. */
  selector?: string;
};

/**
 * Applies `animateIn` to each of a node's children, so every one of them gets
 * its OWN scroll trigger and arrives as it reaches the viewport.
 *
 * That is the only thing this does, and it is deliberately not a stagger: the
 * cascade down a list comes from where the reader has scrolled to, not from a
 * timer, which is what makes it feel reactive rather than played-back. An
 * earlier version added an index delay and got this wrong.
 *
 * It exists purely because some of these rows are not authored markup — a
 * rich-text body renders its own <p> per line, and there is nowhere to hang a
 * per-item `use:anim`. Where the items ARE in markup, put `use:anim` on them
 * directly and skip this.
 */
export function cascadeIn(node: HTMLElement, options?: CascadeInOptions) {
  const opts = options ?? {};
  if (opts.enabled === false) return { destroy() {} };

  const items = (
    opts.selector ? [...node.querySelectorAll(opts.selector)] : [...node.children]
  ).filter((el): el is HTMLElement => el instanceof HTMLElement);

  const handles = items.map((el) =>
    animateIn(el, {
      enabled: opts.enabled,
      duration: opts.duration,
      delayMax: opts.delayMax,
      translateY: opts.translateY,
    }),
  );

  return {
    destroy() {
      for (const handle of handles) handle?.destroy?.();
    },
  };
}
