import { ogCardPath } from "$lib/og/url";

// The index has no document to load; this only names its share card.
export const load = () => ({ meta_image: ogCardPath("site", "showcase") });
