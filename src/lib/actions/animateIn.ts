export type AnimateInOptions = {
  /** If false, the action is a no-op — element renders as-is. */
  enabled?: boolean;
  trigger?: boolean;
  duration?: number;
  delayMax?: number;
  translateY?: string;
};

export type AnimateInParam = boolean | AnimateInOptions | undefined;

type ResolvedConfig = {
  mode: "viewport" | "triggered";
  trigger: boolean;
  duration: number;
  delayMax: number;
  translateY: string;
};

function resolveConfig(param: AnimateInParam): ResolvedConfig {
  const isTriggered =
    typeof param === "boolean" ||
    (param !== undefined && typeof param === "object" && "trigger" in param);

  const opts: AnimateInOptions = typeof param === "object" && param !== null ? param : {};
  const trigger = typeof param === "boolean" ? param : (opts.trigger ?? false);

  return {
    mode: isTriggered ? "triggered" : "viewport",
    trigger,
    duration: opts.duration ?? 2400,
    delayMax: opts.delayMax ?? 200,
    translateY: opts.translateY ?? "25%",
  };
}

function applyHidden(node: HTMLElement, cfg: ResolvedConfig) {
  node.style.opacity = "0";
  node.style.transform = `translateY(${cfg.translateY})`;
  node.style.transition =
    `opacity ${cfg.duration}ms var(--transition-fast-slow), ` +
    `transform ${cfg.duration}ms var(--transition-fast-slow)`;
}

function reveal(node: HTMLElement) {
  node.style.opacity = "1";
  node.style.transform = "translateY(0)";
}

export function animateIn(node: HTMLElement, param?: AnimateInParam) {
  if (typeof param === "object" && param !== null && param.enabled === false) {
    return { update() {}, destroy() {} };
  }

  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return { update() {}, destroy() {} };
  }

  const cfg = resolveConfig(param);
  let observer: IntersectionObserver | undefined;

  if (cfg.mode === "triggered") {
    if (cfg.trigger) {
      applyHidden(node, cfg);
      reveal(node);
    } else {
      applyHidden(node, cfg);
    }
  } else {
    applyHidden(node, cfg);
    const delay = cfg.delayMax * (node.getBoundingClientRect().left / window.innerWidth);
    node.style.transitionDelay = `${delay}ms`;

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal(node);
          observer?.disconnect();
        }
      },
      { threshold: 0 },
    );
    observer.observe(node);
  }

  return {
    /** In triggered mode, only the `trigger` field of `next` is read — other options are locked at mount. */
    update(next?: AnimateInParam) {
      if (cfg.mode !== "triggered") return;
      const nextCfg = resolveConfig(next);
      if (nextCfg.trigger) {
        reveal(node);
      } else {
        applyHidden(node, cfg);
      }
    },
    destroy() {
      observer?.disconnect();
    },
  };
}
