import { describe, it, expect, vi } from "vitest";
import { globSync } from "node:fs";
import { render } from "svelte/server";
import { ssr } from "$lib/report/ssr-test-harness";

const state = vi.hoisted(() => ({
  page: { status: 404, error: { message: "Not Found" } as { message: string } | null },
}));
vi.mock("$app/state", () => state);
// The unit config has no Svelte plugin, so the page's one component import is
// compiled by the same harness as the page.
vi.mock("$lib/components/ContentWidth/ContentWidth.svelte", async () => {
  const harness = await import("$lib/report/ssr-test-harness");
  return { default: await harness.ssr("src/lib/components/ContentWidth/ContentWidth.svelte") };
});

const project = (uid: string, title: string) => ({
  uid,
  data: { title, hero: { url: `https://images.prismic.io/r/${uid}.jpg?auto=format` } },
});
const data = {
  latestFourProjects: {
    results: [project("alpha", "Alpha"), project("bravo", "Bravo"), project("charlie", "Charlie")],
  },
};

const ErrorPage = await ssr<{ data: typeof data }>("src/routes/+error.svelte");

const renderAt = (status: number, message: string) => {
  state.page = { status, error: { message } };
  return render(ErrorPage, { props: { data } });
};

const text = (html: string) =>
  html
    .replace(/<!--.*?-->/gs, "")
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const title = (head: string) => head.match(/<title>(.*?)<\/title>/s)?.[1];
const robots = (head: string) =>
  head.match(/<meta\b(?=[^>]*\bname="robots")[^>]*\bcontent="([^"]*)"/)?.[1];
const h1s = (body: string) => [...body.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gs)].map((m) => text(m[1]));
const links = (body: string) =>
  [...body.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>(.*?)<\/a>/gs)].map(([, href, inner]) => ({
    href,
    name: text(inner),
  }));

/**
 * One 404 page, at the root.
 *
 * The site had two: a designed one under the `[uid]` routes (rendered only
 * when one of those routes matched and its loader threw) and the plain root
 * fallback for everything else — so `/nope` got the designed page and
 * `/nope/deeper` got "Error 404 / Back to home". Every nested `+error.svelte`
 * was a copy of the same file. The root boundary catches every 404 the site
 * can produce with the same layout and the same data, so the designed page
 * belongs there and nowhere else.
 */
describe("the 404 page", () => {
  const errorPages = globSync("src/routes/**/+error.svelte");

  it("is the one error page in the tree", () => {
    expect(errorPages).toEqual(["src/routes/+error.svelte"]);
  });

  it("says what it is in its heading and its title, and stays out of search", () => {
    const { head, body } = renderAt(404, "Not Found");
    expect(h1s(body)).toContainEqual(expect.stringMatching(/not found/i));
    expect(title(head)).toMatch(/not found/i);
    expect(robots(head)).toMatch(/noindex/);
  });

  it("links each of the latest projects to its page, by name", () => {
    const { body } = renderAt(404, "Not Found");
    for (const { uid, data: project } of data.latestFourProjects.results) {
      expect(links(body)).toContainEqual({
        href: `/portfolio/${uid}`,
        name: expect.stringContaining(project.title),
      });
    }
  });

  it("keeps the giant 404 out of the page's text", () => {
    // The giant "404" is a 20% tint of the brand red on white — contrast 1.39
    // against a 3:1 minimum for large text. It is pure decoration, which WCAG
    // exempts from contrast and axe cannot know: so it is CSS-generated
    // content inside an aria-hidden wrapper (not text at all), and the page's
    // real heading is a visually-hidden h1. This surfaced the moment the page
    // became the root boundary, because the fleet a11y audit scans a /dev
    // route this site does not have and so has been scanning the 404 page.
    // Copy may say 404; an element whose whole text is 404 is the watermark.
    const { body } = renderAt(404, "Not Found");
    expect(body.replace(/<!--.*?-->/gs, "")).not.toMatch(/>\s*404\s*</);
  });
});

describe("the error page for any other status", () => {
  const message = "Content is temporarily unavailable — please try again.";

  it("passes the error's message on, offers the way home, and never says not found", () => {
    const { head, body } = renderAt(503, message);
    expect(text(body)).toContain(message);
    expect(links(body)).toContainEqual(expect.objectContaining({ href: "/" }));
    expect(h1s(body).length).toBeGreaterThan(0);
    expect(text(body)).not.toMatch(/not found/i);
    expect(title(head)).not.toMatch(/not found/i);
    expect(robots(head)).toMatch(/noindex/);
  });
});
