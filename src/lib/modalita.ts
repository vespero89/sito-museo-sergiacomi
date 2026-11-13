// Which kind of build this is (spec 3.5, 6.4). One function decides; the places that need the
// answer (config of the hosting files, SEO head, sitemap, llms.txt) read it instead of looking at
// the environment variables themselves.
//
// SITE_ENV is `preview` (the default) or `production`. ALLOW_OPEN_ITEMS=1 lets a production build
// go on with open items, but only as a preview: noindex, no sitemap, no llms.txt. There is no way
// to get an indexable build with open items.

export interface Modalita {
  /** A private preview: not for search engines. */
  anteprima: boolean;
  /** `noindex` in the meta tag and in the header. */
  noindex: boolean;
  sitemap: boolean;
  llmsTxt: boolean;
  /** The build stops when a blocking item is not confirmed (spec 3.5, bloccanti.ts). */
  bloccaAperti: boolean;
  /** Markers, labels and "da confermare" boxes are shown: only in a preview. */
  mostraAperti: boolean;
}

interface Ambiente {
  SITE_ENV?: string | undefined;
  ALLOW_OPEN_ITEMS?: string | undefined;
}

export function decidiModalita(env: Ambiente): Modalita {
  const ambiente = env.SITE_ENV || 'preview';
  if (ambiente !== 'preview' && ambiente !== 'production') {
    throw new Error(`SITE_ENV must be "preview" or "production", not "${ambiente}"`);
  }
  const consenti = env.ALLOW_OPEN_ITEMS ?? '';
  if (!['', '0', '1'].includes(consenti)) {
    throw new Error(`ALLOW_OPEN_ITEMS must be 1 (or unset), not "${consenti}"`);
  }

  const anteprima = ambiente === 'preview' || consenti === '1';
  return {
    anteprima,
    noindex: anteprima,
    sitemap: !anteprima,
    llmsTxt: !anteprima,
    bloccaAperti: !anteprima,
    mostraAperti: anteprima,
  };
}
