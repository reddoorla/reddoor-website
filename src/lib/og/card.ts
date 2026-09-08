import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { headlineSize } from "./headline";

/** Everything the renderer needs, injected so this module has no import-time
 *  dependency on Vite (unit tests read the same files from disk). */
export type CardAssets = {
  besley: ArrayBuffer | Buffer;
  inter: ArrayBuffer | Buffer;
  /** data: URIs — satori resolves images itself and must not touch the network. */
  texture: string;
  mark: string;
  wasm: ArrayBuffer | Buffer | Uint8Array;
};

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const RED = "#d71920";
const GREY = "#6e6f72";
// reddoor_logo.png is 240×152; satori wants explicit image boxes.
const MARK_W = 120;
const MARK_H = 76;

let wasmReady: Promise<void> | undefined;
function ensureWasm(bytes: CardAssets["wasm"]) {
  // initWasm throws on a second call, so the promise is memoised for the
  // process. The bytes are the same every time; the first caller's win.
  wasmReady ??= initWasm(bytes as BufferSource).catch((err: unknown) => {
    // Another importer (a test file, a hot reload) may already have initialised it.
    if (String(err).includes("Already initialized")) return;
    throw err;
  });
  return wasmReady;
}

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, children },
});

/** The PR #138 card, as satori's element tree: paper texture, eyebrow, red
 *  Besley headline low-left, footer with the site and the door mark. */
function tree(headline: string, assets: CardAssets) {
  return el(
    "div",
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "72px 84px 64px",
      backgroundColor: "#f4f1ea",
      backgroundImage: `url(${assets.texture})`,
      backgroundSize: "300px 300px",
      backgroundRepeat: "repeat",
      fontFamily: "Besley",
    },
    [
      el("div", { fontFamily: "Inter", fontSize: 26, letterSpacing: 6, color: "#000" }, "REDDOOR CREATIVE"),
      el(
        "div",
        {
          fontSize: headlineSize(headline),
          lineHeight: 1.12,
          color: RED,
          maxWidth: 950,
          marginTop: "auto",
          paddingBottom: 28,
        },
        headline,
      ),
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
        el("div", { fontFamily: "Inter", fontSize: 24, letterSpacing: 2, color: GREY }, "reddoorla.com"),
        { type: "img", props: { src: assets.mark, width: MARK_W, height: MARK_H } },
      ]),
    ],
  );
}

export async function renderCard(headline: string, assets: CardAssets): Promise<Uint8Array> {
  await ensureWasm(assets.wasm);
  const svg = await satori(tree(headline, assets) as never, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: [
      { name: "Besley", data: assets.besley, weight: 400, style: "normal" },
      { name: "Inter", data: assets.inter, weight: 300, style: "normal" },
    ],
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: CARD_WIDTH } });
  const png = resvg.render();
  try {
    return png.asPng();
  } finally {
    png.free();
    resvg.free();
  }
}
