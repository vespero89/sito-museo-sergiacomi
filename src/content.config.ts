// Content collections (spec 3.2). The schemas are in src/lib/schemi.ts so that `content:check` and the
// unit tests can load them without Astro. Content lives in src/content/<collection>/it/ (spec 3.1).
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { FILE_ELENCO, FORMATO, creaSchemi, type Collezione } from './lib/schemi.ts';

const schemi = creaSchemi({ rif: (collezione: Collezione) => reference(collezione) });

const cartella = (collezione: Collezione) => `./src/content/${collezione}/it`;

function loader(collezione: Collezione) {
  const formato = FORMATO[collezione];
  // One list file for all the photos: each item has its own `id` (the file loader needs it).
  if (formato === 'elenco') return file(`${cartella(collezione)}/${FILE_ELENCO}`);
  return glob({ pattern: formato === 'md' ? '*.md' : '*.yaml', base: cartella(collezione) });
}

export const collections = {
  opere: defineCollection({ loader: loader('opere'), schema: schemi.opere }),
  luoghi: defineCollection({ loader: loader('luoghi'), schema: schemi.luoghi }),
  itinerari: defineCollection({ loader: loader('itinerari'), schema: schemi.itinerari }),
  sale: defineCollection({ loader: loader('sale'), schema: schemi.sale }),
  archivio: defineCollection({ loader: loader('archivio'), schema: schemi.archivio }),
  eventi: defineCollection({ loader: loader('eventi'), schema: schemi.eventi }),
  didattica: defineCollection({ loader: loader('didattica'), schema: schemi.didattica }),
  biografia: defineCollection({ loader: loader('biografia'), schema: schemi.biografia }),
  strumenti: defineCollection({ loader: loader('strumenti'), schema: schemi.strumenti }),
  pubblicazioni: defineCollection({
    loader: loader('pubblicazioni'),
    schema: schemi.pubblicazioni,
  }),
  percorsi: defineCollection({ loader: loader('percorsi'), schema: schemi.percorsi }),
  pagine: defineCollection({ loader: loader('pagine'), schema: schemi.pagine }),
  immagini: defineCollection({ loader: loader('immagini'), schema: schemi.immagini }),
};
