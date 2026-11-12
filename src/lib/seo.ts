// Pure helpers of the SEO head (spec 6.1), used by src/components/Seo.astro.

/** Browser UI colour (meta theme-color). Keep in step with `--colore-sfondo` in tokens.css. */
export const COLORE_TEMA = '#faf7f2';

/** Origin of the canonical and Open Graph addresses until the domain is decided (never resolves). */
export const ORIGINE_PREDEFINITA = 'https://museo-sergiacomi.example';

/** "Page title | Museum name", or just the name for the home page. */
export function titoloPagina(titolo: string | undefined, nome: string): string {
  return !titolo || titolo === nome ? nome : `${titolo} | ${nome}`;
}

/** Absolute address of a path of the site, on the site origin. */
export function urlAssoluto(indirizzo: string, origine: string | URL): string {
  return new URL(indirizzo, origine).href;
}
