// Itineraries (spec 4, 6.2): the numbered stops, the groups ("I portali" has Marche and Abruzzo)
// and the Google Maps link with the origin and the stops in order. Pure functions.

export interface Tappa {
  /** Where to send Google Maps: address, name and town. */
  query: string;
  gruppo?: string | undefined;
}

export interface TappaNumerata<T extends Tappa> {
  numero: number;
  tappa: T;
}

export interface GruppoTappe<T extends Tappa> {
  /** Name of the group, or undefined when the itinerary has no groups. */
  gruppo: string | undefined;
  tappe: TappaNumerata<T>[];
}

/** Groups of consecutive stops with the same `gruppo`. The numbers run on across groups. */
export function raggruppaTappe<T extends Tappa>(tappe: readonly T[]): GruppoTappe<T>[] {
  const gruppi: GruppoTappe<T>[] = [];
  tappe.forEach((tappa, i) => {
    const ultimo = gruppi[gruppi.length - 1];
    const voce = { numero: i + 1, tappa };
    if (ultimo && ultimo.gruppo === tappa.gruppo) ultimo.tappe.push(voce);
    else gruppi.push({ gruppo: tappa.gruppo, tappe: [voce] });
  });
  return gruppi;
}

const MODI_MAPS = { 'a-piedi': 'walking', auto: 'driving', misto: undefined } as const;
/** Google Maps takes the destination plus at most 9 waypoints. */
export const MAX_TAPPE_INTERMEDIE = 9;

/**
 * The Google Maps directions link: it starts at `origine`, goes through the stops in order and ends
 * at the last one. With more than 9 intermediate stops the surplus is dropped (never reordered).
 */
export function linkGoogleMaps(
  origine: string,
  tappe: readonly string[],
  modo?: keyof typeof MODI_MAPS,
): string {
  if (tappe.length === 0) throw new Error('an itinerary link needs at least one stop');
  const parametri = new URLSearchParams({ api: '1', origin: origine });
  parametri.set('destination', tappe[tappe.length - 1]!);
  const intermedie = tappe.slice(0, -1).slice(0, MAX_TAPPE_INTERMEDIE);
  if (intermedie.length > 0) parametri.set('waypoints', intermedie.join('|'));
  const viaggio = modo ? MODI_MAPS[modo] : undefined;
  if (viaggio) parametri.set('travelmode', viaggio);
  return `https://www.google.com/maps/dir/?${parametri.toString().replace(/\+/g, '%20')}`;
}
