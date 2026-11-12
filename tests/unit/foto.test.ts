import { describe, expect, it } from 'vitest';
import { LARGHEZZE, larghezzePerSrcset } from '../../src/lib/foto.ts';

describe('larghezzePerSrcset', () => {
  it('uses the whole scale for a big photo, capped at its largest step', () => {
    expect(larghezzePerSrcset(2400)).toEqual(LARGHEZZE);
  });

  it('never goes above the real width: a 1186 px photo gets its own width as the last step', () => {
    expect(larghezzePerSrcset(1186)).toEqual([480, 800, 1186]);
  });

  it('a photo as wide as a step does not repeat it', () => {
    expect(larghezzePerSrcset(800)).toEqual([480, 800]);
  });

  it('a photo narrower than the first step has just its own width', () => {
    expect(larghezzePerSrcset(400)).toEqual([400]);
  });

  it('honours a smaller maximum', () => {
    expect(larghezzePerSrcset(2400, { max: 1000 })).toEqual([480, 800, 1000]);
  });

  it('rejects a width that is not a positive integer', () => {
    expect(() => larghezzePerSrcset(0)).toThrow();
    expect(() => larghezzePerSrcset(12.5)).toThrow();
  });
});
