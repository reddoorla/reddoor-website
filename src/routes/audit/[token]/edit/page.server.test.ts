import { describe, it, expect, vi, beforeEach } from "vitest";

// `vi.hoisted`, not a plain `const`, because `vi.mock` is hoisted above every
// statement in the file: a factory closing over a top-level `const env` reads it
// in its temporal dead zone and the whole suite fails to load. This is the
// mutable-env equivalent of the inline literal used by the sibling
// src/routes/audit/[token]/page.server.test.ts, which needs no mutation.
const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock("$env/dynamic/private", () => ({ env }));
vi.mock("$lib/report/load", () => ({
  loadReport: vi.fn(async () => ({
    report: { url: "https://acme.test/" },
    overrides: {},
    meta_referrer: "no-referrer",
  })),
}));

import { load } from "./+page.server";

const TOKEN = "aB3-_xY9zQ1rS2tU4vW6xY";

function evt(url: string, cookieValue?: string) {
  const set = vi.fn();
  return {
    params: { token: TOKEN },
    url: new URL(url),
    fetch: globalThis.fetch,
    setHeaders: vi.fn(),
    cookies: { get: vi.fn(() => cookieValue), set },
    _set: set,
  };
}

/**
 * Load, for the cases that RENDER rather than throw.
 *
 * `PageServerLoad` types its return as `void | PageData`, because a load is
 * allowed to return nothing — so reading a property straight off the result
 * does not typecheck, and CI runs svelte-check. Narrowing here by throwing
 * keeps a load that unexpectedly returned nothing a test failure with a
 * sentence attached, rather than a cast that would quietly compare `undefined`
 * against `undefined` and pass.
 */
async function render(e: ReturnType<typeof evt>): Promise<Record<string, unknown>> {
  const data = await load(e as never);
  if (!data) throw new Error("expected the load to return page data, got nothing");
  return data;
}

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  env.REPORT_EDIT_KEY = "s3cret";
});

describe("the edit route", () => {
  it("fails closed when REPORT_EDIT_KEY is unset", async () => {
    delete env.REPORT_EDIT_KEY;
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit?k=s3cret`) as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s with no key and no cookie", async () => {
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit`) as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s a wrong key", async () => {
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit?k=wrong`) as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("sets an HttpOnly cookie and redirects the key out of the URL", async () => {
    const e = evt(`https://reddoorla.com/audit/${TOKEN}/edit?k=s3cret`);
    await expect(load(e as never)).rejects.toMatchObject({ status: 303 });
    expect(e._set).toHaveBeenCalledWith(
      "reddoor_report_edit",
      "s3cret",
      expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/audit" }),
    );
  });

  it("renders for a valid cookie with no key in the URL", async () => {
    const data = await render(evt(`https://reddoorla.com/audit/${TOKEN}/edit`, "s3cret"));
    expect(data.editing).toBe(true);
    expect(data.report).toEqual({ url: "https://acme.test/" });
  });

  it("never indexes and never leaks the URL as a referrer", async () => {
    const data = await render(evt(`https://reddoorla.com/audit/${TOKEN}/edit`, "s3cret"));
    expect(data.meta_robots).toBe("noindex, nofollow");
    expect(data.meta_referrer).toBe("no-referrer");
  });
});

// REPORT_EDIT_KEY is pasted into Netlify's environment UI by a human, and
// `openssl rand -base64 32 | pbcopy` is exactly how a trailing newline gets
// there. Untrimmed, that newline 404s every arrival with no log line, and the
// operator sees an edit address that simply does not work — indistinguishable
// from a wrong key or a missing report.
describe("the edit route — a configured key with stray whitespace", () => {
  it("accepts the key the operator actually has in their link", async () => {
    env.REPORT_EDIT_KEY = "s3cret\n";
    const e = evt(`https://reddoorla.com/audit/${TOKEN}/edit?k=s3cret`);
    await expect(load(e as never)).rejects.toMatchObject({ status: 303 });
    expect(e._set).toHaveBeenCalled();
  });

  it("accepts a cookie against the trimmed value", async () => {
    env.REPORT_EDIT_KEY = "  s3cret  ";
    const data = await render(evt(`https://reddoorla.com/audit/${TOKEN}/edit`, "s3cret"));
    expect(data.editing).toBe(true);
  });

  // Not "a secret made of spaces that nothing can present" — that would fail
  // closed silently, forever. It is unset, and it says so.
  it("treats a whitespace-only value as unset, and logs", async () => {
    env.REPORT_EDIT_KEY = "   \n";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit?k=%20%20%20%0A`) as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("warns on the key-in-URL path, so the misconfiguration is visible", async () => {
    env.REPORT_EDIT_KEY = "s3cret\n";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit?k=s3cret`) as never),
    ).rejects.toMatchObject({ status: 303 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("REPORT_EDIT_KEY"));
    warn.mockRestore();
  });

  it("warns on the cookie path too", async () => {
    env.REPORT_EDIT_KEY = "s3cret\n";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await load(evt(`https://reddoorla.com/audit/${TOKEN}/edit`, "s3cret") as never);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("REPORT_EDIT_KEY"));
    warn.mockRestore();
  });

  it("stays quiet when the configured value is clean", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await load(evt(`https://reddoorla.com/audit/${TOKEN}/edit`, "s3cret") as never);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  // The whole point of placing the warning behind the key check. The CONDITION
  // is a property of the deployment, so the line must never be reachable by
  // someone who cannot already edit — otherwise a scanner drives this deploy's
  // logs and buries the one line the operator needs. Every unauthenticated
  // shape is covered: no credential at all, a wrong key, and a forged cookie
  // (HttpOnly and SameSite constrain browsers, not curl).
  it("cannot be provoked by an unauthenticated caller", async () => {
    env.REPORT_EDIT_KEY = "s3cret\n";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit`) as never),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit?k=wrong`) as never),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      load(evt(`https://reddoorla.com/audit/${TOKEN}/edit`, "wrong") as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
