import { describe, expect, it } from 'vitest';
import {
  SERVIZI,
  dominiCspAttivi,
  serveBanner,
  servizio,
  serviziAttivi,
  tileOsm,
} from '../../src/data/servizi.ts';

describe('services registry', () => {
  it('has unique ids', () => {
    const ids = SERVIZI.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the services the spec lists', () => {
    expect(SERVIZI.map((s) => s.id).sort()).toEqual(
      ['mappa-google', 'newsletter', 'osm-tile', 'social', 'statistiche', 'video'].sort(),
    );
  });

  it('keeps only the OSM tiles active, as a necessary service', () => {
    expect(serviziAttivi().map((s) => s.id)).toEqual(['osm-tile']);
    expect(servizio('osm-tile').categoria).toBe('necessario');
  });

  it('needs no consent banner while only necessary services are active', () => {
    expect(serveBanner()).toBe(false);
  });

  it('writes every CSP source as a bare https origin', () => {
    for (const s of SERVIZI) {
      for (const { dominio } of s.dominiCsp) {
        expect(dominio, s.id).toMatch(/^https:\/\/[a-z0-9.-]+$/);
      }
    }
  });

  it('exposes the tile URL and attribution in one place', () => {
    const tile = tileOsm();
    expect(tile.urlTemplate).toContain('{z}/{x}/{y}');
    expect(new URL(tile.urlTemplate.replace('{z}/{x}/{y}', '0/0/0')).origin).toBe(
      servizio('osm-tile').dominiCsp[0]?.dominio,
    );
    expect(tile.attribuzione).toContain('OpenStreetMap');
    expect(tile.attribuzioneUrl).toMatch(/^https:\/\//);
  });

  it('lists the CSP sources of active services by directive', () => {
    expect(dominiCspAttivi()).toEqual({ 'img-src': ['https://tile.openstreetmap.org'] });
  });

  it('throws on an unknown id', () => {
    expect(() => servizio('nope')).toThrow(/nope/);
  });
});
