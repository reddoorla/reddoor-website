import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { renderCard, type CardAssets } from "./card";

const require = createRequire(import.meta.url);
const root = new URL("../../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root));
const dataUri = (p: string, mime: string) => `data:${mime};base64,${read(p).toString("base64")}`;

// The same files src/lib/server/og/assets.ts inlines through Vite, read from
// disk here so the renderer is tested without the SvelteKit plugin stack.
const assets: CardAssets = {
  besley: read("src/lib/assets/og/fonts/besley-400-latin.ttf"),
  inter: read("src/lib/assets/og/fonts/inter-300-latin.ttf"),
  texture: dataUri("src/lib/assets/og/texture.jpg", "image/jpeg"),
  mark: dataUri("src/lib/assets/icons/logos/reddoor_logo.png", "image/png"),
  wasm: readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")),
};

/** PNG: 8-byte signature, then the IHDR chunk whose data starts at byte 16. */
function pngSize(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("renderCard", () => {
  it("renders a 1200×630 PNG", async () => {
    const png = await renderCard("Portfolio", assets);
    expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
  });

  it("is deterministic for the same input", async () => {
    const a = await renderCard("MedTech", assets);
    const b = await renderCard("MedTech", assets);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("copes with a long headline without throwing", async () => {
    const png = await renderCard(
      "We save you from drowning in an ocean of noise by arming you.",
      assets,
    );
    expect(pngSize(png).height).toBe(630);
  });
});
