import { createClient } from "$lib/prismicio";
import { isFilled } from "@prismicio/client";
import type { ProjectDocument } from "../../../../prismicio-types.js";
import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let page;

  try {
    // fetchLinks resolves each ContentWidthMedia item's `gallery` relationship so a
    // slideshow item can render its gallery's images (one level: gallery.images).
    page = await client.getByUID("showcase", params.uid, { fetchLinks: ["gallery.images"] });
  } catch {
    throw error(404, {
      message: "Showcase not found",
    });
  }

  // isFilled.contentRelationship does NOT exclude broken links (an unpublished
  // target keeps its uid but getByUID throws), so guard isBroken AND catch —
  // an editor unpublishing a referenced project must degrade, not 500 the page.
  let featuredProject;
  if (
    isFilled.contentRelationship(page.data.featuredproject) &&
    !page.data.featuredproject.isBroken &&
    page.data.featuredproject.uid
  ) {
    try {
      featuredProject = await client.getByUID("project", page.data.featuredproject.uid);
    } catch {
      featuredProject = undefined;
    }
  }

  // Pair each resolved doc with ITS OWN group row. The template previously read
  // overrides by `pageData.projects[i]` against this filtered array — one
  // skipped (unfilled/broken) row shifted every subsequent card's
  // image/title/subtitle/link overrides onto the wrong project.
  const projects: { doc: ProjectDocument; item: (typeof page.data.projects)[number] }[] = [];
  for (const item of page.data.projects) {
    if (!isFilled.contentRelationship(item.project) || item.project.isBroken || !item.project.uid)
      continue;
    try {
      projects.push({ doc: await client.getByUID("project", item.project.uid), item });
    } catch {
      // Target unpublished/deleted since the group was authored — skip the row.
    }
  }

  return {
    page,
    featuredProject,
    projects,
    title: page.data.title + " | Reddoor Creative",
    meta_description:
      page.data.meta_description ||
      page.data.tagline ||
      page.data.title + " | Better design means better business",
    meta_title: page.data.meta_title || page.data.title + " | Reddoor Creative",
    meta_image: page.data.meta_image.url || metaImage,
  };
};

export async function entries() {
  const client = createClient();
  const pages = await client.getAllByType("showcase");

  return pages
    .filter((page) => page.uid)
    .map((page) => {
      return { uid: page.uid };
    });
}
