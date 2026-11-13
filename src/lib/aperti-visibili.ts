// What a page shows of the open items (spec 3.5): everything in the preview, nothing in production.
// A production build only runs when no blocking item is open (bloccanti.ts), so what is left is
// non-blocking: the label, the box and the marker are internal notes and must not reach the public.
// One place decides, so a component never reads the environment itself.
import { decidiModalita } from './modalita.ts';
import { campoSito, type Sito } from './sito.ts';

/** Are labels, boxes and markers shown? Only in a preview (`decidiModalita`). */
export function mostraAperti(env: NodeJS.ProcessEnv = process.env): boolean {
  return decidiModalita(env).mostraAperti;
}

/** A closed `[[...]]` marker with the space before it, so the sentence around it stays tidy. */
const MARCATORE = /\s*\[\[[\s\S]*?\]\]/g;

/** The text without its `[[...]]` markers; the text around them stays. */
export function togliMarcatori(testo: string): string {
  return testo.includes('[[') ? testo.replace(MARCATORE, '') : testo;
}

/** As `togliMarcatori`, for a whole field: no space is left at the ends. */
export function togliMarcatoriDaCampo(testo: string): string {
  return testo.includes('[[') ? togliMarcatori(testo).trim() : testo;
}

/** The value with the markers removed from every string inside it, at any depth. */
export function togliMarcatoriDa<T>(valore: T): T {
  if (typeof valore === 'string') return togliMarcatoriDaCampo(valore) as T;
  if (Array.isArray(valore)) return valore.map((v) => togliMarcatoriDa(v)) as T;
  if (
    typeof valore === 'object' &&
    valore !== null &&
    Object.getPrototypeOf(valore) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(valore).map(([chiave, v]) => [chiave, togliMarcatoriDa(v)]),
    ) as T;
  }
  return valore;
}

/**
 * Is the field of sito.yaml shown? In the preview always (a doubtful one as a label). In
 * production only a confirmed field with a value: a doubtful or empty value is left out, and the
 * row or block that holds it with it. A list (`social`) needs at least one item.
 */
export function sitoDaMostrare(sito: Sito, percorso: string, mostra = mostraAperti()): boolean {
  if (mostra) return true;
  const campo = campoSito(sito, percorso);
  if (!campo.visibile) return false;
  if (Array.isArray(campo.valore)) return campo.valore.length > 0;
  return typeof campo.valore === 'string' && campo.valore.trim() !== '';
}
