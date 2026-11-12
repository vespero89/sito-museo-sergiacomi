// Existing pages (placeholder home, 404, text pages): axe, no sideways scroll, no cookies, no outside requests.
import { LARGO, TELEFONO, expect, scorrimentoOrizzontale, test, violazioniAxe } from './helpers.ts';

const PAGINE = [
  { nome: 'home', indirizzo: '/', stato: 200 },
  { nome: '404', indirizzo: '/non-esiste/', stato: 404 },
  { nome: 'Aldo Sergiacomi', indirizzo: '/aldo-sergiacomi/', stato: 200 },
  { nome: 'Visita', indirizzo: '/visita/', stato: 200 },
  { nome: 'Contatti', indirizzo: '/contatti/', stato: 200 },
  { nome: 'Sostieni', indirizzo: '/sostieni/', stato: 200 },
  { nome: 'Didattica', indirizzo: '/didattica/', stato: 200 },
  { nome: 'Pubblicazioni', indirizzo: '/pubblicazioni/', stato: 200 },
  { nome: 'Il Museo', indirizzo: '/il-museo/', stato: 200 },
  { nome: 'Le sale', indirizzo: '/il-museo/le-sale/', stato: 200 },
  { nome: 'Il laboratorio', indirizzo: '/il-museo/il-laboratorio/', stato: 200 },
  { nome: 'Il chiostro', indirizzo: '/il-museo/il-chiostro/', stato: 200 },
  {
    nome: 'Gli spazi dei laboratori',
    indirizzo: '/il-museo/gli-spazi-dei-laboratori/',
    stato: 200,
  },
];
const SCHERMI = [
  { nome: 'phone 390', vista: TELEFONO },
  { nome: 'wide 1280', vista: LARGO },
];

for (const pagina of PAGINE) {
  for (const schermo of SCHERMI) {
    test.describe(`${pagina.nome} at ${schermo.nome}`, () => {
      test.use({ viewport: schermo.vista });

      test('has no axe violations', async ({ page }) => {
        const risposta = await page.goto(pagina.indirizzo);
        expect(risposta?.status()).toBe(pagina.stato);
        expect(await violazioniAxe(page)).toEqual([]);
      });

      test('does not scroll sideways and writes no cookie', async ({ page, context }) => {
        await page.goto(pagina.indirizzo);
        expect(await scorrimentoOrizzontale(page)).toBe(false);
        expect(await context.cookies()).toEqual([]);
      });
    });
  }
}
