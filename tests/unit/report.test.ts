import { describe, expect, it } from 'vitest';
import type { Aperto } from '../../src/lib/aperti.ts';
import { creaReport } from '../../src/lib/report.ts';

const aperti: Aperto[] = [
  { collezione: 'opere', file: 'a.md', causa: 'dubbio', dettaglio: 'anno: 1923?' },
  { collezione: 'opere', file: 'b.md', causa: 'segnaposto', dettaglio: 'stato: segnaposto' },
  { collezione: 'luoghi', file: 'l.yaml', causa: 'coordinate', dettaglio: 'verificato: false' },
  { collezione: 'sito', file: 'src/data/sito.yaml', causa: 'dubbio', dettaglio: 'orari: x' },
];

describe('creaReport', () => {
  it('groups the open items by collection, then by type', () => {
    const r = creaReport(aperti);
    expect(r.indexOf('opere')).toBeLessThan(r.indexOf('luoghi'));
    expect(r).toMatch(/opere[\s\S]*dubbi[\s\S]*a\.md[\s\S]*segnaposto[\s\S]*b\.md/);
    expect(r).toMatch(/luoghi[\s\S]*coordinate[\s\S]*l\.yaml/);
    expect(r).toMatch(/sito[\s\S]*orari: x/);
  });

  it('counts the items', () => {
    expect(creaReport(aperti)).toContain('4 open items');
  });

  it('says so when nothing is open', () => {
    expect(creaReport([])).toContain('Nothing to confirm');
  });
});
