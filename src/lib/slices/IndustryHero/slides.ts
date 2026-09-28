import { isFilled, type ImageField } from "@prismicio/client";

type HeroImages = {
  image: ImageField;
  images?: ReadonlyArray<{ image: ImageField }> | null;
};

export function heroSlides(primary: HeroImages): ImageField[] {
  return [primary.image, ...(primary.images ?? []).map((item) => item.image)].filter(
    (field): field is ImageField => isFilled.image(field),
  );
}
