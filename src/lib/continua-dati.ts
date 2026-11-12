// "Continua il percorso" as the pages read it (the astro:content side of continua.ts): the
// catalogue of the site, and the cards of one page.
import { getCollection, type CollectionEntry } from 'astro:content';
import { t } from '../i18n/index.ts';
import { AMBIENTI, indirizzoAmbiente, indirizzoSala, idVoceAmbiente } from './ambienti.ts';
import { continua, type Catalogo, type Pagina, type Scheda } from './continua.ts';
import { indirizzoOpera, leggiOpere } from './opere-dati.ts';
import { indirizzoItinerario, leggiItinerari } from './itinerari-dati.ts';

/** Rooms described by each environment page; the cloister and the spaces describe none. */
const SALE_DELL_AMBIENTE: Record<string, string[]> = {
  'le-sale': ['sala-1', 'sala-2', 'sala-3'],
  'il-laboratorio': ['sala-4'],
};

type Continua = CollectionEntry<'pagine'>['data']['continua'];

/** Address of a `pagine` entry: the environments live under /il-museo/, the rest at the root. */
function indirizzoPagina(voce: CollectionEntry<'pagine'>): string {
  const ambiente = AMBIENTI.find((a) => voce.filePath?.endsWith(`/${idVoceAmbiente(a)}.md`));
  return ambiente ? indirizzoAmbiente(voce.data.slug) : `/${voce.data.slug}/`;
}

let memo: Promise<{ catalogo: Catalogo; schede: Map<string, Scheda> }> | undefined;

function leggi() {
  memo ??= (async () => {
    const [opere, sale, archivio, itinerari, pagine, eventi, didattica, percorsi] =
      await Promise.all([
        leggiOpere(),
        getCollection('sale'),
        getCollection('archivio'),
        leggiItinerari(),
        getCollection('pagine'),
        getCollection('eventi'),
        getCollection('didattica'),
        getCollection('percorsi'),
      ]);
    const per = <T extends { id: string }>(v: T[]) =>
      [...v].sort((a, b) => a.id.localeCompare(b.id));
    const saleOrdinate = [...sale].sort((a, b) => a.data.numero - b.data.numero);

    const catalogo: Catalogo = {
      opere: opere.map((o) => ({
        tipo: 'opera',
        id: o.slug,
        titolo: o.voce.data.titolo,
        href: indirizzoOpera(o.slug),
        comune: o.luogo.comune,
        lat: o.luogo.lat,
        lon: o.luogo.lon,
        anno: o.voce.data.anno,
        sala: o.voce.data.sala?.id,
      })),
      sale: saleOrdinate.map((s) => ({
        tipo: 'sala',
        id: s.id,
        titolo: s.data.nome,
        href: indirizzoSala(s.id),
      })),
      itinerari: itinerari.map((i) => ({
        tipo: 'itinerario',
        id: i.slug,
        titolo: i.voce.data.titolo,
        href: indirizzoItinerario(i.slug),
        opere: i.voce.data.tappe.filter((p) => p.tipo === 'opera').map((p) => p.id),
      })),
      archivio: per(archivio).map((a) => ({
        tipo: 'archivio',
        id: a.id,
        titolo: a.data.titolo,
        href: `/archivio/${a.id}/`,
        anno: Number(a.data.data.slice(0, 4)) || undefined,
        opere: a.data.opere.map((o) => o.id),
        sale: a.data.sale.map((s) => s.id),
      })),
      predefinite: [
        { tipo: 'pagina', titolo: t('opere.titolo'), href: '/opere/' },
        { tipo: 'pagina', titolo: '', href: '/visita/' },
        { tipo: 'pagina', titolo: t('archivio.titolo'), href: '/archivio/' },
      ],
      museo: { tipo: 'pagina', titolo: '', href: '/il-museo/' },
      visita: { tipo: 'pagina', titolo: '', href: '/visita/' },
    };

    // Every page a pointer can lead to, by "tipo:id".
    const schede = new Map<string, Scheda>();
    for (const o of catalogo.opere) schede.set(`opera:${o.id}`, o);
    for (const s of catalogo.sale) schede.set(`sala:${s.id}`, s);
    for (const i of catalogo.itinerari) schede.set(`itinerario:${i.id}`, i);
    for (const a of catalogo.archivio) schede.set(`archivio:${a.id}`, a);
    for (const e of eventi) {
      schede.set(`evento:${e.id}`, {
        tipo: 'evento',
        titolo: e.data.titolo,
        href: `/eventi/${e.id}/`,
      });
    }
    for (const d of didattica) {
      schede.set(`didattica:${d.id}`, {
        tipo: 'didattica',
        titolo: d.data.titolo,
        href: '/didattica/',
      });
    }
    for (const p of percorsi) {
      schede.set(`percorso:${p.id}`, {
        tipo: 'percorso',
        titolo: p.data.titolo,
        href: `/percorsi/${p.id}/`,
      });
    }
    for (const p of pagine) {
      schede.set(`pagina:${p.id}`, {
        tipo: 'pagina',
        titolo: p.data.titolo,
        href: indirizzoPagina(p),
      });
    }
    // The titles of the fixed pages come from their entries.
    for (const s of [catalogo.museo, catalogo.visita, catalogo.predefinite[1]!]) {
      s.titolo = schede.get(`pagina:${s.href.replaceAll('/', '')}`)?.titolo ?? s.titolo;
    }
    return { catalogo, schede };
  })();
  return memo;
}

/** The pointers of an entry, resolved to cards. A pointer to nothing is an error. */
function risolvi(rimandi: Continua, schede: Map<string, Scheda>): Scheda[] {
  return rimandi.map(({ tipo, id }) => {
    const s = schede.get(`${tipo}:${id}`);
    if (!s) throw new Error(`continua: the pointer ${tipo}:${id} leads nowhere`);
    return s;
  });
}

/** What a page says about itself: what it is, and the pointers written in its entry. */
export type PaginaContinua =
  | Exclude<Pagina, { tipo: 'manuale' }>
  | { tipo: 'manuale'; continua?: Continua }
  | { tipo: 'voce'; voce: CollectionEntry<'pagine'> };

/** The cards of "Continua il percorso" for the page at `href`. */
export async function leggiContinua(pagina: PaginaContinua, href: string): Promise<Scheda[]> {
  const { catalogo, schede } = await leggi();
  if (pagina.tipo === 'voce') {
    const { voce } = pagina;
    const ambiente = AMBIENTI.find((a) => voce.filePath?.endsWith(`/${idVoceAmbiente(a)}.md`));
    const sale = ambiente ? SALE_DELL_AMBIENTE[ambiente] : undefined;
    return continua(
      sale
        ? { tipo: 'sale', ids: sale }
        : { tipo: 'manuale', rimandi: risolvi(voce.data.continua, schede) },
      href,
      catalogo,
    );
  }
  if (pagina.tipo === 'manuale') {
    return continua(
      { tipo: 'manuale', rimandi: risolvi(pagina.continua ?? [], schede) },
      href,
      catalogo,
    );
  }
  return continua(pagina, href, catalogo);
}
