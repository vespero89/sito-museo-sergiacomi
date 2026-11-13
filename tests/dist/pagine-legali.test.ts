import { describe, expect, it } from 'vitest';
import { serviziAttivi } from '../../src/data/servizi';
import { builtPages } from './helpers';

// Task 22 (reduced): the legal pages exist as placeholders, are linked from every footer, list the
// active services, and carry markers so the content gate keeps blocking production.
const PAGINE = ['/privacy/', '/cookie/', '/note-legali/', '/accessibilita/'];
const pagine = builtPages();
const documento = (indirizzo: string) =>
  pagine.find((p) => p.path === `${indirizzo.slice(1)}index.html`)!.document;

describe('the legal pages', () => {
  it.each(PAGINE)('%s has one h1, a description and a canonical address', (indirizzo) => {
    const d = documento(indirizzo);
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.querySelector('meta[name="description"]')!.getAttribute('content')!.length).toBeGreaterThan(69);
    expect(d.querySelector('link[rel="canonical"]')!.getAttribute('href')).toMatch(
      new RegExp(`${indirizzo}$`),
    );
  });

  it.each(PAGINE)('%s shows the placeholder label and the open items', (indirizzo) => {
    const d = documento(indirizzo);
    expect(d.querySelector('.dubbi')).not.toBeNull();
    expect(d.body.textContent).toContain('[[DA CONFERMARE');
  });

  it.each(PAGINE)('%s is linked from the footer of the home page', (indirizzo) => {
    const href = [...documento('/').querySelectorAll('footer a')].map((a) => a.getAttribute('href'));
    expect(href).toContain(indirizzo);
  });

  it('lists on /cookie/ the active services of the registry', () => {
    const d = documento('/cookie/');
    const mostrati = [...d.querySelectorAll('[data-servizio]')].map((e) => e.getAttribute('data-servizio'));
    expect(mostrati).toEqual(serviziAttivi().map((s) => s.id));
    expect(mostrati.length).toBeGreaterThan(0);
  });
});
