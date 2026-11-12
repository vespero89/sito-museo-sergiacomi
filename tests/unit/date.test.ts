import { describe, expect, it } from 'vitest';
import { oggiRoma, prossimoEvento, scostamentoRoma } from '../../src/lib/date.ts';

describe('oggiRoma', () => {
  it('is the day in Rome, not in UTC', () => {
    // 22:30 UTC on 30 June is already 1 July in Rome (summer time, +02:00).
    expect(oggiRoma(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
    expect(oggiRoma(new Date('2026-06-30T21:30:00Z'))).toBe('2026-06-30');
    // Winter time (+01:00): midnight in Rome is 23:00 UTC.
    expect(oggiRoma(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01');
  });
});

describe('scostamentoRoma', () => {
  it('follows summer and winter time', () => {
    expect(scostamentoRoma('2012-07-27')).toBe('+02:00');
    expect(scostamentoRoma('2026-01-15')).toBe('+01:00');
  });
});

describe('prossimoEvento', () => {
  const a = { id: 'a', data: '2026-11-20' };
  const b = { id: 'b', data: '2026-12-01', dataFine: '2026-12-03' };
  const vecchio = { id: 'vecchio', data: '2012-07-27', dataFine: '2012-07-28' };
  const senzaData = { id: 'senza', data: undefined };

  it('picks the earliest event that has not ended', () => {
    expect(prossimoEvento([b, a, vecchio], '2026-11-12')).toEqual({ evento: a, passato: false });
  });

  it('keeps an event next for the whole of its day', () => {
    expect(prossimoEvento([a], '2026-11-20')).toEqual({ evento: a, passato: false });
    expect(prossimoEvento([a], '2026-11-21')).toEqual({ evento: a, passato: true });
  });

  it('keeps a multi-day event next until the end of dataFine', () => {
    expect(prossimoEvento([b], '2026-12-03')).toEqual({ evento: b, passato: false });
    expect(prossimoEvento([b], '2026-12-04')?.passato).toBe(true);
  });

  it('falls back to the latest past event, and ignores events with no date', () => {
    expect(prossimoEvento([vecchio, a, senzaData], '2027-01-01')).toEqual({
      evento: a,
      passato: true,
    });
    expect(prossimoEvento([senzaData], '2026-11-12')).toBeUndefined();
  });

  it('gives nothing when there are no events', () => {
    expect(prossimoEvento([], '2026-11-12')).toBeUndefined();
  });
});
