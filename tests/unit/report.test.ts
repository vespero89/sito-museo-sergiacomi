import { describe, expect, it } from 'vitest';
import type { Aperto } from '../../src/lib/aperti.ts';
import { creaReport } from '../../src/lib/report.ts';

const aperti: Aperto[] = [
  { collezione: 'opere', file: 'a.md', causa: 'dubbio', dettaglio: 'anno: 1923?', bloccante: true },
  {
    collezione: 'opere',
    file: 'b.md',
    causa: 'segnaposto',
    dettaglio: 'stato: segnaposto',
    bloccante: true,
  },
  {
    collezione: 'luoghi',
    file: 'l.yaml',
    causa: 'coordinate',
    dettaglio: 'verificato: false',
    bloccante: false,
  },
  {
    collezione: 'sito',
    file: 'src/data/sito.yaml',
    causa: 'dubbio',
    dettaglio: 'orari: x',
    bloccante: true,
  },
];

describe('creaReport', () => {
  it('groups the open items by collection, then by type', () => {
    const r = creaReport(aperti);
    expect(r.indexOf('opere')).toBeLessThan(r.indexOf('sito'));
    expect(r).toMatch(/opere[\s\S]*dubbi[\s\S]*a\.md[\s\S]*segnaposto[\s\S]*b\.md/);
    expect(r).toMatch(/NOT BLOCKING \(1\)\nluoghi[\s\S]*coordinate[\s\S]*l\.yaml/);
    expect(r).toMatch(/sito[\s\S]*orari: x/);
  });

  it('splits blocking from not blocking, with totals', () => {
    const r = creaReport(aperti);
    expect(r).toContain('4 open items: 3 blocking, 1 not blocking');
    expect(r).toContain('BLOCKING (3)');
    expect(r).toContain('NOT BLOCKING (1)');
    expect(r.indexOf('BLOCKING (3)')).toBeLessThan(r.indexOf('NOT BLOCKING (1)'));
    expect(r.indexOf('l.yaml')).toBeGreaterThan(r.indexOf('NOT BLOCKING'));
  });

  it('counts the generated texts (segnaposto) apart, in the blocking group', () => {
    expect(creaReport(aperti)).toContain('generated text still to approve (segnaposto): 1');
  });

  it('says nothing blocks and lists the rest', () => {
    const r = creaReport(aperti.filter((a) => !a.bloccante));
    expect(r).toContain('1 open items: 0 blocking, 1 not blocking');
    expect(r).toContain('Nothing blocks the production build');
    expect(r).not.toMatch(/^BLOCKING/m);
    expect(r).toContain('NOT BLOCKING (1)');
  });

  it('says so when nothing is open', () => {
    expect(creaReport([])).toContain('Nothing to confirm');
  });
});
