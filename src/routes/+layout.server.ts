import { createClient } from "$lib/prismicio";
import { filter } from "@prismicio/client";
import type { LayoutServerLoad } from "./$types";

export const prerender = "auto";

export const load: LayoutServerLoad = async ({ url, fetch, cookies }) => {
  const { pathname } = url;
  const client = createClient({ fetch, cookies });
  const latestFourProjects = await client.getByType("project", {
    orderings: {
      field: "document.first_publication_date",
      direction: "desc",
    },

    filters: [filter.not("document.tags", ["hide"])],
    pageSize: 4,
  });

  return {
    pathname,
    latestFourProjects,
  };
};
