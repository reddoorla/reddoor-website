/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  // NOTE: no `safelist` here — Tailwind v4 ignores that legacy key entirely.
  // CMS-composed classes are declared via `@source inline(...)` in app.css.
  theme: {
    screens: {
      sm: "560px",
      md: "768px",
      lg: "1024px",
      xl: "1340px",
      xxl: "1600px",
    },
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: "#000",
      white: "#fff",
      light: "#BBBDBF",
      // Two grays introduced by the industry landing pages.
      //
      // `muted` is body text. The board specifies #8B8C8D, which is 3.36:1 on
      // white at 14px — under the 4.5:1 WCAG AA floor. Note the binding
      // constraint is NOT white: `muted` also lands on the `.bg-paper`
      // watercolour texture (Testimonial), whose median luminance is 0.9216,
      // and every ratio there is ~0.34 lower than on white. #6E6F72 is the
      // nearest value on the board's cool axis that clears AA against paper
      // (4.65:1, and 5.02:1 on white); it is not perceptibly different from the
      // comp. Size any future adjustment against paper, not white — a value
      // tuned to white alone lands just under the floor on the textured bands.
      // axe cannot catch this: `.bg-paper` paints a background-image, so the
      // rule falls back to the transparent background-color and reports white.
      //
      // `band` is a foreground: the FeaturedProject caption arrow. It is only
      // ever drawn over the card's own dark scrim, never as a fill.
      muted: "#6E6F72",
      band: "#E7E8EB",
      mid: "#6c6d70",
      gray: "#C2D1D9",
      dark: "#424B5A",
      primary: "#D71920",
      red: "#D71920",
      "primary-dark": "#aa1419",
    },
    extend: {
      fontFamily: {
        sans: ["pragmatica", "helvetica", "sans-serif"],
        serif: ["Besley", "serif"],
      },
      transitionTimingFunction: {
        "in-expo": "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
        "out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
        "fast-slow": "cubic-bezier(.5,0,0,1)",
      },
      height: {
        "screen-75": "75vh",
        "screen-50": "50vh",
        "screen-25": "25vh",
        "screen-10": "10vh",
        "screen-5": "5vh",
        112: "28rem",
        128: "32rem",
        144: "36rem",
        160: "40rem",
        192: "48rem",
        256: "64rem",
        384: "96rem",
        512: "128rem",
        640: "160rem",
        full: "100%",
        screen: "100vh",
        min: "min-content",
        max: "max-content",
        fit: "fit-content",
        proportion: "proportion",
      },
      borderWidth: {
        1: "1px",
      },
    },
  },
  plugins: [],
};
