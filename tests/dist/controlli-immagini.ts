// Checks on the images of a built page (spec 7 and 8-A). Used by the dist tests on every page.

/** Problems found in the `<img>` elements of a page, as readable lines. Empty when all is well. */
export function problemiImmagini(document: Document): string[] {
  const problemi: string[] = [];
  const immagini = [...document.querySelectorAll('img')];
  for (const img of immagini) {
    const nome = img.getAttribute('src') ?? '(no src)';
    if (!img.hasAttribute('alt')) problemi.push(`<img> without alt: ${nome}`);
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      problemi.push(`<img> without width and height: ${nome}`);
    }
  }
  const prioritarie = immagini.filter((img) => img.getAttribute('fetchpriority') === 'high');
  if (prioritarie.length > 1) {
    problemi.push(`${prioritarie.length} images with fetchpriority="high": only one per page`);
  }
  return problemi;
}
