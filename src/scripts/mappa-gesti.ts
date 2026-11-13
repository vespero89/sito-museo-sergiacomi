// The gestures of the maps (spec "gesti della mappa"): one finger scrolls the page and shows a hint,
// two fingers move and zoom the map, the wheel zooms only with Ctrl (Cmd on a Mac). A trackpad pinch
// reaches the browser as a wheel event with Ctrl pressed, so it zooms the map too. The mouse is unchanged.
import type * as Leaflet from 'leaflet';

/** How long the hint stays on screen after the last event that showed it. */
export const DURATA_MESSAGGIO = 1700;

export interface TestiGesti {
  gestoTocco: string;
  gestoCtrl: string;
  gestoCmd: string;
}

/** Does this wheel event zoom the map? On a Mac also Ctrl counts: it is how a pinch arrives. */
export function zoomConRotella(e: { ctrlKey: boolean; metaKey: boolean }, mac: boolean): boolean {
  return e.ctrlKey || (mac && e.metaKey);
}

/** The hint for the wheel, with the key of the platform. */
export function testoRotella(testi: TestiGesti, mac: boolean): string {
  return mac ? testi.gestoCmd : testi.gestoCtrl;
}

/**
 * Adds the gestures to a map. Leaflet is created with its defaults (dragging, touch zoom, wheel
 * zoom); here the one-finger drag and the plain wheel are held back.
 */
export function gestiMappa(
  mappa: Leaflet.Map,
  contenitore: HTMLElement,
  testi: TestiGesti,
  mac: boolean,
): void {
  const messaggio = document.createElement('div');
  messaggio.className = 'mappa-gesti';
  messaggio.setAttribute('role', 'status');
  messaggio.setAttribute('aria-live', 'polite');
  contenitore.append(messaggio);

  let timer: number | undefined;
  const mostra = (testo: string) => {
    if (messaggio.textContent !== testo) messaggio.textContent = testo;
    messaggio.classList.add('mappa-gesti--visibile');
    window.clearTimeout(timer);
    timer = window.setTimeout(nascondi, DURATA_MESSAGGIO);
  };
  const nascondi = () => {
    window.clearTimeout(timer);
    messaggio.classList.remove('mappa-gesti--visibile');
  };

  // Touch. Leaflet's drag ignores a touch with two fingers and its pinch handler also moves the map,
  // so it is enough to switch the drag off while any finger is down. This runs before Leaflet's
  // own listeners (capture, on the container) and the CSS leaves the vertical scroll to the browser.
  contenitore.addEventListener(
    'touchstart',
    () => {
      if (mappa.dragging.enabled()) mappa.dragging.disable();
    },
    { capture: true, passive: true },
  );
  contenitore.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length === 1) mostra(testi.gestoTocco);
      else nascondi();
    },
    { passive: true },
  );
  const fine = (e: TouchEvent) => {
    if (e.touches.length > 0) return;
    if (!mappa.dragging.enabled()) mappa.dragging.enable();
    nascondi();
  };
  contenitore.addEventListener('touchend', fine, { passive: true });
  contenitore.addEventListener('touchcancel', fine, { passive: true });

  // Wheel. Without the key the event is not given to Leaflet: the page scrolls and the hint appears.
  contenitore.addEventListener(
    'wheel',
    (e) => {
      if (zoomConRotella(e, mac)) return;
      e.stopImmediatePropagation();
      mostra(testoRotella(testi, mac));
    },
    { capture: true, passive: true },
  );

  mappa.on('unload', () => window.clearTimeout(timer));
}
