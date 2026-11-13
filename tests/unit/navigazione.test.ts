import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import PiedeSito from '../../src/components/PiedeSito.astro';
import Testata from '../../src/components/Testata.astro';
import { leggiSito } from '../../src/lib/sito-dati';
import type { Sito } from '../../src/lib/sito';

/** The addresses a visitor can reach from the header and the footer of a site. */
async function raggiungibili(sito: Sito): Promise<Set<string>> {
  const contenitore = await AstroContainer.create();
  const testata = await contenitore.renderToString(Testata, {
    props: { nome: sito.nome, menu: sito.navigazione.principale, azioni: sito.azioni },
  });
  const piede = await contenitore.renderToString(PiedeSito, {
    props: {
      nome: sito.nome,
      fondazione: sito.fondazione.denominazione,
      indirizzo: sito.museo.indirizzo,
      email: sito.contatti.email,
      gruppi: sito.navigazione.piede,
    },
  });
  const indirizzi = [testata, piede].flatMap((html) =>
    [...parseHTML(html).document.querySelectorAll('a[href]')].map((a) =>
      a.getAttribute('href')!.replace(/#.*$/, ''),
    ),
  );
  return new Set(indirizzi);
}

/** Every page the menu and the footer of sito.yaml point at. */
function pagineDelSito(sito: Sito): string[] {
  return [
    ...sito.navigazione.principale.map((v) => v.href),
    ...sito.navigazione.piede.flatMap((g) => g.voci.map((v) => v.href)),
  ];
}

describe('navigation', () => {
  it('reaches every page of the menu and the footer from the header or the footer', async () => {
    const sito = leggiSito();
    const raggiunte = await raggiungibili(sito);
    for (const pagina of pagineDelSito(sito)) expect(raggiunte).toContain(pagina);
  });

  it('keeps every page reachable when "Didattica" moves from the menu to the footer', async () => {
    const sito = structuredClone(leggiSito());
    const voce = sito.navigazione.principale.find((v) => v.href === '/didattica/')!;
    const prima = pagineDelSito(sito);
    sito.navigazione.principale = sito.navigazione.principale.filter((v) => v !== voce);
    sito.navigazione.piede[0]!.voci.push(voce);

    expect(sito.navigazione.principale.map((v) => v.href)).not.toContain('/didattica/');
    const raggiunte = await raggiungibili(sito);
    for (const pagina of prima) expect(raggiunte).toContain(pagina);
  });

  it('shows in the header only what sito.yaml lists as main menu', async () => {
    const sito = structuredClone(leggiSito());
    sito.navigazione.principale = sito.navigazione.principale.filter(
      (v) => v.href !== '/didattica/',
    );
    const html = await (
      await AstroContainer.create()
    ).renderToString(Testata, {
      props: { nome: sito.nome, menu: sito.navigazione.principale, azioni: sito.azioni },
    });
    expect(html).not.toContain('Didattica');
  });

  it('has the six entries in the menu, a search link and one booking button in the header, Home and Cerca in the phone menu', async () => {
    const sito = leggiSito();
    const html = await (
      await AstroContainer.create()
    ).renderToString(Testata, {
      props: { nome: sito.nome, menu: sito.navigazione.principale, azioni: sito.azioni },
    });
    const { document } = parseHTML(html);
    const voci = [...document.querySelectorAll('nav.menu li:not(.solo-telefono) a')].map((a) =>
      a.textContent!.trim(),
    );
    expect(voci).toEqual([
      'Aldo Sergiacomi',
      'Il museo',
      'Opere',
      'Itinerari',
      'Didattica',
      'Visita',
    ]);
    const telefono = [...document.querySelectorAll('nav.menu li.solo-telefono a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(telefono).toEqual(['/', '/ricerca/']);
    expect(document.querySelector('a.cerca')!.getAttribute('href')).toBe('/ricerca/');
    const prenota = [...document.querySelectorAll('a.in-testata')];
    expect(prenota.map((a) => a.textContent!.trim())).toEqual(['Prenota la visita']);
  });

  it('has the column "Approfondisci" in the footer with the sections out of the menu and the search', async () => {
    const sito = leggiSito();
    const html = await (
      await AstroContainer.create()
    ).renderToString(PiedeSito, {
      props: {
        nome: sito.nome,
        fondazione: sito.fondazione.denominazione,
        indirizzo: sito.museo.indirizzo,
        email: sito.contatti.email,
        gruppi: sito.navigazione.piede,
      },
    });
    const { document } = parseHTML(html);
    const colonna = [...document.querySelectorAll('section')].find(
      (s) => s.querySelector('h2')!.textContent === 'Approfondisci',
    )!;
    expect([...colonna.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/eventi/',
      '/archivio/',
      '/pubblicazioni/',
      '/chi-siamo/',
      '/sostieni/',
      '/ricerca/',
    ]);
  });
});
