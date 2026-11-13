import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import {
  mostraAperti,
  sitoDaMostrare,
  togliMarcatori,
  togliMarcatoriDa,
} from '../../src/lib/aperti-visibili.ts';
import { mdastTogliMarcatori } from '../../src/lib/mdast-togli-marcatori.ts';
import { leggiSito } from '../../src/lib/sito-dati.ts';
import type { Sito } from '../../src/lib/sito.ts';

describe('mostraAperti', () => {
  it('is true in a preview and false in production', () => {
    expect(mostraAperti({})).toBe(true);
    expect(mostraAperti({ SITE_ENV: 'preview' })).toBe(true);
    expect(mostraAperti({ SITE_ENV: 'production' })).toBe(false);
  });

  it('is true again in production with ALLOW_OPEN_ITEMS=1', () => {
    expect(mostraAperti({ SITE_ENV: 'production', ALLOW_OPEN_ITEMS: '1' })).toBe(true);
  });
});

describe('togliMarcatori', () => {
  it('leaves a text with no marker alone', () => {
    expect(togliMarcatori('Un testo [con parentesi] normale.')).toBe(
      'Un testo [con parentesi] normale.',
    );
  });

  it('removes a marker at the end of a sentence with the space before it', () => {
    expect(togliMarcatori('Fu fatta nel 1952 [[DA CONFERMARE: data]].')).toBe('Fu fatta nel 1952.');
  });

  it('removes a marker in the middle of a sentence', () => {
    expect(togliMarcatori('Fu fatta [[DA CONFERMARE: quando]] dal maestro.')).toBe(
      'Fu fatta dal maestro.',
    );
  });

  it('removes two markers', () => {
    expect(togliMarcatori('A [[DA CONFERMARE: x]] e B [[DA CONFERMARE: y]].')).toBe('A e B.');
  });

  it('removes a marker that holds an apostrophe and accents', () => {
    expect(togliMarcatori("Testo. [[DA CONFERMARE: l'accessibilità]]")).toBe('Testo.');
  });
});

describe('togliMarcatoriDa', () => {
  it('cleans strings at any depth and keeps everything else', () => {
    const data = new Date('2020-01-01');
    const fuori = {
      titolo: 'Il portale [[DA CONFERMARE: nome]]',
      anno: 1980,
      attivo: true,
      data,
      elenco: ['uno', 'due [[DA CONFERMARE: x]]'],
      dentro: { nota: '[[DA CONFERMARE: tutto]]', altro: null },
    };
    expect(togliMarcatoriDa(fuori)).toEqual({
      titolo: 'Il portale',
      anno: 1980,
      attivo: true,
      data,
      elenco: ['uno', 'due'],
      dentro: { nota: '', altro: null },
    });
    expect(togliMarcatoriDa(fuori).data).toBe(data);
  });
});

describe('sitoDaMostrare', () => {
  const sito = (extra: Partial<Sito> = {}) =>
    ({
      daConfermare: [],
      contatti: { email: 'info@example.org', telefono: '' },
      social: [{ nome: 'Pagina', url: 'https://example.org/p' }],
      ...extra,
    }) as unknown as Sito;

  it('shows everything in a preview, even a doubtful or empty field', () => {
    const s = sito({ daConfermare: [{ campo: 'social', nota: 'x' }] });
    expect(sitoDaMostrare(s, 'social', true)).toBe(true);
    expect(sitoDaMostrare(s, 'contatti.telefono', true)).toBe(true);
  });

  it('shows a confirmed field with a value in production', () => {
    expect(sitoDaMostrare(sito(), 'contatti.email', false)).toBe(true);
    expect(sitoDaMostrare(sito(), 'social', false)).toBe(true);
  });

  it('leaves out an empty value in production', () => {
    expect(sitoDaMostrare(sito(), 'contatti.telefono', false)).toBe(false);
  });

  it('leaves out a doubtful value in production, whatever the value is', () => {
    const s = sito({ daConfermare: [{ campo: 'contatti.email', nota: 'forse' }] });
    expect(sitoDaMostrare(s, 'contatti.email', false)).toBe(false);
  });

  it('leaves out a doubtful parent and the field inside it', () => {
    const s = sito({ daConfermare: [{ campo: 'contatti', nota: 'forse' }] });
    expect(sitoDaMostrare(s, 'contatti.email', false)).toBe(false);
  });

  it('leaves out the social block while it has no links', () => {
    expect(sitoDaMostrare(sito({ social: [] }), 'social', false)).toBe(false);
  });

  it('reads the real sito.yaml: the real social block is doubtful and empty', () => {
    expect(sitoDaMostrare(leggiSito(), 'social', false)).toBe(false);
  });
});

describe('the Markdown plugin', () => {
  const html = async (testo: string) =>
    (await markdownToHtml(testo, { mdastPlugins: [mdastTogliMarcatori] })).html.trim();

  it('keeps a text with no marker as it is', async () => {
    expect(await html('Un testo.')).toBe('<p>Un testo.</p>');
  });

  it('removes one marker and keeps the sentence', async () => {
    expect(await html('Fu fatta nel 1952 [[DA CONFERMARE: data incerta]].')).toBe(
      '<p>Fu fatta nel 1952.</p>',
    );
  });

  it('removes two markers in one paragraph', async () => {
    expect(await html('A [[DA CONFERMARE: x]] e B [[DA CONFERMARE: y]].')).toBe('<p>A e B.</p>');
  });

  it('removes a marker with an apostrophe in it, which smart punctuation curls', async () => {
    expect(await html("Ok. [[DA CONFERMARE: l'accessibilità]]")).toBe('<p>Ok.</p>');
  });

  it('drops a paragraph that held only a marker', async () => {
    expect(await html('Prima.\n\n[[DA CONFERMARE: titolare]]\n\nDopo.')).toBe(
      '<p>Prima.</p>\n<p>Dopo.</p>',
    );
  });

  it('removes a marker next to emphasis without gluing the words', async () => {
    expect(await html('Ciao [[DA CONFERMARE: x]] *mondo*')).toBe('<p>Ciao <em>mondo</em></p>');
  });

  it('removes a [[BLOCCANTE: ...]] marker too, since it only runs once the build was let through', async () => {
    expect(await html('Testo [[BLOCCANTE: x]].')).toBe('<p>Testo.</p>');
  });
});
