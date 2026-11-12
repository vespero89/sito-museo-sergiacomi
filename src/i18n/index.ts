// Interface texts and addresses by language (spec 3.1, 9.1). Only Italian is published in the
// prototype; English will live under /en/ and needs a new file next to it.json plus the locale below.
import it from './it.json';

export type Lingua = 'it';
export const LINGUA_PREDEFINITA: Lingua = 'it';
/** The languages that are published. When there is more than one, pages get hreflang links. */
export const LINGUE_PUBBLICATE: readonly string[] = ['it'];

export type ChiaveUi = keyof typeof it;

const TESTI: Record<Lingua, Record<ChiaveUi, string>> = { it };

/** An interface text, by key. */
export function t(chiave: ChiaveUi, lingua: Lingua = LINGUA_PREDEFINITA): string {
  return TESTI[lingua][chiave];
}

/** The address of a page in a language: the default language has no prefix, the others `/en/...`. */
export function percorso(indirizzo: string, lingua: string = LINGUA_PREDEFINITA): string {
  if (!indirizzo.startsWith('/')) throw new Error(`an address must start with "/": ${indirizzo}`);
  return lingua === LINGUA_PREDEFINITA ? indirizzo : `/${lingua}${indirizzo}`;
}

/**
 * The hreflang alternates of a page (with `x-default`), or nothing while only one language is
 * published. `indirizzo` is the address in the default language.
 */
export function alternative(
  indirizzo: string,
  lingue: readonly string[] = LINGUE_PUBBLICATE,
): { hreflang: string; percorso: string }[] {
  if (lingue.length < 2) return [];
  return [
    ...lingue.map((lingua) => ({ hreflang: lingua, percorso: percorso(indirizzo, lingua) })),
    { hreflang: 'x-default', percorso: percorso(indirizzo, LINGUA_PREDEFINITA) },
  ];
}
