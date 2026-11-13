// Content collections (spec 3.2). The schemas are in src/lib/schemi.ts so that `content:check` and the
// unit tests can load them without Astro. Content lives in src/content/<collection>/it/ (spec 3.1).
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import type { z } from 'astro/zod';
import { mostraAperti, togliMarcatoriDa } from './lib/aperti-visibili.ts';
import { FILE_ELENCO, FORMATO, creaSchemi, type Collezione } from './lib/schemi.ts';

const schemi = creaSchemi({ rif: (collezione: Collezione) => reference(collezione) });

// In production the `[[...]]` markers are removed from every string of the frontmatter (spec 3.5);
// the body is cleaned by the remark plugin in astro.config.mjs. The preview keeps them. The type
// stays the schema's own: the shape does not change, only the text of some strings.
const pulito = <S extends z.ZodType>(schema: S): S =>
  mostraAperti() ? schema : (schema.transform(togliMarcatoriDa) as unknown as S);

const cartella = (collezione: Collezione) => `./src/content/${collezione}/it`;

function loader(collezione: Collezione) {
  const formato = FORMATO[collezione];
  // One list file for all the photos: each item has its own `id` (the file loader needs it).
  if (formato === 'elenco') return file(`${cartella(collezione)}/${FILE_ELENCO}`);
  return glob({ pattern: formato === 'md' ? '*.md' : '*.yaml', base: cartella(collezione) });
}

export const collections = {
  opere: defineCollection({ loader: loader('opere'), schema: pulito(schemi.opere) }),
  luoghi: defineCollection({ loader: loader('luoghi'), schema: pulito(schemi.luoghi) }),
  itinerari: defineCollection({ loader: loader('itinerari'), schema: pulito(schemi.itinerari) }),
  sale: defineCollection({ loader: loader('sale'), schema: pulito(schemi.sale) }),
  archivio: defineCollection({ loader: loader('archivio'), schema: pulito(schemi.archivio) }),
  eventi: defineCollection({ loader: loader('eventi'), schema: pulito(schemi.eventi) }),
  didattica: defineCollection({ loader: loader('didattica'), schema: pulito(schemi.didattica) }),
  biografia: defineCollection({ loader: loader('biografia'), schema: pulito(schemi.biografia) }),
  strumenti: defineCollection({ loader: loader('strumenti'), schema: pulito(schemi.strumenti) }),
  pubblicazioni: defineCollection({
    loader: loader('pubblicazioni'),
    schema: pulito(schemi.pubblicazioni),
  }),
  percorsi: defineCollection({ loader: loader('percorsi'), schema: pulito(schemi.percorsi) }),
  pagine: defineCollection({ loader: loader('pagine'), schema: pulito(schemi.pagine) }),
  immagini: defineCollection({ loader: loader('immagini'), schema: pulito(schemi.immagini) }),
};
