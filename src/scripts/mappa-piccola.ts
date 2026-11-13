// The small maps (spec 5.3, task 18): the place of a work on its page and the numbered stops, with
// the route, of an itinerary. They reuse the base of mappa-opere.ts. The map loads when it comes
// near the screen, in a box whose size is already reserved by the CSS.
import type * as Leaflet from 'leaflet';
import type { PuntoPercorso } from '../lib/itinerari.ts';
import leafletCss from 'leaflet/dist/leaflet.css?url';
import mappaCss from '../styles/mappa-leaflet.css?url';
import { caricaLeaflet, creaMappa, movimentoRidotto, type TestiMappa } from './mappa-opere.ts';

type L = typeof Leaflet;

/**
 * A marker for a place: the numbers of its stops ("2" or "1, 3") or, for a work page, a plain dot.
 * It can be focused and opens a popup with the stops; the name starts with the visible numbers.
 */
function creaMarcatoreTappe(L: L, punto: PuntoPercorso, testi: TestiMappa): Leaflet.Marker {
  const numeri = punto.tappe.map((t) => t.numero).join(', ');
  const nome = numeri
    ? `${numeri} ${testi.tappa.replace('{n}', numeri)}, ${punto.luogoNome}`
    : punto.luogoNome;
  const larga = punto.tappe.length > 1;
  const classi = ['marcatore', punto.indicativa ? 'indicativo' : '', larga ? 'largo' : '']
    .filter(Boolean)
    .join(' ');
  const marcatore = L.marker([punto.lat, punto.lon], {
    icon: L.divIcon({
      className: classi,
      html: `<span aria-hidden="true">${numeri}</span>`,
      iconSize: larga ? [56, 40] : [40, 40],
      iconAnchor: larga ? [28, 20] : [20, 20],
      popupAnchor: [0, -20],
    }),
    title: nome,
    keyboard: true,
  });
  marcatore.on('add', () => marcatore.getElement()?.setAttribute('aria-label', nome));

  const popup = document.createElement('div');
  const titolo = document.createElement('h3');
  titolo.textContent = punto.luogoNome;
  popup.append(titolo);
  const voci = punto.tappe.filter((t) => t.numero > 0);
  if (voci.length > 0) {
    const elenco = document.createElement('ul');
    for (const t of voci) {
      const voce = document.createElement('li');
      if (t.href) {
        const a = document.createElement('a');
        a.href = t.href;
        a.textContent = t.titolo;
        voce.append(`${t.numero}. `, a);
      } else voce.textContent = `${t.numero}. ${t.titolo}`;
      elenco.append(voce);
    }
    popup.append(elenco);
  }
  if (punto.indicativa) {
    const nota = document.createElement('p');
    nota.className = 'indicativa';
    nota.textContent = testi.indicativa;
    popup.append(nota);
  }
  marcatore.bindPopup(popup);
  marcatore.on('popupopen', (e) => {
    const chiudi = (e.popup as unknown as { _closeButton?: HTMLElement })._closeButton;
    chiudi?.setAttribute('aria-label', testi.chiudi);
  });
  marcatore.on('popupclose', (e) => {
    if (e.popup.getElement()?.contains(document.activeElement)) marcatore.getElement()?.focus();
  });
  return marcatore;
}

/** Adds the stylesheets of the map to the page and waits until they are loaded. */
function caricaStili(): Promise<unknown> {
  return Promise.all(
    [leafletCss, mappaCss].map(
      (href) =>
        new Promise((risolvi) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.onload = link.onerror = risolvi;
          document.head.append(link);
        }),
    ),
  );
}

async function costruisci(radice: HTMLElement): Promise<void> {
  const testi = JSON.parse(radice.dataset['testi']!) as TestiMappa;
  const punti = JSON.parse(radice.dataset['punti']!) as PuntoPercorso[];
  const percorsi = JSON.parse(radice.dataset['percorsi'] ?? '[]') as [number, number][][];
  const ridotto = movimentoRidotto();
  // The map styles come with the map, not with the page (Lighthouse on a work page).
  const [L] = await Promise.all([caricaLeaflet(), caricaStili()]);
  const mappa = creaMappa(L, radice.querySelector<HTMLElement>('[data-mappa]')!, {
    tile: radice.dataset['tile']!,
    testi,
    ridotto,
  });
  for (const linea of percorsi) {
    // `interactive: false`: the line is not a stop on the keyboard path.
    L.polyline(linea, { className: 'percorso', interactive: false }).addTo(mappa);
  }
  for (const punto of punti) creaMarcatoreTappe(L, punto, testi).addTo(mappa);
  if (punti.length === 1) {
    const [p] = punti;
    mappa.setView([p!.lat, p!.lon], p!.indicativa ? 12 : 15, { animate: false });
  } else {
    mappa.fitBounds(L.latLngBounds(punti.map((p) => [p.lat, p.lon] as [number, number])), {
      padding: [40, 40],
      maxZoom: 15,
      animate: false,
    });
  }
  radice.dataset['pronta'] = '1';
}

export function avviaMappaPiccola(radice: HTMLElement): void {
  radice.querySelector<HTMLElement>('[data-senza-js]')?.setAttribute('hidden', '');
  radice.querySelector<HTMLElement>('[data-riquadro-mappa]')!.hidden = false;
  const avvia = () => void costruisci(radice);
  if (!('IntersectionObserver' in window)) return avvia();
  const osservatore = new IntersectionObserver(
    (voci) => {
      if (!voci.some((v) => v.isIntersecting)) return;
      osservatore.disconnect();
      avvia();
    },
    { rootMargin: '300px' },
  );
  osservatore.observe(radice);
}
