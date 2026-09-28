import { toReportView } from "$lib/report/model";
import { unwrap } from "$lib/report/fetch";
import { allFixes, healthFixes, headlineFinding, passes } from "$lib/report/narrative";
import { ALL_PASS_REPORT } from "$lib/report/fixtures/all-pass";
import allFlagged from "$lib/report/fixtures/producer/11111111.json";
import noneFlagged from "$lib/report/fixtures/producer/00000000.json";

export const report = {
  toReportView,
  unwrap,
  allFixes,
  healthFixes,
  headlineFinding,
  passes,
  fixtures: { allPass: ALL_PASS_REPORT, allFlagged, noneFlagged },
};
