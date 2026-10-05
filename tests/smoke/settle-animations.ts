import { expect, type Page } from "@playwright/test";

/**
 * Waits until no finite animation is running, so an axe scan measures settled
 * colours. Svelte's JS transitions (the header's `fly`, the layout's page fade)
 * run on the Web Animations API whatever the reduced-motion setting, and a scan
 * taken mid-fade reads every colour blended toward the ground: the header's
 * black labels measured #818181 on white, 3.89:1, during its fly-in.
 * Infinite animations (spinners) never finish, so they are left out.
 */
export async function settleAnimations(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) =>
                  a.playState === "running" &&
                  Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity),
              ).length,
        ),
      { message: "finite animations still running before the axe scan", timeout: 15_000 },
    )
    .toBe(0);
}
