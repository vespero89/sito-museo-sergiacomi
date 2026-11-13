import { describe, expect, it } from 'vitest';
import { testoRotella, zoomConRotella } from '../../src/scripts/mappa-gesti.ts';

const tasti = (ctrlKey: boolean, metaKey: boolean) => ({ ctrlKey, metaKey });

describe('zoomConRotella', () => {
  it('needs Ctrl on Windows and Linux; Cmd alone does nothing there', () => {
    expect(zoomConRotella(tasti(true, false), false)).toBe(true);
    expect(zoomConRotella(tasti(false, true), false)).toBe(false);
    expect(zoomConRotella(tasti(false, false), false)).toBe(false);
  });
  it('accepts Cmd on a Mac, and Ctrl too (a trackpad pinch arrives as Ctrl + wheel)', () => {
    expect(zoomConRotella(tasti(false, true), true)).toBe(true);
    expect(zoomConRotella(tasti(true, false), true)).toBe(true);
    expect(zoomConRotella(tasti(false, false), true)).toBe(false);
  });
});

describe('testoRotella', () => {
  const testi = { gestoTocco: 'tocco', gestoCtrl: 'ctrl', gestoCmd: 'cmd' };
  it('names the key of the platform', () => {
    expect(testoRotella(testi, false)).toBe('ctrl');
    expect(testoRotella(testi, true)).toBe('cmd');
  });
});
