import type { ProjectDocument } from "../../prismicio-types";

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
