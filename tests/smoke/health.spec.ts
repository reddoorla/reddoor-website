import { test, expect } from "@playwright/test";

test("/health reports whether this deploy shows hidden content", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  // `vite dev` shows hidden content so the suite sees every published
  // document. Production answers "hidden"; the staging site answers "shown".
  expect(body.hiddenContent).toBe("shown");
});
