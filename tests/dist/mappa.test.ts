import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { DIST, walk } from './helpers';

// The map of the works (task 17) as the build leaves it. The behaviour is in tests/e2e/mappa.spec.ts.
const pagina = parseHTML(readFileSync(join(DIST, 'opere', 'index.html'), 'utf8')).document;
const voci = [...pagina.querySelectorAll<HTMLElement>('li[data-voce]')];

/** The script of the page and every chunk it imports, statically or with import(). */
function graficoScript(): string[] {
  const src = pagina.querySelector('script[src*="MappaOpere"]')!.getAttribute('src')!;
  const visti = new Set<string>();
  const coda = [join(DIST, src)];
  while (coda.length > 0) {
    const file = coda.pop()!;
    if (visti.has(file)) continue;
    visti.add(file);
    const codice = readFileSync(file, 'utf8');
    for (const m of codice.matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g)) {
      coda.push(join(file, '..', m[1]!));
    }
  }
  return [...visti];
}

describe('/opere/ with the map', () => {
  it('writes every work in the list with the data the script reads, and nothing needs JavaScript', () => {
    expect(voci.length).toBe(27);
    for (const v of voci) {
      for (const attributo of ['data-titolo', 'data-href', 'data-comune', 'data-luogo', 'data-lat', 'data-lon']) {
        expect(v.getAttribute(attributo), `${v.getAttribute('data-voce')} ${attributo}`).toBeTruthy();
      }
    }
    expect(voci.filter((v) => v.getAttribute('data-certa') === '0').length).toBe(2);
    const senzaJs = pagina.querySelector('[data-senza-js]')!;
    expect(senzaJs.hasAttribute('hidden')).toBe(false);
    expect(pagina.querySelector('[data-controlli]')!.hasAttribute('hidden')).toBe(true);
  });

  it('has the skip link to the list before the map region, and the list has its anchor', () => {
    const salta = pagina.querySelector('a.salta-mappa')!;
    expect(salta.getAttribute('href')).toBe('#elenco-opere');
    expect(pagina.getElementById('elenco-opere')).not.toBeNull();
    const regione = pagina.querySelector('[role="region"][aria-label]')!;
    const ordine = [...pagina.querySelectorAll('*')];
    expect(ordine.indexOf(salta)).toBeLessThan(ordine.indexOf(regione));
  });

  it('gives the script the tile address and the attribution from the registry', () => {
    const radice = pagina.querySelector('[data-mappa-opere]')!;
    expect(radice.getAttribute('data-tile')).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png$/);
    expect(radice.getAttribute('data-testi')).toContain('OpenStreetMap contributors');
  });

  it('does not ship the 356 language files of the gesture plugin nor its compiled file', () => {
    const file = walk(DIST).map((f) => f.replace(DIST, ''));
    expect(file.filter((f) => /locales/i.test(f))).toEqual([]);
    expect(file.filter((f) => /leaflet-gesture-handling\.min/.test(f))).toEqual([]);
  });

  it('weighs 80 KB or less of compressed JavaScript, Leaflet and the plugin included', () => {
    const grafico = graficoScript();
    expect(grafico.some((f) => /leaflet/.test(f))).toBe(true);
    const peso = grafico.reduce((somma, f) => somma + gzipSync(readFileSync(f)).length, 0);
    expect(peso).toBeLessThanOrEqual(80 * 1024);
  });

  it('keeps the leaflet stylesheet without needing a marker image', () => {
    expect(existsSync(join(DIST, 'opere', 'index.html'))).toBe(true);
    const css = walk(join(DIST, '_astro'))
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(css).toContain('.leaflet-container');
    expect(css).toContain('.leaflet-gesture-handling');
  });
});

// The small maps (task 18): the place on every work page, the stops on every itinerary.
describe('the small maps', () => {
  const documento = (file: string) =>
    parseHTML(readFileSync(join(DIST, file, 'index.html'), 'utf8')).document;
  const cartelle = (sotto: string) =>
    walk(join(DIST, sotto))
      .filter((f) => f.endsWith('index.html') && f !== join(DIST, sotto, 'index.html'))
      .map((f) => f.slice(DIST.length + 1, -'/index.html'.length));

  it('puts a map and, for no JavaScript, the address on every work page', () => {
    const schede = cartelle('opere');
    expect(schede).toHaveLength(27);
    for (const scheda of schede) {
      const radice = documento(scheda).querySelector<HTMLElement>('[data-mappa-piccola]');
      expect(radice, scheda).not.toBeNull();
      const punti = JSON.parse(radice!.getAttribute('data-punti')!);
      expect(punti, scheda).toHaveLength(1);
      expect(radice!.querySelector('[data-senza-js]')!.textContent, scheda).toContain(
        punti[0].luogoNome,
      );
    }
  });

  it('draws on every itinerary the stops in the order of the numbered list', () => {
    const itinerari = cartelle('itinerari');
    expect(itinerari).toHaveLength(4);
    for (const itinerario of itinerari) {
      const d = documento(itinerario);
      const radice = d.querySelector<HTMLElement>('[data-mappa-piccola]')!;
      const punti = JSON.parse(radice.getAttribute('data-punti')!) as {
        tappe: { numero: number; titolo: string }[];
      }[];
      const sulla = punti.flatMap((p) => p.tappe).sort((a, b) => a.numero - b.numero);
      const elenco = [...d.querySelectorAll('ol.tappe li')].map(
        (li) => (li.querySelector('a, span')!.textContent ?? '').trim(),
      );
      expect(sulla.map((t) => t.numero), itinerario).toEqual(elenco.map((_, i) => i + 1));
      expect(sulla.map((t) => t.titolo), itinerario).toEqual(elenco);
    }
  });
});
