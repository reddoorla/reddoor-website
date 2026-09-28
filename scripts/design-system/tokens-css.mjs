const esc = (name) => name.replace(/\./g, "\\.");

const colorValue = (v) =>
  typeof v === "string" && /^\{.+\}$/.test(v) ? `var(--${esc(v.slice(1, -1))})` : v;

const px = (v) => (typeof v === "number" ? `${v}px` : v);

export function tokensToCss(tokens) {
  const out = [];
  const themes = tokens.color?.themes ?? [{ id: "light" }];
  const first = themes[0].id;
  const perTheme = (theme) => {
    const lines = [];
    for (const t of tokens.color?.tokens ?? []) {
      const v = typeof t.value === "string" ? (theme === first ? t.value : null) : t.value[theme];
      if (v) lines.push(`  --${esc(t.name)}: ${colorValue(v)};`);
    }
    for (const t of tokens.shadow?.tokens ?? []) {
      const v = typeof t.value === "string" ? (theme === first ? t.value : null) : t.value[theme];
      if (v) lines.push(`  --${esc(t.name)}: ${v};`);
    }
    return lines;
  };
  out.push(`:root, [data-theme="${first}"] {`, ...perTheme(first), "}");
  for (const th of themes.slice(1)) out.push(`[data-theme="${th.id}"] {`, ...perTheme(th.id), "}");
  const root = [];
  for (const [key, fam] of Object.entries(tokens)) {
    if (["color", "type", "shadow", "name", "version", "meta"].includes(key)) continue;
    for (const t of fam?.tokens ?? []) root.push(`  --${esc(t.name)}: ${px(t.value)};`);
  }
  for (const [key, stack] of Object.entries(tokens.type?.families ?? {}))
    root.push(`  --font-${key}: ${stack};`);
  out.push(":root {", ...root, "}");
  for (const group of tokens.type?.groups ?? []) {
    for (const s of group.styles) {
      const fam = s.family ?? group.family;
      const decl = [
        fam ? `font-family: var(--font-${fam})` : null,
        `font-size: ${px(s.fontSize)}`,
        s.lineHeight != null ? `line-height: ${s.lineHeight}` : null,
        s.fontWeight != null ? `font-weight: ${s.fontWeight}` : null,
        s.letterSpacing ? `letter-spacing: ${px(s.letterSpacing)}` : null,
        s.fontStyle ? `font-style: ${s.fontStyle}` : null,
      ].filter(Boolean);
      out.push(`.${esc(s.name)} { ${decl.join("; ")}; }`);
    }
  }
  for (const f of tokens.type?.fonts ?? []) {
    const file = f.file.includes("/") ? f.file : `fonts/${f.file}`;
    out.push(
      `@font-face { font-family: "${f.family}"; src: url("/project/${file}"); font-weight: ${f.weight ?? "400"}; font-style: ${f.style ?? "normal"}; font-display: swap; }`,
    );
  }
  return out.join("\n");
}
