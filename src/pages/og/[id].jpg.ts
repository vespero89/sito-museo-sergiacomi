// Open Graph images (spec 6.1): /og/<photo-id>.jpg for every photo, and /og/predefinita.jpg for
// the pages that have no photo. Written at build time from the master photos by `creaOg`.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { FOTO_OG_PREDEFINITA, ID_OG_PREDEFINITA, creaOg } from '../../lib/og.ts';

/** The photo each image is made from, by id. */
async function fotoPerId(): Promise<Map<string, string>> {
  const voci = await getCollection('immagini');
  const mappa = new Map(
    voci.filter((v) => !v.data.decorativa).map((v) => [v.id, v.data.file] as const),
  );
  mappa.set(ID_OG_PREDEFINITA, FOTO_OG_PREDEFINITA);
  return mappa;
}

export const getStaticPaths: GetStaticPaths = async () =>
  [...(await fotoPerId()).keys()].map((id) => ({ params: { id } }));

export const GET: APIRoute = async ({ params }) => {
  const file = (await fotoPerId()).get(params['id']!);
  if (!file) return new Response('Not found', { status: 404 });
  // The build runs from the project root; the endpoint is bundled, so import.meta.url is not the source folder.
  const buffer = await creaOg(await readFile(join(process.cwd(), 'src', 'assets', 'foto', file)));
  return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'image/jpeg' } });
};
