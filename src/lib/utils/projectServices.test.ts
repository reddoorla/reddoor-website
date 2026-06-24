import { describe, it, expect } from "vitest";
import { mediumString, toSearchRecord } from "./projectServices";
import type { ProjectDocument } from "../../prismicio-types";

type Services = Partial<
  Record<"branding" | "product" | "print" | "environmental" | "packaging" | "digital", boolean>
>;

// Minimal ProjectDocument factory — only the fields the search utils actually
// read. `!== undefined` defaulting lets a test pass an explicit `null` (to
// exercise the "" coercions) without it being swallowed by `??`.
function makeProject(
  overrides: {
    uid?: string | null;
    title?: string | null;
    tagline?: string | null;
    services?: Services;
    slices?: unknown[];
  } = {},
): ProjectDocument {
  const s = overrides.services ?? {};
  return {
    uid: overrides.uid !== undefined ? overrides.uid : "a-project",
    data: {
      title: overrides.title !== undefined ? overrides.title : "A Project",
      tagline: overrides.tagline !== undefined ? overrides.tagline : "",
      branding: s.branding ?? false,
      product: s.product ?? false,
      print: s.print ?? false,
      environmental: s.environmental ?? false,
      packaging: s.packaging ?? false,
      digital: s.digital ?? false,
      slices: overrides.slices ?? [],
    },
  } as unknown as ProjectDocument;
}

describe("mediumString", () => {
  it("returns '' for an undefined project", () => {
    expect(mediumString(undefined)).toBe("");
  });

  it("returns '' when no services are set", () => {
    expect(mediumString(makeProject())).toBe("");
  });

  it("joins active services in canonical order, regardless of input order", () => {
    expect(
      mediumString(makeProject({ services: { digital: true, branding: true, print: true } })),
    ).toBe("Brand, Print, Digital");
  });

  it("renders a single service with no separator", () => {
    expect(mediumString(makeProject({ services: { packaging: true } }))).toBe("Packaging");
  });
});

describe("toSearchRecord", () => {
  it("flattens title, service labels, and tagline", () => {
    const rec = toSearchRecord(
      makeProject({
        uid: "lonehollow",
        title: "Lonehollow Ranch",
        tagline: "A Texas summer camp",
        services: { branding: true, environmental: true },
      }),
    );
    expect(rec).toMatchObject({
      uid: "lonehollow",
      title: "Lonehollow Ranch",
      services: "Brand, Environmental",
      tagline: "A Texas summer camp",
    });
  });

  it("indexes only the first paragraph of the first rich_text slice", () => {
    const project = makeProject({
      slices: [
        { slice_type: "image", primary: {} },
        {
          slice_type: "rich_text",
          primary: {
            content: [
              { type: "paragraph", text: "First paragraph.", spans: [] },
              { type: "paragraph", text: "Second paragraph.", spans: [] },
            ],
          },
        },
      ],
    });
    expect(toSearchRecord(project).body).toBe("First paragraph.");
  });

  it("degrades body to '' when there is no rich_text slice", () => {
    expect(
      toSearchRecord(makeProject({ slices: [{ slice_type: "image", primary: {} }] })).body,
    ).toBe("");
  });

  it("coerces missing uid / title / tagline to ''", () => {
    const rec = toSearchRecord(makeProject({ uid: null, title: null, tagline: null }));
    expect(rec.uid).toBe("");
    expect(rec.title).toBe("");
    expect(rec.tagline).toBe("");
    expect(rec.services).toBe("");
  });
});
