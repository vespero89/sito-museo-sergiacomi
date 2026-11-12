// The biography timeline (spec 6, task 10): order of the entries and the link to the works.

/** Years covered by the works of the catalogue: `/opere/?fino=` only makes sense inside them. */
export const LIMITI_OPERE = { da: 1934, a: 1994 } as const;

/** By year, then by date, then by id: the same order on every build. */
export function ordinaVoci<
  T extends { id: string; data: { anno: number; data?: string | undefined } },
>(voci: readonly T[]): T[] {
  return [...voci].sort(
    (a, b) =>
      a.data.anno - b.data.anno ||
      (a.data.data ?? '').localeCompare(b.data.data ?? '') ||
      a.id.localeCompare(b.id),
  );
}

/** The map and list of the works up to a year, or nothing for a year outside 1934-1994. */
export function indirizzoOpere(anno: number): string | undefined {
  return anno >= LIMITI_OPERE.da && anno <= LIMITI_OPERE.a ? `/opere/?fino=${anno}` : undefined;
}
