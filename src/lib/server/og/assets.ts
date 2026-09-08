import * as b64 from "virtual:og-assets";
import type { CardAssets } from "$lib/og/card";

// Decoded once per process. Satori takes images as data: URIs and fonts as
// bytes; resvg takes its wasm as bytes.
let cached: CardAssets | undefined;
export function cardAssets(): CardAssets {
  cached ??= {
    besley: Buffer.from(b64.besley, "base64"),
    inter: Buffer.from(b64.inter, "base64"),
    texture: `data:image/jpeg;base64,${b64.texture}`,
    mark: `data:image/png;base64,${b64.mark}`,
    wasm: Buffer.from(b64.wasm, "base64"),
  };
  return cached;
}
