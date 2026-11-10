import { describe, expect, it, vi } from "vitest";
import {
  CONSENT_KEY,
  META_PIXEL_ID,
  META_PIXEL_SRC,
  ensureMetaPixel,
  isFunnelPath,
  readConsent,
  saveConsent,
  trackFunnelPageView,
  type Consent,
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

type FakeScript = {
  src: string;
  async: boolean;
  fire: (type: "load" | "error") => void;
  addEventListener: (type: string, fn: () => void) => void;
};

function fakeDocument(href = "https://reddoorla.com/medtech") {
  const appended: FakeScript[] = [];
  const createElement = (): FakeScript => {
    const listeners: Record<string, (() => void)[]> = {};
    return {
      src: "",
      async: false,
      addEventListener: (type, fn) => void (listeners[type] ??= []).push(fn),
      fire: (type) => listeners[type]?.forEach((fn) => fn()),
    };
  };
  const doc = {
    createElement,
    head: { appendChild: (el: FakeScript) => void appended.push(el) },
    location: { href },
    cookie: "",
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

    const send = vi.fn();
    trackFunnelPageView(win, doc, "accepted", send);
    trackFunnelPageView(win, doc, "accepted", send);
    expect(appended).toHaveLength(1);
    const pageView = ["track", "PageView", {}, { eventID: expect.any(String) }];
    expect(fbq.queue.filter((c) => c[0] === "track")).toEqual([pageView, pageView]);
  });
});

describe("the server copy of each event (Conversions API)", () => {
  it("posts each PageView with the same event_id the browser pixel got as eventID", async () => {
    const win: Parameters<typeof ensureMetaPixel>[0] = {};
    const { doc, appended } = fakeDocument("https://reddoorla.com/brand-friction-audit");
    const send = vi.fn();

    trackFunnelPageView(win, doc, "accepted", send);
    trackFunnelPageView(win, doc, "accepted", send);
    (doc as unknown as { cookie: string }).cookie = "_fbp=fb.1.1794000000000.42";
    appended[0].fire("load");

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    const tracks = win.fbq!.queue.filter((c) => c[0] === "track");
    tracks.forEach((t, i) => {
      const eventID = (t[3] as { eventID: string }).eventID;
      expect(eventID).toMatch(/^[A-Za-z0-9-]{8,64}$/);
      expect(send.mock.calls[i][0]).toEqual({
        event_name: "PageView",
        event_id: eventID,
        event_source_url: "https://reddoorla.com/brand-friction-audit",
        consent: "accepted",
      });
    });
    // A fresh id per event, or Meta would drop the second PageView as a duplicate.
    expect(send.mock.calls[0][0].event_id).not.toBe(send.mock.calls[1][0].event_id);
  });

  it("after fbevents.js loads, waits for it to write _fbp so the cookie rides along", async () => {
    vi.useFakeTimers();
    try {
      const win: Parameters<typeof ensureMetaPixel>[0] = {};
      const { doc, appended } = fakeDocument();
      const send = vi.fn();

      trackFunnelPageView(win, doc, "accepted", send);
      appended[0].fire("load");
      await vi.advanceTimersByTimeAsync(300);
      expect(send).not.toHaveBeenCalled();

      // fbevents.js writes its cookies once the pixel's config has arrived.
      (doc as unknown as { cookie: string }).cookie = "a=1; _fbp=fb.1.1794000000000.42";
      await vi.advanceTimersByTimeAsync(150);
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("posts anyway once the wait for _fbp runs out", async () => {
    vi.useFakeTimers();
    try {
      const win: Parameters<typeof ensureMetaPixel>[0] = {};
      const { doc, appended } = fakeDocument();
      const send = vi.fn();
      trackFunnelPageView(win, doc, "accepted", send);
      appended[0].fire("load");
      await vi.advanceTimersByTimeAsync(1_500);
      expect(send).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends only origin, path and fbclid: a CRM link's name, email and phone stay on the page", async () => {
    const win: Parameters<typeof ensureMetaPixel>[0] = {};
    const { doc, appended } = fakeDocument(
      "https://reddoorla.com/schedule?first_name=Ann&email=ann%40x.com&phone=3105550142&fbclid=IwAR9#x",
    );
    const send = vi.fn();
    trackFunnelPageView(win, doc, "accepted", send);
    appended[0].fire("error");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0][0].event_source_url).toBe(
      "https://reddoorla.com/schedule?fbclid=IwAR9",
    );
  });

  it("posts without waiting when fbevents.js is blocked: no cookie is coming", async () => {
    const win: Parameters<typeof ensureMetaPixel>[0] = {};
    const { doc, appended } = fakeDocument();
    const send = vi.fn();
    trackFunnelPageView(win, doc, "accepted", send);
    await Promise.resolve();
    expect(send).not.toHaveBeenCalled();
    appended[0].fire("error");
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  it.each<[Consent]>([["rejected"], [null]])(
    "with consent %j, neither the pixel nor the server hears anything",
    async (consent) => {
      const win: Parameters<typeof ensureMetaPixel>[0] = {};
      const { doc, appended } = fakeDocument();
      const send = vi.fn();
      trackFunnelPageView(win, doc, consent, send);
      await Promise.resolve();
      expect(send).not.toHaveBeenCalled();
      expect(win.fbq).toBeUndefined();
      expect(appended).toHaveLength(0);
    },
  );
});
