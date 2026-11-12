// Names of the page transitions of the works (spec 5.9), as a stylesheet: the CSP forbids `style=""`.
// Linked only from /opere/ and the work pages.
import type { APIRoute } from 'astro';
import { leggiOpere } from '../../lib/opere-dati.ts';
import { cssTransizioniOpere } from '../../lib/transizioni.ts';

export const GET: APIRoute = async () => {
  const opere = await leggiOpere();
  return new Response(cssTransizioniOpere(opere.map((o) => o.slug)), {
    headers: { 'Content-Type': 'text/css; charset=utf-8' },
  });
};
