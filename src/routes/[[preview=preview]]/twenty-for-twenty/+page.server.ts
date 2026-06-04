import metaImage from "$lib/assets/images/20_4_20_key_art.jpg";
import { createClient } from "$lib/prismicio.js";
import { isFilled } from "@prismicio/client";
import type { ProjectDocument } from "../../../prismicio-types.js";
import type { ImageField } from "@prismicio/client";
import type { PageServerLoad } from "./$types";
import { mediumString } from "$lib/utils/projectServices";

type ProjectCard = {
  number: number;
  name: string | null | undefined;
  image: ImageField | null | undefined;
  body: string | null | undefined;
  dates: string | null | undefined;
  mediums: string;
  href: string | null | undefined;
};

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  const projectArrayQuery = await client.getAllByType("twenty_for_twenty");

  // Use Promise.all with map instead of forEach
  const projectCards: ProjectCard[] = await Promise.all(
    projectArrayQuery.map(async (q) => {
      let linkedProject;
      if (isFilled.contentRelationship(q.data.project)) {
        linkedProject = (await client.getByID(q.data.project.id)) as ProjectDocument<string>;
      }

      let imageField = linkedProject?.data.meta_image;
      if (isFilled.image(linkedProject?.data.hero)) imageField = linkedProject?.data.hero;
      if (isFilled.image(linkedProject?.data.featured_image))
        imageField = linkedProject?.data.featured_image;
      if (isFilled.image(q.data.image_override)) imageField = q.data.image_override;

      let projLink = linkedProject?.url;
      if (isFilled.link(q.data.link_override)) projLink = q.data.link_override.url;

      return {
        number: q.data.number || 0,
        name: q.data.name_override || linkedProject?.data.title,
        image: imageField,
        body: q.data.body || linkedProject?.data.tagline,
        dates: q.data.dates || "",
        mediums: q.data.mediums_override || mediumString(linkedProject),
        href: projLink,
      };
    }),
  );

  projectCards.sort((a, b) => a.number - b.number);

  return {
    title: "20 for 20 | Reddoor Creative",
    meta_description:
      "In our twenty years we've been privileged to work with amazing clients on hundreds of projects. Here are twenty of our favorites.",
    meta_title: "20 for 20 | Reddoor Creative",
    meta_image: metaImage,
    projectCards,
  };
};
