// Markdown plugin (Sätteri, Astro's Markdown processor): removes the `[[DA CONFERMARE: ...]]`
// markers from the body text of a Markdown entry (spec 3.5). The Astro config adds it only when
// `mostraAperti` is false (production), so the preview keeps the markers. The text around a marker
// stays; a paragraph that only held a marker goes away. A marker split over several inline nodes
// (for example one with emphasis inside) is not found here: the production safety net test on
// `dist/` looks for `[[` and would fail.
import type { MdastPluginDefinition } from 'satteri';
import { togliMarcatori } from './aperti-visibili.ts';

export const mdastTogliMarcatori: MdastPluginDefinition = {
  name: 'togli-marcatori',
  paragraph(nodo, ctx) {
    const soloTesto = nodo.children.every((figlio) => figlio.type === 'text');
    if (
      soloTesto &&
      ctx.textContent(nodo).includes('[[') &&
      !togliMarcatori(ctx.textContent(nodo)).trim()
    ) {
      ctx.removeNode(nodo);
    }
  },
  text(nodo, ctx) {
    if (!nodo.value.includes('[[')) return;
    const padre = ctx.parent(nodo);
    // The paragraph is removed as a whole (see above): do not touch its text as well.
    if (
      padre.type === 'paragraph' &&
      padre.children.every((figlio) => figlio.type === 'text') &&
      !togliMarcatori(ctx.textContent(padre)).trim()
    ) {
      return;
    }
    ctx.setProperty(nodo, 'value', togliMarcatori(nodo.value));
  },
};
