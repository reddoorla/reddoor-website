import { loadReport } from "$lib/report/load";
import type { PageServerLoad } from "./$types";

// Same reasoning as the page beside it: one prospect's private report, nothing
// to prerender.
export const prerender = false;

// Identical guards to the interactive page, by construction rather than by
// copy — see loadReport. This route is the one the PDF is printed from, so it
// is fetched by our own runner rather than a person, but it is served on the
// same public token and must refuse exactly what the page refuses.
export const load: PageServerLoad = async (event) => loadReport(event);
