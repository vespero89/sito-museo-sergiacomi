import { describe, expect, it } from 'vitest';
import { leggiSito } from '../../src/lib/sito-dati';
import { builtPages } from './helpers';

// What every page gets from the Base layout. The keyboard check (Tab, Esc) is in the e2e tests (task 9);
// here the markup shows that the menu and the actions need no JavaScript.
const sito = leggiSito();
const pagine = builtPages().map((p) => [p.path, p.document] as const);

describe('layout of every built page', () => {
  it.each(pagine)('%s: skip link first, then header, main, footer', (_path, document) => {
    const primo = document.querySelector('a[href]');
    expect(primo?.getAttribute('href')).toBe('#contenuto');
    expect(document.querySelectorAll('main#contenuto')).toHaveLength(1);
    expect(document.querySelectorAll('header')).toHaveLength(1);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  });

  it.each(pagine)('%s: the menu is a native popover with a button, no script of its own', (_path, document) => {
    const bottone = document.querySelector('button[popovertarget]');
    const menu = document.getElementById(bottone!.getAttribute('popovertarget')!);
    expect(menu?.tagName).toBe('NAV');
    expect(menu?.hasAttribute('popover')).toBe(true);
    // A JSON-LD script is data, not code. The only code is the own files of the gallery, the phases and the comparison, on pages that have one.
    const codice = document.querySelectorAll('script:not([type="application/ld+json"])');
    const attesi = ['[data-galleria]', '[data-fasi]', '[data-confronto]'].filter((s) => document.querySelector(s));
    expect(codice).toHaveLength(attesi.length);
    for (const script of codice) expect(script.getAttribute('src')).toMatch(/^\/_astro\/(Galleria|Fasi|Confronto)/);
  });

  it.each(pagine)('%s: the menu items come from sito.yaml', (_path, document) => {
    const menu = document.querySelector('nav[popover]')!;
    const voci = [...menu.querySelectorAll('ul a')].map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(voci).toEqual(sito.navigazione.principale.map((v) => [v.titolo, v.href]));
  });

  it.each(pagine)('%s: both actions are plain links in the header and in the bar', (_path, document) => {
    const attese = [sito.azioni.prenota, sito.azioni.orari].map((a) => [a.titolo, a.href]);
    const leggi = (selettore: string) =>
      [...document.querySelectorAll(selettore)].map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(leggi('header ul a.azione')).toEqual(attese);
    expect(leggi('nav[aria-label="Azioni di visita"] a.azione')).toEqual(attese);
  });
});
