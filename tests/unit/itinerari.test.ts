import { describe, expect, it } from 'vitest';
import { linkGoogleMaps, raggruppaTappe } from '../../src/lib/itinerari.ts';

describe('raggruppaTappe', () => {
  it('numbers the stops across groups', () => {
    const gruppi = raggruppaTappe([
      { query: 'a', gruppo: 'Marche' },
      { query: 'b', gruppo: 'Marche' },
      { query: 'c', gruppo: 'Abruzzo' },
    ]);
    expect(gruppi.map((g) => g.gruppo)).toEqual(['Marche', 'Abruzzo']);
    expect(gruppi.map((g) => g.tappe.map((t) => t.numero))).toEqual([[1, 2], [3]]);
  });

  it('gives a single unnamed group when no stop has a group', () => {
    const gruppi = raggruppaTappe([{ query: 'a' }, { query: 'b' }]);
    expect(gruppi).toHaveLength(1);
    expect(gruppi[0]!.gruppo).toBeUndefined();
  });
});

describe('linkGoogleMaps', () => {
  const url = (l: string) => new URL(l).searchParams;

  it('starts at the origin, passes the stops in order and ends at the last', () => {
    const p = url(linkGoogleMaps('via Ischia 24, Offida', ['Offida', 'Ascoli', 'Fermo'], 'auto'));
    expect(p.get('origin')).toBe('via Ischia 24, Offida');
    expect(p.get('waypoints')).toBe('Offida|Ascoli');
    expect(p.get('destination')).toBe('Fermo');
    expect(p.get('travelmode')).toBe('driving');
  });

  it('has no waypoints for a single stop and walking for a walk', () => {
    const p = url(linkGoogleMaps('x', ['Offida'], 'a-piedi'));
    expect(p.has('waypoints')).toBe(false);
    expect(p.get('destination')).toBe('Offida');
    expect(p.get('travelmode')).toBe('walking');
  });

  it('leaves the travel mode out for a mixed or unknown mode', () => {
    expect(url(linkGoogleMaps('x', ['a', 'b'], 'misto')).has('travelmode')).toBe(false);
    expect(url(linkGoogleMaps('x', ['a', 'b'])).has('travelmode')).toBe(false);
  });

  it('keeps at most 9 intermediate stops, in order', () => {
    const tappe = Array.from({ length: 14 }, (_, i) => `t${i + 1}`);
    const p = url(linkGoogleMaps('x', tappe));
    expect(p.get('waypoints')!.split('|')).toEqual(tappe.slice(0, 9));
    expect(p.get('destination')).toBe('t14');
  });

  it('encodes special characters and refuses an empty list', () => {
    expect(linkGoogleMaps('a&b', ['c d'])).toContain('origin=a%26b');
    expect(() => linkGoogleMaps('x', [])).toThrow();
  });
});
