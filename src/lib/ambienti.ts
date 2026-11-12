// The four environments of the museum (spec 11, change of 12/11): the rooms 1 to 3, the workshop
// (room 4), the cloister and the Foundation's spaces for the workshops. Each has a `pagine` entry
// with the title, the text and the last part of the address. The address of the fourth is
// provisional: it lives only in the `slug` of its entry, nothing else spells it out.

export const AMBIENTI = ['le-sale', 'il-laboratorio', 'il-chiostro', 'spazi-fondazione'] as const;
export type Ambiente = (typeof AMBIENTI)[number];

/** Rooms shown as sections of the page of the rooms. Room 4 is the workshop. */
export const AMBIENTE_DELLE_SALE = ['sala-1', 'sala-2', 'sala-3'] as const;

/** The id of the `pagine` entry of an environment. */
export const idVoceAmbiente = (ambiente: Ambiente): string => `ambiente-${ambiente}`;

/** Last part of the address of the environments that are settled; the fourth has none here. */
export function slugFisso(ambiente: Ambiente): string | undefined {
  return ambiente === 'spazi-fondazione' ? undefined : ambiente;
}

export const indirizzoAmbiente = (slug: string): string => `/il-museo/${slug}/`;

/** Where a room is described: a section for rooms 1 to 3, the workshop page for room 4. */
export function indirizzoSala(idSala: string): string {
  if ((AMBIENTE_DELLE_SALE as readonly string[]).includes(idSala)) {
    return `${indirizzoAmbiente('le-sale')}#${idSala}`;
  }
  if (idSala === 'sala-4') return indirizzoAmbiente('il-laboratorio');
  throw new Error(`"${idSala}" is not a room of the museum (sala-1 to sala-4)`);
}
