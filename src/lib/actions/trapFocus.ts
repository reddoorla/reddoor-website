// Focus management for modal overlays (WCAG 2.4.3 focus order + 2.1.2 no keyboard
// trap). Apply with `use:trapFocus` to an overlay element that is gated by an
// `{#if}` block, so the action's mount/destroy lifecycle matches open/close.
//
// On open it moves focus into the overlay; while open it cycles Tab/Shift+Tab
// within the overlay (so focus can't reach the now-inert page behind it); on
// close it restores focus to whatever was focused before — usually the control
// that opened the overlay.
//
// Degenerate case: an overlay with no focusable children (e.g. an informational
// "rotate your device" modal) gets focus moved to the container but NO Tab trap,
// because trapping with no focusable target and no Escape would itself be a
// keyboard trap (2.1.2). Pass `onEscape` for overlays that should close on Escape;
// omit it where the host component already handles Escape.

export type TrapFocusOptions = {
  /** Called when Escape is pressed inside the overlay. Omit if the host handles it. */
  onEscape?: () => void;
  /** When false the action is inert. Default true. */
  enabled?: boolean;
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Visible, focusable descendants. `getClientRects()` is empty for display:none
 *  (and correctly non-empty inside a position:fixed container, where offsetParent
 *  would be null). */
function focusable(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

export function trapFocus(node: HTMLElement, options: TrapFocusOptions = {}) {
  let opts = options;
  // What had focus before the overlay opened, so we can restore it on close.
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const moveFocusIn = () => {
    const preferred = node.querySelector<HTMLElement>("[data-autofocus]");
    const target = preferred ?? focusable(node)[0];
    if (target) {
      target.focus();
    } else {
      // No focusable children: focus the container so AT announces the dialog
      // and focus leaves the inert background. No Tab trap (see file header).
      if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
      node.focus();
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && opts.onEscape) {
      e.preventDefault();
      opts.onEscape();
      return;
    }
    if (e.key !== "Tab") return;

    const items = focusable(node);
    if (items.length === 0) return; // nothing to cycle — no trap

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !node.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !node.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  if (opts.enabled !== false) {
    // Defer past the open transition so the element is laid out before focusing.
    requestAnimationFrame(moveFocusIn);
    node.addEventListener("keydown", onKeydown);
  }

  return {
    update(next: TrapFocusOptions = {}) {
      opts = next;
    },
    destroy() {
      node.removeEventListener("keydown", onKeydown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    },
  };
}
