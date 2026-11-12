import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AMBIENTI,
  AMBIENTE_DELLE_SALE,
  idVoceAmbiente,
  indirizzoAmbiente,
  indirizzoSala,
  slugFisso,
} from '../../src/lib/ambienti.ts';
import { parseYaml } from '../../src/lib/yaml.ts';

const PAGINE = join(import.meta.dirname, '..', '..', 'src', 'content', 'pagine', 'it');
function frontmatter(id: string): Record<string, unknown> {
  const testo = readFileSync(join(PAGINE, `${id}.md`), 'utf8');
  return parseYaml(testo.split('---')[1]!) as Record<string, unknown>;
}

describe('indirizzoAmbiente', () => {
  it('puts the environment under /il-museo/ with a trailing slash', () => {
    expect(indirizzoAmbiente('il-chiostro')).toBe('/il-museo/il-chiostro/');
  });
});

describe('indirizzoSala', () => {
  it('points the rooms 1 to 3 to their section on the page of the rooms', () => {
    expect(indirizzoSala('sala-1')).toBe('/il-museo/le-sale/#sala-1');
    expect(indirizzoSala('sala-3')).toBe('/il-museo/le-sale/#sala-3');
  });

  it('points room 4 to the workshop page', () => {
    expect(indirizzoSala('sala-4')).toBe('/il-museo/il-laboratorio/');
  });

  it('refuses an id that is not a room', () => {
    expect(() => indirizzoSala('sala-5')).toThrow(/sala-5/);
    expect(() => indirizzoSala('')).toThrow();
  });

  it('lists exactly the rooms 1 to 3 as the sections of the page of the rooms', () => {
    expect(AMBIENTE_DELLE_SALE).toEqual(['sala-1', 'sala-2', 'sala-3']);
  });
});

describe('the four environments', () => {
  it('has four, each with a page entry whose id comes from idVoceAmbiente', () => {
    expect(AMBIENTI).toHaveLength(4);
    for (const ambiente of AMBIENTI) {
      expect(frontmatter(idVoceAmbiente(ambiente))['titolo']).toBeTruthy();
    }
  });

  it('keeps the addresses of the three confirmed environments in line with their entries', () => {
    for (const ambiente of AMBIENTI) {
      const fisso = slugFisso(ambiente);
      if (fisso) expect(frontmatter(idVoceAmbiente(ambiente))['slug']).toBe(fisso);
    }
  });

  it('marks the fourth as provisional in its entry, with the name and the address to confirm', () => {
    const voce = frontmatter(idVoceAmbiente('spazi-fondazione'));
    expect(slugFisso('spazi-fondazione')).toBeUndefined();
    expect(voce['stato']).not.toBe('confermato');
    const campi = (voce['daConfermare'] as { campo: string }[]).map((d) => d.campo);
    expect(campi).toEqual(expect.arrayContaining(['titolo', 'slug']));
  });
});
