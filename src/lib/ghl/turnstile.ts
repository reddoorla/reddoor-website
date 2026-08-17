import { loadTurnstile } from "$lib/turnstile";
import { GHL_TURNSTILE_SITE_KEY } from "./constants";

/**
 * Mint GHL-verifiable Turnstile tokens for the inquiry fires.
 *
 * The sitekey is GHL's invisible one (see constants.ts), so the widget draws
 * nothing — it runs its challenge on render and hands tokens to the callback.
 * Tokens are single-use: `take()` consumes the current one and resets the
 * widget so the next fire gets a fresh mint.
 *
 * Everything here degrades to `undefined`: the sitekey may not allow this
 * hostname (it's theirs, not ours — unknowable until Cloudflare answers in a
 * real browser), api.js may be blocked, the challenge may still be running at
 * submit time. A tokenless fire is still worth sending — the widget's own code
 * treats this token as best-effort too — so no failure here may ever block or
 * delay the visitor beyond `maxWaitMs`.
 */
export type GhlTurnstile = {
  /** Resolve the freshest token within maxWaitMs, or undefined. Consumes it. */
  take: (maxWaitMs: number) => Promise<string | undefined>;
  destroy: () => void;
};

export function primeGhlTurnstile(container: HTMLElement): GhlTurnstile {
  // The one unconsumed token currently minted, if any. Tokens are single-use:
  // each is handed to exactly one take() and then the widget is reset to mint
  // the next.
  let token: string | undefined;
  let widgetId: string | undefined;
  let failed = false;
  let destroyed = false;
  // A FIFO of live takers. Each entry consumes AT MOST one token. `settle` on
  // failure resolves them all with undefined; a fresh token feeds only the head
  // of the queue, so two concurrent takers never share one single-use token.
  type Waiter = { resolve: (t: string | undefined) => void; timer: ReturnType<typeof setTimeout> };
  let waiters: Waiter[] = [];

  // Reset the widget so it mints the next token. A reset failure just means the
  // next take() waits out its budget and goes tokenless.
  const rearm = () => {
    try {
      if (widgetId !== undefined) window.turnstile?.reset(widgetId);
    } catch {
      /* widget already gone */
    }
  };

  // Fail every live taker (challenge errored / torn down). Only called with
  // undefined; a real token is delivered through `deliver`, never here.
  const failAll = () => {
    const pending = waiters;
    waiters = [];
    for (const w of pending) {
      clearTimeout(w.timer);
      w.resolve(undefined);
    }
  };

  // A token arrived. Give it to the oldest waiter (consuming it and re-arming
  // for the next), or park it for the next take() if nobody is waiting.
  const deliver = (t: string) => {
    const w = waiters.shift();
    if (w) {
      clearTimeout(w.timer);
      rearm();
      w.resolve(t);
    } else {
      token = t;
    }
  };

  loadTurnstile()
    .then((turnstile) => {
      if (destroyed || !container.isConnected) return;
      widgetId = turnstile.render(container, {
        sitekey: GHL_TURNSTILE_SITE_KEY,
        callback: (t) => deliver(t),
        "error-callback": () => {
          failed = true;
          failAll();
          return true; // suppress Turnstile's visible retry chatter
        },
      });
      if (widgetId === undefined) {
        failed = true;
        failAll();
      }
    })
    .catch(() => {
      failed = true;
      failAll();
    });

  return {
    take(maxWaitMs) {
      if (token !== undefined) {
        const t = token;
        token = undefined;
        rearm();
        return Promise.resolve(t);
      }
      if (failed || destroyed) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          // Drop ourselves from the queue so a later token is never burned on a
          // taker that already gave up.
          const i = waiters.findIndex((w) => w.resolve === resolve);
          if (i !== -1) waiters.splice(i, 1);
          resolve(undefined);
        }, maxWaitMs);
        waiters.push({ resolve, timer });
      });
    },
    destroy() {
      destroyed = true;
      failAll();
      try {
        if (widgetId !== undefined) window.turnstile?.remove(widgetId);
      } catch {
        /* already torn down */
      }
    },
  };
}
