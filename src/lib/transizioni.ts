// Page transitions (spec 5.9): the name that links the photo of a work in the list to the photo
// on its page. The CSP forbids `style=""`, so the names are written into a stylesheet at build time.

/** Name of the shared element of a work. Only lowercase letters, digits and hyphens: it goes into CSS. */
export function nomeTransizioneOpera(slug: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Transition: "${slug}" is not a valid work slug`);
  }
  return `opera-${slug}`;
}

/**
 * The stylesheet `/assets/vt-opere.css`: one rule per work, all inside the no-preference media
 * query, so with a reduced-motion preference no name exists and nothing animates. Two elements
 * with the same name on one page cancel the transition, so a duplicated slug is an error.
 */
export function cssTransizioniOpere(slugs: readonly string[]): string {
  if (new Set(slugs).size !== slugs.length) {
    throw new Error('Transition: duplicate work slug');
  }
  const regole = slugs.map(
    (slug) => `  [data-opera="${slug}"] { view-transition-name: ${nomeTransizioneOpera(slug)}; }`,
  );
  return `@media (prefers-reduced-motion: no-preference) {\n${regole.join('\n')}\n}\n`;
}
