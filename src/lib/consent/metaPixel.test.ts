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

function fakeDocument(href = "https://reddoorla.com/medtech") {
  const appended: { src: string; async: boolean }[] = [];
  const doc = {
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (el: { src: string; async: boolean }) => void appended.push(el) },
    location: { href },
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
    const tracks = fbq.queue.filter((c) => c[0] === "track");
    expect(tracks).toHaveLength(2);
    for (const t of tracks) expect(t.slice(0, 2)).toEqual(["track", "PageView"]);
  });
});

describe("the server copy of each event (Conversions API)", () => {
  it("posts each PageView with the same event_id the browser pixel got as eventID", () => {
    const win: Parameters<typeof ensureMetaPixel>[0] = {};
    const { doc } = fakeDocument("https://reddoorla.com/brand-friction-audit");
    const send = vi.fn();

    trackFunnelPageView(win, doc, "accepted", send);
    trackFunnelPageView(win, doc, "accepted", send);

    const tracks = win.fbq!.queue.filter((c) => c[0] === "track");
    expect(send).toHaveBeenCalledTimes(2);
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

  it.each<[Consent]>([["rejected"], [null]])(
    "with consent %j, neither the pixel nor the server hears anything",
    (consent) => {
      const win: Parameters<typeof ensureMetaPixel>[0] = {};
      const { doc, appended } = fakeDocument();
      const send = vi.fn();
      trackFunnelPageView(win, doc, consent, send);
      expect(send).not.toHaveBeenCalled();
      expect(win.fbq).toBeUndefined();
      expect(appended).toHaveLength(0);
    },
  );
});
