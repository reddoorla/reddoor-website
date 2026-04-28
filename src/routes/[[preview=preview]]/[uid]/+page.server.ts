import { asText } from "@prismicio/client";
import { createClient } from "$lib/prismicio";
import { error } from "@sveltejs/kit";
import type { PageServerLoad, EntryGenerator } from "./$types";

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let page;

  try {
    page = await client.getByUID("page", params.uid);
  } catch {
    throw error(404, {
      message: "Page Not Found",
    });
  }

  return {
    page,
    title: asText(page.data.title),
    meta_description: page.data.meta_description,
    meta_title: page.data.meta_title,
    meta_image: page.data.meta_image.url,
  };
};

export const entries: EntryGenerator = async () => {
  const client = createClient();
  const pages = await client.getAllByType("page");

  return pages.map((page) => {
    return { uid: page.uid };
  });
};
