import { describe, expect, it } from "vitest";
import {
  CONSENT_KEY,
  META_PIXEL_ID,
  META_PIXEL_SRC,
  ensureMetaPixel,
  isFunnelPath,
  readConsent,
  saveConsent,
  trackFunnelPageView,
} from "./metaPixel";

describe("isFunnelPath", () => {
  it.each(["/medtech", "/brand-friction-audit", "/schedule", "/not-a-fit", "/medtech/"])(
    "%s is on the MedTech funnel",
    (p) => expect(isFunnelPath(p)).toBe(true),
  );

  it.each([
    "/",
    "/boise",
    "/portfolio",
    "/portfolio/msot",
    "/preview/medtech",
    "/medtech-x",
    "/contact",
  ])("%s is not", (p) => expect(isFunnelPath(p)).toBe(false));
});

function memoryStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    map: m,
  };
}

describe("consent storage", () => {
  it("reads unanswered, accepted and rejected", () => {
    expect(readConsent(() => memoryStorage())).toBe(null);
    expect(readConsent(() => memoryStorage({ [CONSENT_KEY]: "true" }))).toBe("accepted");
    expect(readConsent(() => memoryStorage({ [CONSENT_KEY]: "false" }))).toBe("rejected");
    expect(readConsent(() => memoryStorage({ [CONSENT_KEY]: "yes" }))).toBe(null);
  });

  it("treats storage that throws as unanswered, and saving to it as harmless", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(readConsent(() => broken)).toBe(null);
    expect(() => saveConsent(() => broken, true)).not.toThrow();
  });

  it("treats storage that cannot even be reached as unanswered", () => {
    // Blocked site data: reading `window.localStorage` itself throws.
    const unreachable = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    expect(readConsent(unreachable)).toBe(null);
    expect(() => saveConsent(unreachable, true)).not.toThrow();
  });

  it("round-trips an answer", () => {
    const s = memoryStorage();
    saveConsent(() => s, true, new Date("2026-11-10T00:00:00Z"));
    expect(readConsent(() => s)).toBe("accepted");
    saveConsent(() => s, false);
    expect(readConsent(() => s)).toBe("rejected");
  });
});

function fakeDocument() {
  const appended: { src: string; async: boolean }[] = [];
  const doc = {
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (el: { src: string; async: boolean }) => void appended.push(el) },
  };
  return { doc: doc as unknown as Document, appended };
}

describe("the pixel loader", () => {
  it("adds fbevents.js once, inits Tim's pixel with automatic events off, and tracks PageView only when asked", () => {
    const win: Parameters<typeof ensureMetaPixel>[0] = {};
    const { doc, appended } = fakeDocument();

    const fbq = ensureMetaPixel(win, doc);
    expect(appended.map((s) => s.src)).toEqual([META_PIXEL_SRC]);
    expect(appended[0].async).toBe(true);
    expect(fbq.disablePushState).toBe(true);
    expect(fbq.queue).toEqual([
      ["set", "autoConfig", false, META_PIXEL_ID],
      ["init", META_PIXEL_ID],
    ]);

    trackFunnelPageView(win, doc);
    trackFunnelPageView(win, doc);
    expect(appended).toHaveLength(1);
    expect(fbq.queue.filter((c) => c[0] === "track")).toEqual([
      ["track", "PageView"],
      ["track", "PageView"],
    ]);
  });
});
