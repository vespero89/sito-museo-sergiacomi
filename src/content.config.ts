// Content collections (spec 3.2). The schemas are in src/lib/schemi.ts so that `content:check` and the
// unit tests can load them without Astro. Content lives in src/content/<collection>/it/ (spec 3.1).
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { creaSchemi, type Collezione } from './lib/schemi.ts';

const schemi = creaSchemi({ rif: (collezione: Collezione) => reference(collezione) });

const cartella = (collezione: Collezione) => `./src/content/${collezione}/it`;
const markdown = (collezione: Collezione) => glob({ pattern: '*.md', base: cartella(collezione) });
const yaml = (collezione: Collezione) => glob({ pattern: '*.yaml', base: cartella(collezione) });

export const collections = {
  opere: defineCollection({ loader: markdown('opere'), schema: schemi.opere }),
  luoghi: defineCollection({ loader: yaml('luoghi'), schema: schemi.luoghi }),
  itinerari: defineCollection({ loader: markdown('itinerari'), schema: schemi.itinerari }),
  sale: defineCollection({ loader: markdown('sale'), schema: schemi.sale }),
  archivio: defineCollection({ loader: markdown('archivio'), schema: schemi.archivio }),
  eventi: defineCollection({ loader: markdown('eventi'), schema: schemi.eventi }),
  didattica: defineCollection({ loader: markdown('didattica'), schema: schemi.didattica }),
  biografia: defineCollection({ loader: markdown('biografia'), schema: schemi.biografia }),
  strumenti: defineCollection({ loader: markdown('strumenti'), schema: schemi.strumenti }),
  pubblicazioni: defineCollection({ loader: yaml('pubblicazioni'), schema: schemi.pubblicazioni }),
  percorsi: defineCollection({ loader: yaml('percorsi'), schema: schemi.percorsi }),
  pagine: defineCollection({ loader: markdown('pagine'), schema: schemi.pagine }),
  // One list file for all the photos: each item has its own `id` (the file loader needs it).
  immagini: defineCollection({
    loader: file(`${cartella('immagini')}/immagini.yaml`),
    schema: schemi.immagini,
  }),
};
