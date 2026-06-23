import { asText, type RichTextField } from "@prismicio/client";
import type { ProjectDocument, RichTextSlice, RichTextSliceDefault } from "../../prismicio-types";

const SERVICE_LABELS = [
  "Brand",
  "Product",
  "Print",
  "Environmental",
  "Packaging",
  "Digital",
] as const;

export function mediumString(project: ProjectDocument | undefined): string {
  if (!project) return "";
  const flags = [
    project.data.branding,
    project.data.product,
    project.data.print,
    project.data.environmental,
    project.data.packaging,
    project.data.digital,
  ];
  return flags.reduce<string>((acc, on, i) => {
    if (!on) return acc;
    return acc ? `${acc}, ${SERVICE_LABELS[i]}` : SERVICE_LABELS[i];
  }, "");
}

export interface ProjectSearchRecord {
  uid: string;
  title: string;
  services: string;
  tagline: string;
  body: string;
}

/**
 * Flattens a project into the text fields the portfolio search indexes:
 * title, its service labels, its tagline, and the first body paragraph
 * (the first block of the first rich_text slice). Missing fields degrade
 * to "".
 */
export function toSearchRecord(project: ProjectDocument): ProjectSearchRecord {
  // The find() type-guard narrows to RichTextSlice, but `.primary` still resolves
  // to the union of all slice primaries (a SharedSlice quirk), so the cast to the
  // single rich_text variation is required to reach `.content`.
  const firstRichText = project.data.slices.find(
    (s): s is RichTextSlice => s.slice_type === "rich_text",
  ) as RichTextSliceDefault | undefined;
  // Index only the FIRST paragraph (first block) — full-body search is out of
  // scope. RichTextField is a non-empty tuple, so slice()'s RTNode[] must be
  // re-typed for asText; the cast is required, not cosmetic.
  const firstBlock = firstRichText?.primary.content?.slice(0, 1) ?? [];
  const body = asText(firstBlock as RichTextField) ?? "";
  return {
    uid: project.uid ?? "",
    title: project.data.title ?? "",
    services: mediumString(project),
    tagline: project.data.tagline ?? "",
    body,
  };
}
