/**
 * Legacy-aware slice padding: docs authored before the top/bottom split carry
 * only `hasPadding`; newer docs carry `hasTopPadding`/`hasBottomPadding`.
 * Shared by the media/text slices that grew up with the legacy flag — each
 * used to inline this exact fallback chain (2026-07-16 brief, MED-15).
 *
 * `fallback` is the slice's historical default when NO padding field is set
 * (ScreenWidthMedia defaults to false, the others to true) — keep each call
 * site's value identical to its old inline chain.
 */
export interface SlicePadding {
  padTop: boolean;
  padBottom: boolean;
}

export function resolvePadding(primary: unknown, fallback = true): SlicePadding {
  const p = primary as {
    hasTopPadding?: boolean | null;
    hasBottomPadding?: boolean | null;
    hasPadding?: boolean | null;
  };
  return {
    padTop: p.hasTopPadding ?? p.hasPadding ?? fallback,
    padBottom: p.hasBottomPadding ?? p.hasPadding ?? fallback,
  };
}
