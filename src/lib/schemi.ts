// Schemas of the content collections (spec 3.2). Plain zod, no Astro runtime, so the same code
// runs in the Astro content config, in `npm run content:check` and in the unit tests.
//
// Field names are Italian because the content is Italian data (spec 2.1); code is English.
// Every object is strict: a misspelled field fails instead of being dropped silently.
import { z } from 'astro/zod';

export const COLLEZIONI = [
  'opere',
  'luoghi',
  'itinerari',
  'sale',
  'archivio',
  'eventi',
  'didattica',
  'biografia',
  'strumenti',
  'pubblicazioni',
  'percorsi',
  'pagine',
  'immagini',
] as const;
export type Collezione = (typeof COLLEZIONI)[number];

/**
 * How each collection is stored under src/content/<collection>/it/: Markdown files (frontmatter
 * plus text), one YAML file per entry, or one YAML list for all the entries (the photos).
 */
export const FORMATO: Record<Collezione, 'md' | 'yaml' | 'elenco'> = {
  opere: 'md',
  luoghi: 'yaml',
  itinerari: 'md',
  sale: 'md',
  archivio: 'md',
  eventi: 'md',
  didattica: 'md',
  biografia: 'md',
  strumenti: 'md',
  pubblicazioni: 'yaml',
  percorsi: 'yaml',
  pagine: 'md',
  immagini: 'elenco',
};
/** Name of the list file of a collection stored as `elenco`. */
export const FILE_ELENCO = 'immagini.yaml';
/** Collections whose entries must have a text body (the `corpo` field of the spec marked (*)). */
export const CORPO_OBBLIGATORIO: readonly Collezione[] = ['sale'];

export const STATI = ['confermato', 'da-confermare', 'segnaposto'] as const;
export const CATEGORIE_OPERA = [
  'altare',
  'portale',
  'monumento',
  'via-crucis',
  'rilievo',
  'scultura',
  'tabernacolo',
  'reliquiario',
  'stemma',
  'tomba',
  'altro',
] as const;
export const MATERIALI = [
  'marmo',
  'bronzo',
  'travertino',
  'terracotta',
  'stucco',
  'pietra',
  'gesso',
] as const;
export const RUOLI_IMMAGINE = [
  'bozzetto',
  'fonderia',
  'in-loco',
  'monumento',
  'particolare',
  'ritratto',
  'ispirazione',
  'archivio',
] as const;
/** Phases of "Dall'idea all'opera", in the order they must appear (spec 5.1). */
export const RUOLI_FASE = ['idea', 'bozzetto', 'fonderia', 'in-loco', 'monumento'] as const;
export const PRECISIONI = ['punto', 'approssimata', 'centro-comune'] as const;
export const MODI_ITINERARIO = ['a-piedi', 'auto', 'misto'] as const;
export const TIPI_ARCHIVIO = ['foto', 'lettera', 'articolo', 'documento'] as const;
export const ORIGINI = ['fondazione', 'terzi'] as const;

/** Where a `{ tipo, id }` pointer leads. Used by itinerary stops, image subjects and `continua`. */
export const TIPO_TAPPA = { opera: 'opere', luogo: 'luoghi' } as const;
export const TIPO_SOGGETTO = { opera: 'opere', sala: 'sale' } as const;
export const TIPO_CONTINUA = {
  opera: 'opere',
  sala: 'sale',
  itinerario: 'itinerari',
  archivio: 'archivio',
  evento: 'eventi',
  didattica: 'didattica',
  pagina: 'pagine',
} as const;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** An internal address: starts and ends with a slash, optional #anchor. */
export const INDIRIZZO_INTERNO = /^\/([a-z0-9-]+\/)*(#[a-z0-9-]+)?$/;

/** Does a `AAAA`, `AAAA-MM` or `AAAA-MM-GG` text name a real date? */
export function dataValida(testo: string): boolean {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(testo);
  if (!m) return false;
  const [, anno, mese, giorno] = m;
  if (mese === undefined) return true;
  if (Number(mese) < 1 || Number(mese) > 12) return false;
  if (giorno === undefined) return true;
  const d = new Date(Date.UTC(Number(anno), Number(mese) - 1, Number(giorno)));
  return d.getUTCMonth() === Number(mese) - 1 && d.getUTCDate() === Number(giorno);
}

const testo = z.string().trim().min(1);
const slug = z.string().regex(SLUG, 'must be lowercase ASCII with hyphens');
const urlHttps = z.url({ protocol: /^https$/ });
const dataLibera = z
  .string()
  .refine(dataValida, 'must be a real date as AAAA, AAAA-MM or AAAA-MM-GG, written as text');
const dataGiorno = z
  .string()
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && dataValida(v),
    'must be a real day as AAAA-MM-GG, written as text',
  );
const anno = z.number().int().min(1900).max(2100);

const dubbio = z.strictObject({ campo: testo, nota: testo });
export type Dubbio = z.infer<typeof dubbio>;

export const stato = z.enum(STATI);
export const daConfermare = z.array(dubbio).default([]);

/** True when `daConfermare` has an item for the field (or a sub-field of it). */
export function haDubbio(voce: { daConfermare: Dubbio[] }, campo: string): boolean {
  return voce.daConfermare.some((d) => d.campo === campo || d.campo.startsWith(`${campo}.`));
}

export type Osservatore = (collezione: Collezione, id: string) => void;

interface Opzioni<R extends z.ZodType> {
  /** Builds a reference to a collection. In Astro: `reference`. Default: a plain string. */
  rif?: (collezione: Collezione) => R;
  /**
   * Called with every pointer found while parsing. `content:check` uses it to verify that each
   * pointer leads to an entry (Astro itself only logs a broken reference, spec 3.1).
   */
  osserva?: Osservatore;
}

/** Builds the schema of every collection. */
export function creaSchemi<R extends z.ZodType = z.ZodString>(opzioni: Opzioni<R> = {}) {
  const { rif, osserva } = opzioni;

  // A reference to one entry of `collezione`.
  const rimando = (collezione: Collezione): R => {
    if (osserva) {
      return z.string().refine((id) => (osserva(collezione, id), true)) as unknown as R;
    }
    return rif ? rif(collezione) : (z.string() as unknown as R);
  };

  // A `{ tipo, id }` pointer to one of several collections. Not a union of references: a union
  // would always take the first branch (spec 3.1).
  const puntatore = <T extends Record<string, Collezione>>(tipi: T) =>
    z
      .strictObject({ tipo: z.enum(Object.keys(tipi) as [keyof T & string]), id: testo })
      .refine((v) => (osserva?.(tipi[v.tipo]!, v.id), true));

  const base = { stato, daConfermare };
  const descrizione = testo.optional();
  const continua = z.array(puntatore(TIPO_CONTINUA)).default([]);

  const opere = z
    .strictObject({
      ...base,
      titolo: testo,
      categoria: z.enum(CATEGORIE_OPERA),
      anno: anno.optional(),
      tecnica: testo.optional(),
      nellElenco: z.boolean(),
      materiali: z.array(z.enum(MATERIALI)).default([]),
      luogo: rimando('luoghi'),
      edificio: testo.optional(),
      committente: testo.optional(),
      immagini: z
        .array(z.strictObject({ immagine: rimando('immagini'), ruolo: z.enum(RUOLI_IMMAGINE) }))
        .default([]),
      sala: rimando('sale').optional(),
      fasi: z
        .array(
          z.strictObject({
            ruolo: z.enum(RUOLI_FASE),
            titolo: testo,
            testo,
            immagini: z.array(rimando('immagini')).min(1),
          }),
        )
        .min(3)
        .optional(),
      confronti: z
        .array(
          z.strictObject({
            prima: rimando('immagini'),
            dopo: rimando('immagini'),
            descrizione: testo,
            // Two photos that do not line up are better compared with two buttons than with a slider (spec 5.2).
            modo: z.enum(['cursore', 'pulsanti']).default('cursore'),
          }),
        )
        .optional(),
      fonti: z.array(testo).default([]),
      frase: testo.optional(),
    })
    .superRefine((v, ctx) => {
      if (v.anno === undefined && !haDubbio(v, 'anno')) {
        ctx.addIssue({
          code: 'custom',
          path: ['anno'],
          message: 'anno is missing: add it, or list "anno" in daConfermare',
        });
      }
      if (v.materiali.length === 0 && !haDubbio(v, 'materiali')) {
        ctx.addIssue({
          code: 'custom',
          path: ['materiali'],
          message: 'materiali is empty: add a material, or list "materiali" in daConfermare',
        });
      }
      const ordini = (v.fasi ?? []).map((fase) => RUOLI_FASE.indexOf(fase.ruolo));
      if (ordini.some((o, i) => i > 0 && o < ordini[i - 1]!)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fasi'],
          message: `fasi must follow the ordine ${RUOLI_FASE.join(', ')}`,
        });
      }
    });

  const luoghi = z.strictObject({
    ...base,
    nome: testo,
    comune: testo,
    provincia: z.string().regex(/^[A-Z]{2}$/, 'must be a two-letter code, e.g. AP'),
    regione: testo,
    indirizzo: testo.optional(),
    // Bounds of Italy: they catch swapped latitude and longitude.
    lat: z.number().min(35).max(48),
    lon: z.number().min(6).max(19),
    precisione: z.enum(PRECISIONI),
    verificato: z.boolean(),
  });

  const itinerari = z
    .strictObject({
      ...base,
      titolo: testo,
      descrizione,
      modo: z.enum(MODI_ITINERARIO).optional(),
      durataMinuti: z.number().int().positive().optional(),
      tappe: z
        .array(
          z.strictObject({
            tipo: z.enum(Object.keys(TIPO_TAPPA) as [keyof typeof TIPO_TAPPA]),
            id: testo,
            nota: testo.optional(),
            gruppo: testo.optional(),
          }),
        )
        .min(1)
        .refine((tappe) => (tappe.forEach((t) => osserva?.(TIPO_TAPPA[t.tipo], t.id)), true)),
      immagine: rimando('immagini').optional(),
    })
    .superRefine((v, ctx) => {
      if (v.modo === undefined && !haDubbio(v, 'modo')) {
        ctx.addIssue({
          code: 'custom',
          path: ['modo'],
          message: 'modo is missing: add it, or list "modo" in daConfermare',
        });
      }
    });

  const sale = z.strictObject({
    ...base,
    numero: z.number().int().min(1).max(4),
    nome: testo,
    descrizione,
    immagini: z.array(rimando('immagini')).default([]),
    esposti: testo.optional(),
  });

  const archivio = z
    .strictObject({
      ...base,
      titolo: testo,
      tipo: z.enum(TIPI_ARCHIVIO),
      data: dataLibera,
      dataTesto: testo.optional(),
      descrizione: testo,
      file: rimando('immagini').optional(),
      fonte: testo.optional(),
      origine: z.enum(ORIGINI),
      credito: testo.optional(),
      opere: z.array(rimando('opere')).default([]),
      sale: z.array(rimando('sale')).default([]),
    })
    .superRefine((v, ctx) => {
      if (v.origine === 'terzi' && !v.credito) {
        ctx.addIssue({
          code: 'custom',
          path: ['credito'],
          message: 'credito is required when origine is "terzi"',
        });
      }
    });

  const eventi = z
    .strictObject({
      ...base,
      titolo: testo,
      tipo: z.enum(['evento', 'iniziativa']),
      descrizione,
      data: dataGiorno.optional(),
      dataFine: dataGiorno.optional(),
      dataTesto: testo.optional(),
      ora: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM')
        .optional(),
      luogo: testo.optional(),
      luogoRif: rimando('luoghi').optional(),
      immagine: rimando('immagini').optional(),
      link: urlHttps.optional(),
      continua,
    })
    .superRefine((v, ctx) => {
      if (v.tipo === 'evento' && !v.data) {
        ctx.addIssue({ code: 'custom', path: ['data'], message: 'an evento needs a data' });
      }
      if (v.dataFine && !v.data) {
        ctx.addIssue({ code: 'custom', path: ['dataFine'], message: 'dataFine needs a data' });
      }
      if (v.data && v.dataFine && v.dataFine < v.data) {
        ctx.addIssue({ code: 'custom', path: ['dataFine'], message: 'dataFine is before data' });
      }
      if (v.ora && !v.data) {
        ctx.addIssue({ code: 'custom', path: ['ora'], message: 'ora needs a data' });
      }
    });

  const didattica = z.strictObject({
    ...base,
    titolo: testo,
    tipo: z.enum(['progetto-svolto', 'proposta']),
    descrizione,
    destinatari: testo.optional(),
    anno: anno.optional(),
    immagine: rimando('immagini').optional(),
    continua,
  });

  const biografia = z
    .strictObject({
      ...base,
      anno,
      data: dataLibera.optional(),
      dataTesto: testo.optional(),
      tipo: z.enum(['vita', 'premio', 'mostra', 'museo']),
      titolo: testo,
    })
    .superRefine((v, ctx) => {
      if (v.data && Number(v.data.slice(0, 4)) !== v.anno) {
        ctx.addIssue({
          code: 'custom',
          path: ['data'],
          message: 'the year of data differs from anno',
        });
      }
    });

  const strumenti = z.strictObject({
    ...base,
    nome: testo,
    uso: testo.optional(),
    immagine: rimando('immagini'),
  });

  const pubblicazioni = z.strictObject({
    ...base,
    titolo: testo,
    autore: testo.optional(),
    anno: anno.optional(),
    editore: testo.optional(),
    copertina: rimando('immagini').optional(),
    descrizione,
    comeAcquistare: testo.optional(),
  });

  const percorsi = z.strictObject({
    ...base,
    titolo: testo,
    descrizione,
    intro: testo,
    voci: z
      .array(
        z.strictObject({
          titolo: testo,
          descrizione: testo,
          percorso: z
            .string()
            .regex(INDIRIZZO_INTERNO, 'must be an internal address like /visita/'),
        }),
      )
      .min(1),
  });

  const pagine = z.strictObject({
    ...base,
    titolo: testo,
    descrizione: testo,
    slug,
    continua,
  });

  const immagini = z
    .strictObject({
      ...base,
      id: slug,
      file: z.string().regex(/^[a-z0-9-]+\.jpg$/, 'must be a lowercase ASCII .jpg file name'),
      alt: z.string().trim().max(150),
      decorativa: z.boolean().optional(),
      didascalia: testo.optional(),
      origine: z.enum(ORIGINI),
      credito: testo.optional(),
      soggetto: puntatore(TIPO_SOGGETTO).optional(),
      fileOriginale: testo.optional(),
      altVerificato: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.alt === '') {
        if (!v.decorativa) {
          ctx.addIssue({
            code: 'custom',
            path: ['alt'],
            message: 'alt is empty: describe the image, or mark it decorativa: true',
          });
        }
      } else if (v.alt.length < 15) {
        ctx.addIssue({
          code: 'custom',
          path: ['alt'],
          message: 'alt is too short (15 characters at least): say what the image shows',
        });
      }
      if (v.origine === 'terzi' && !v.credito) {
        ctx.addIssue({
          code: 'custom',
          path: ['credito'],
          message: 'credito is required when origine is "terzi"',
        });
      }
    });

  return {
    opere,
    luoghi,
    itinerari,
    sale,
    archivio,
    eventi,
    didattica,
    biografia,
    strumenti,
    pubblicazioni,
    percorsi,
    pagine,
    immagini,
  };
}
