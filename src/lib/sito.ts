// Schema of src/data/sito.yaml (spec 3.2): the data of the museum and the Foundation, in one place.
import { z } from 'astro/zod';
import { INDIRIZZO_INTERNO, dataValida, daConfermare } from './schemi.ts';

const testo = z.string().trim().min(1);
const indirizzoInterno = z
  .string()
  .regex(INDIRIZZO_INTERNO, 'must be an internal address like /visita/');
const voceMenu = z.strictObject({ titolo: testo, href: indirizzoInterno });

const indirizzo = z.strictObject({
  via: testo,
  cap: z.string().regex(/^\d{5}$/, 'must be 5 digits'),
  comune: testo,
  provincia: z.string().regex(/^[A-Z]{2}$/, 'must be a two-letter code, e.g. AP'),
  regione: testo,
  paese: z.string().regex(/^[A-Z]{2}$/, 'must be a two-letter country code, e.g. IT'),
});

const giorno = z
  .string()
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && dataValida(v),
    'must be a real day as AAAA-MM-GG',
  );

const iban = z
  .string()
  .refine(
    (v) => v === '' || /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v.replace(/\s/g, '')),
    'must be empty or a valid IBAN',
  );

const struttura = z.strictObject({
  daConfermare,
  nome: testo,
  nomeEsteso: testo,
  museo: z.strictObject({ indirizzo }),
  orari: z.strictObject({ testo: z.string() }),
  contatti: z.strictObject({ email: z.email(), telefono: z.string() }),
  social: z.array(z.strictObject({ nome: testo, url: z.url({ protocol: /^https$/ }) })),
  fondazione: z.strictObject({ denominazione: testo, sede: indirizzo }),
  artista: z.strictObject({
    nome: testo,
    wikidata: z.string().regex(/^Q\d+$/, 'must be like Q123'),
    nascita: giorno,
    morte: giorno,
  }),
  azioni: z.strictObject({ prenota: voceMenu, orari: voceMenu }),
  navigazione: z.strictObject({
    principale: z.array(voceMenu).min(1),
    piede: z.array(z.strictObject({ gruppo: testo, voci: z.array(voceMenu).min(1) })).min(1),
  }),
  sostegno: z.strictObject({ iban, intestatario: z.string(), causale: z.string() }),
});

/** Is there a value (even an empty one) at the dotted path? Array items are addressed by index. */
export function campoPresente(dati: unknown, percorso: string): boolean {
  let nodo: unknown = dati;
  for (const parte of percorso.split('.')) {
    if (typeof nodo !== 'object' || nodo === null || !Object.hasOwn(nodo, parte)) return false;
    nodo = (nodo as Record<string, unknown>)[parte];
  }
  return true;
}

/**
 * The value of a field of sito.yaml, or just the label when the field is listed in `daConfermare`
 * (spec 3.5): a doubtful value is never shown, the IBAN included. A listed field also hides what
 * is inside it (`social` hides `social.0.url`).
 */
export function campoSito(
  sito: Sito,
  percorso: string,
): { visibile: true; valore: unknown } | { visibile: false; nota: string } {
  const dubbio = sito.daConfermare.find(
    (d) => d.campo === percorso || percorso.startsWith(`${d.campo}.`),
  );
  if (dubbio) return { visibile: false, nota: dubbio.nota };
  let valore: unknown = sito;
  for (const parte of percorso.split('.')) {
    valore = (valore as Record<string, unknown> | undefined)?.[parte];
  }
  return { visibile: true, valore };
}

export const sitoSchema = struttura.superRefine((v, ctx) => {
  // A listed field is hidden in the preview (spec 3.5): a path that does not exist would
  // silently leave the doubtful value on show.
  v.daConfermare.forEach((voce, i) => {
    if (!campoPresente(v, voce.campo)) {
      ctx.addIssue({
        code: 'custom',
        path: ['daConfermare', i, 'campo'],
        message: `"${voce.campo}" is not a field of sito.yaml`,
      });
    }
  });
});

export type Sito = z.infer<typeof sitoSchema>;
