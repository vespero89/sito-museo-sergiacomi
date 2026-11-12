// Helpers of the Foto component (spec 7): which widths to build for a photo.

/** The widths of the `srcset`, from small phones to wide screens. */
export const LARGHEZZE = [480, 800, 1200, 1600];

/**
 * Widths to build for a photo that is `larghezza` px wide. A photo is never enlarged: the last
 * step is its own width when it is narrower than the top of the scale. `max` lowers the top.
 */
export function larghezzePerSrcset(
  larghezza: number,
  { max = LARGHEZZE[LARGHEZZE.length - 1]! }: { max?: number } = {},
): number[] {
  if (!Number.isInteger(larghezza) || larghezza <= 0) {
    throw new Error(`the width of a photo must be a positive integer, got ${larghezza}`);
  }
  const tetto = Math.min(larghezza, max);
  return [...LARGHEZZE.filter((w) => w < tetto), tetto];
}
