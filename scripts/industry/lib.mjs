// Pure guards shared by the industry pipeline's scripts.
//
// These are the pipeline's safety property — a copied city folder must never
// write over another city's document, and an unsafe --industry must never
// become a path — so they live here with tests rather than inline in a script
// that only ever runs by hand.

/** The uid named by `--industry <uid>`, or undefined when missing or unsafe.
 *  Lower-case letters, digits and hyphens only, so it can never be a path
 *  (`../boise`) or the next flag (`--industry --dry-run`). */
export function industryFromArgs(args) {
  const at = args.indexOf("--industry");
  const uid = at >= 0 ? args[at + 1] : undefined;
  if (!uid || uid.startsWith("-") || !/^[a-z0-9-]+$/.test(uid)) return undefined;
  return uid;
}

/** Why a data file must not be loaded under this --industry, or null. A
 *  copied data.json whose uid was not changed would otherwise overwrite the
 *  wrong document. */
export function uidMismatch(dataUid, industry) {
  if (dataUid === industry) return null;
  return `has uid "${dataUid}" but --industry is "${industry}". The folder name and the document uid must agree.`;
}

/** Dotted paths the loader dereferences before the field-level model check,
 *  so a copied data.json missing one fails by name, not with a TypeError. */
export function missingRequiredKeys(d) {
  const missing = [];
  if (!d?.featuredProject?.link?.uid) missing.push("featuredProject.link.uid");
  if (!Array.isArray(d?.logoGrid?.logos)) missing.push("logoGrid.logos");
  return missing;
}
