import { ALL_PASS_REPORT } from "$lib/report/fixtures/all-pass";
import type { OverrideMap } from "$lib/report/fetch";

export const load = () => ({
  report: ALL_PASS_REPORT,
  overrides: {} as OverrideMap,
  approved: true,
  meta_referrer: "no-referrer",
  siteChrome: false,
});
