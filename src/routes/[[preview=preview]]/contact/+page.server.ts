import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  return {
    title: "Contact | Reddoor Creative",
    meta_description: "We design beautiful marketing materials that help you thrive. Talk to us.",
    meta_title: "Contact | Reddoor Creative",
    meta_image: metaImage,
  };
};
