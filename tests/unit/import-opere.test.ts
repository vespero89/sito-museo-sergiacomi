// The import of places and works (task 5, spec 3.3, 3.5, 3.2): the real content of the repo.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apertiDelRepo } from '../../src/lib/aperti.ts';
import { leggiContenuti, type Problema } from '../../src/lib/controllo-contenuti.ts';
import { haDubbio, type Dubbio } from '../../src/lib/schemi.ts';

const RADICE = join(import.meta.dirname, '..', '..');
const problemiLettura: Problema[] = [];
const contenuti = leggiContenuti(RADICE, problemiLettura);

interface Opera {
  id: string;
  titolo: string;
  categoria: string;
  anno?: number;
  nellElenco: boolean;
  materiali: string[];
  luogo: string;
  stato: string;
  daConfermare: Dubbio[];
  immagini: { immagine: string; ruolo: string }[];
}
interface Luogo {
  id: string;
  comune: string;
  lat: number;
  lon: number;
  precisione: string;
  verificato: boolean;
}
interface Immagine {
  id: string;
  stato: string;
  daConfermare?: Dubbio[];
  soggetto?: { tipo: string; id: string };
}

const come = <T>(voci: { id: string; dati: unknown }[]): T[] =>
  voci.map(
    (v) =>
      ({ id: v.id, daConfermare: [], immagini: [], materiali: [], ...(v.dati as object) }) as T,
  );
const opere = come<Opera>(contenuti.opere);
const luoghi = come<Luogo>(contenuti.luoghi);
const immagini = come<Immagine>(contenuti.immagini);
const luogoDi = (o: Opera) => luoghi.find((l) => l.id === o.luogo)!;
const elenco = opere.filter((o) => o.nellElenco);
const opera = (id: string) => opere.find((o) => o.id === id)!;

describe('the works', () => {
  it('reads without problems', () => {
    expect(problemiLettura).toEqual([]);
  });

  it('has 25 works of the list and the two extra cards', () => {
    expect(elenco).toHaveLength(25);
    expect(opere).toHaveLength(27);
    const extra = opere.filter((o) => !o.nellElenco).map((o) => o.id);
    expect(extra.sort()).toEqual(['stemmi-palazzo-comunale-offida', 'tomba-palmucci-offida']);
    for (const id of extra) expect(opera(id).stato).toBe('da-confermare');
  });

  it('spreads the 25 over the comuni as the exploration says', () => {
    const per: Record<string, number> = {};
    for (const o of elenco) per[luogoDi(o).comune] = (per[luogoDi(o).comune] ?? 0) + 1;
    expect(per).toEqual({
      Offida: 7,
      Teramo: 4,
      'Ascoli Piceno': 3,
      'San Benedetto del Tronto': 3,
      Fermo: 2,
      Loreto: 2,
      Grottammare: 1,
      "Montefiore dell'Aso": 1,
      "Sant'Egidio alla Vibrata": 1,
      Folignano: 1,
    });
    // With the two extra cards Offida has 9.
    expect(opere.filter((o) => luogoDi(o).comune === 'Offida')).toHaveLength(9);
  });

  it('gives every work a place that exists', () => {
    for (const o of opere) expect(luogoDi(o), o.id).toBeDefined();
  });

  it('marks the 9 works without a material in the list, and only those', () => {
    const senza = elenco.filter((o) => o.materiali.length === 0).map((o) => o.id);
    expect(senza.sort()).toEqual(
      [
        'candelabro-unitalsi-loreto',
        'il-sogno-del-pescatore',
        'la-retara',
        'le-merlettaie',
        'monumento-a-simon-bolivar',
        'monumento-ai-caduti-fermo',
        'san-giovanni-battista-ascoli',
        'tabernacolo-cuore-immacolato-teramo',
        'via-crucis-teramo',
      ].sort(),
    );
    for (const o of opere.filter((x) => x.materiali.length === 0)) {
      expect(haDubbio(o, 'materiali'), o.id).toBe(true);
      expect(o.stato, o.id).not.toBe('confermato');
    }
  });

  it('has a year for every work of the list (the docx gives them all)', () => {
    for (const o of elenco) expect(o.anno, o.id).toBeGreaterThanOrEqual(1934);
  });

  it('does not show the doubtful year of the Stemmi (1923 on the old site, he was 11)', () => {
    const stemmi = opera('stemmi-palazzo-comunale-offida');
    expect(stemmi.anno).toBeUndefined();
    expect(haDubbio(stemmi, 'anno')).toBe(true);
  });

  it('does not invent the year of the Tomba Palmucci', () => {
    const t = opera('tomba-palmucci-offida');
    expect(t.anno).toBeUndefined();
    expect(haDubbio(t, 'anno')).toBe(true);
  });

  it('has the Via crucis of Offida (1952, terracotta) and of Teramo (1974)', () => {
    expect(opera('via-crucis-offida')).toMatchObject({ anno: 1952, materiali: ['terracotta'] });
    expect(opera('via-crucis-teramo').anno).toBe(1974);
  });

  it('has no work without a title or with a repeated title', () => {
    const titoli = opere.map((o) => o.titolo);
    expect(new Set(titoli).size).toBe(titoli.length);
  });
});

describe('the places', () => {
  it('has coordinates inside the box of Marche and Abruzzo', () => {
    for (const l of luoghi) {
      expect(l.lat, l.id).toBeGreaterThan(41.6);
      expect(l.lat, l.id).toBeLessThan(44.0);
      expect(l.lon, l.id).toBeGreaterThan(12.0);
      expect(l.lon, l.id).toBeLessThan(14.9);
    }
  });

  it('has every place unverified: the Foundation confirms them on the spot', () => {
    for (const l of luoghi) expect(l.verificato, l.id).toBe(false);
  });

  it('is used: every place has at least one work', () => {
    for (const l of luoghi) {
      expect(
        opere.some((o) => o.luogo === l.id),
        l.id,
      ).toBe(true);
    }
  });

  it('keeps the places of one comune close to each other (catches a typo in a coordinate)', () => {
    const per = new Map<string, Luogo[]>();
    for (const l of luoghi) per.set(l.comune, [...(per.get(l.comune) ?? []), l]);
    for (const [comune, voci] of per) {
      for (const l of voci) {
        // 0.1 degrees is about 10 km: no comune of the list is bigger than that.
        expect(Math.abs(l.lat - voci[0]!.lat), `${comune} ${l.id}`).toBeLessThan(0.1);
        expect(Math.abs(l.lon - voci[0]!.lon), `${comune} ${l.id}`).toBeLessThan(0.1);
      }
    }
  });
});

describe('the photos of the works', () => {
  const dei = (id: string) => opera(id).immagini;
  const ruoli = (id: string) => {
    const conta: Record<string, number> = {};
    for (const i of dei(id)) conta[i.ruolo] = (conta[i.ruolo] ?? 0) + 1;
    return conta;
  };

  it('links the 10 photos of the Merlettaie (9 phases and the portrait of the artist)', () => {
    expect(dei('le-merlettaie')).toHaveLength(10);
    expect(ruoli('le-merlettaie')).toEqual({
      ritratto: 1,
      bozzetto: 3,
      fonderia: 1,
      'in-loco': 4,
      monumento: 1,
    });
  });

  it('links the 5 photos of the Sogno del pescatore', () => {
    expect(dei('il-sogno-del-pescatore')).toHaveLength(5);
    expect(ruoli('il-sogno-del-pescatore')).toEqual({ bozzetto: 1, fonderia: 3, monumento: 1 });
  });

  it('says in immagini which work a linked photo shows, and the other way round', () => {
    for (const o of opere) {
      for (const { immagine } of o.immagini) {
        const foto = immagini.find((i) => i.id === immagine);
        expect(foto?.soggetto, `${o.id} -> ${immagine}`).toEqual({ tipo: 'opera', id: o.id });
      }
    }
  });

  it('gives a photo of a work its subject, and no photo points to a missing work', () => {
    for (const foto of immagini) {
      if (foto.soggetto?.tipo === 'opera') expect(opera(foto.soggetto.id), foto.id).toBeDefined();
    }
    const soggetto = (prefisso: string) =>
      immagini.filter((i) => i.id.startsWith(prefisso)).map((i) => i.soggetto?.id);
    expect(soggetto('le-merlettaie-').every((s) => s === 'le-merlettaie')).toBe(true);
    expect(soggetto('sogno-del-pescatore-').every((s) => s === 'il-sogno-del-pescatore')).toBe(
      true,
    );
    expect(soggetto('la-retara-')).toEqual(['la-retara', 'la-retara']);
    expect(soggetto('stemmi-')).toEqual([
      'stemmi-palazzo-comunale-offida',
      'stemmi-palazzo-comunale-offida',
    ]);
    expect(soggetto('tomba-palmucci-')).toEqual(['tomba-palmucci-offida', 'tomba-palmucci-offida']);
    expect(soggetto('beato-bernardo-')).toEqual(['monumento-beato-bernardo-offida']);
    expect(soggetto('monumento-ai-caduti-fermo-')).toEqual(['monumento-ai-caduti-fermo']);
  });

  it('keeps the cover photo of the Merlettaie out of the 10 photos of the phases', () => {
    const copertina = immagini.find((i) => i.id === 'le-merlettaie-copertina-1')!;
    expect(copertina.soggetto).toEqual({ tipo: 'opera', id: 'le-merlettaie' });
    expect(copertina.stato).toBe('confermato');
    expect(dei('le-merlettaie').some((i) => i.immagine === copertina.id)).toBe(false);
    // 11 photos have the Merlettaie as subject: 10 in the work, plus the cover.
    const delSoggetto = immagini.filter((i) => i.soggetto?.id === 'le-merlettaie');
    expect(delSoggetto).toHaveLength(11);
  });

  it('links to a work only the Via crucis formella that carries the inscription of 1952', () => {
    const crucis = immagini.filter((i) => i.id.startsWith('via-crucis-'));
    expect(crucis).toHaveLength(5);
    const collegate = crucis.filter((i) => i.soggetto !== undefined).map((i) => i.id);
    expect(collegate).toEqual(['via-crucis-3']);
    const tre = crucis.find((i) => i.id === 'via-crucis-3')!;
    expect(tre.soggetto).toEqual({ tipo: 'opera', id: 'via-crucis-offida' });
    expect(tre.stato).toBe('confermato');
    expect(tre.daConfermare).toEqual([]);
    // The other four stay open: Offida or Teramo is not known.
    for (const f of crucis.filter((i) => i.id !== 'via-crucis-3')) {
      expect(f.stato, f.id).toBe('da-confermare');
      expect(haDubbio({ daConfermare: f.daConfermare ?? [] }, 'soggetto'), f.id).toBe(true);
    }
    expect(dei('via-crucis-teramo')).toEqual([]);
  });
});

describe('content:report', () => {
  const { aperti } = apertiDelRepo(RADICE);
  const di = (collezione: string, causa: string) =>
    aperti.filter((a) => a.collezione === collezione && a.causa === causa);

  it('lists every place, because the coordinates are mine', () => {
    expect(di('luoghi', 'coordinate')).toHaveLength(luoghi.length);
  });

  it('lists the missing materials and the Stemmi year as doubts', () => {
    const dubbi = di('opere', 'dubbio').map((a) => a.dettaglio);
    // The 9 works of the list, plus the Tomba Palmucci card.
    expect(dubbi.filter((d) => d.startsWith('materiali:'))).toHaveLength(10);
    expect(dubbi.some((d) => d.includes('anno'))).toBe(true);
  });

  it('lists the works that are not confirmed', () => {
    expect(di('opere', 'da-confermare').length).toBeGreaterThanOrEqual(11);
  });
});
