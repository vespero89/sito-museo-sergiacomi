// Browser code of the map of the works (spec 5.3, task 17). The first part is the reusable base
// (load Leaflet and the gesture plugin, make a map, our own zoom buttons, the markers): the maps on
// the work pages and on the itineraries (task 18) import `caricaLeaflet`, `creaMappa`,
// `controlloZoom` and `creaMarcatore`. The second part, `avviaMappaOpere`, wires the page of the works:
// slider, "Riproduci", filters, the address, "near me". The rules are in src/lib/mappa.ts.
import type * as Leaflet from 'leaflet';
import {
  conta,
  filtra,
  formattaKm,
  leggiStato,
  ordinaPerDistanza,
  raggruppaPerLuogo,
  scriviStato,
  type GruppoLuogo,
  type OperaMappa,
  type StatoMappa,
} from '../lib/mappa.ts';

type L = typeof Leaflet;

export interface TestiMappa {
  conteggio: string;
  una: string;
  piu: string;
  indicativa: string;
  nessuna: string;
  zoomPiu: string;
  zoomMeno: string;
  chiudi: string;
  vicinoNegato: string;
  vicinoNonDisponibile: string;
  vicinoScaduto: string;
  gestoTocco: string;
  gestoCtrl: string;
  gestoCmd: string;
  attribuzione: string;
  /** Label of a stop on an itinerary, with `{n}`. */
  tappa: string;
}

/**
 * Leaflet, then the gesture plugin, one after the other. The plugin reads `window.L` and is
 * imported by its package root (never `dist/`, which breaks inside a module).
 */
export async function caricaLeaflet(): Promise<L> {
  const modulo = await import('leaflet');
  const leaflet = ((modulo as unknown as { default?: L }).default ?? modulo) as L;
  const finestra = window as unknown as { L?: L };
  finestra.L ??= leaflet;
  await import('@raruto/leaflet-gesture-handling');
  return leaflet;
}

export const movimentoRidotto = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface OpzioniMappa {
  /** Address of the tiles, `{z}/{x}/{y}`. */
  tile: string;
  testi: TestiMappa;
  ridotto: boolean;
}

/** A map with tiles, the attribution, the gesture handling and our zoom buttons. */
export function creaMappa(L: L, contenitore: HTMLElement, { tile, testi, ridotto }: OpzioniMappa) {
  const mac = /mac/i.test(navigator.platform);
  const animazioni = !ridotto;
  // The plugin shows `text.scroll` as it is when the text is complete: we choose it for the platform.
  const opzioni = {
    zoomControl: false,
    attributionControl: false,
    zoomAnimation: animazioni,
    fadeAnimation: animazioni,
    markerZoomAnimation: animazioni,
    inertia: animazioni,
    gestureHandling: true,
    gestureHandlingOptions: {
      text: {
        touch: testi.gestoTocco,
        scroll: mac ? testi.gestoCmd : testi.gestoCtrl,
        scrollMac: testi.gestoCmd,
      },
      duration: 1700,
    },
  };
  const mappa = L.map(contenitore, opzioni);
  // Leaflet listens for Esc only when the map itself has the focus, not a marker inside it.
  contenitore.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') mappa.closePopup();
  });
  L.tileLayer(tile, { maxZoom: 18, crossOrigin: false }).addTo(mappa);
  L.control.attribution({ prefix: false }).addAttribution(testi.attribuzione).addTo(mappa);
  controlloZoom(L, testi).addTo(mappa);
  return mappa;
}

/** Zoom with two real buttons (Leaflet's own are links with a role). */
export function controlloZoom(L: L, testi: TestiMappa): Leaflet.Control {
  const Controllo = L.Control.extend({
    onAdd(mappa: Leaflet.Map) {
      const div = L.DomUtil.create('div', 'zoom-nostro');
      const pulsante = (testo: string, etichetta: string, azione: () => void) => {
        const b = L.DomUtil.create('button', '', div);
        b.type = 'button';
        b.textContent = testo;
        b.setAttribute('aria-label', etichetta);
        b.addEventListener('click', azione);
      };
      pulsante('+', testi.zoomPiu, () => mappa.zoomIn());
      pulsante('-', testi.zoomMeno, () => mappa.zoomOut());
      L.DomEvent.disableClickPropagation(div);
      return div;
    },
  });
  return new Controllo({ position: 'topleft' });
}

const quante = (testi: TestiMappa, n: number) =>
  n === 1 ? testi.una : testi.piu.replace('{n}', String(n));

/**
 * A marker for a place: a `divIcon` with the year (one work) or the number of works. It can be
 * focused, opens a popup with the links, and is named by `aria-label` (the visible text is only a number).
 */
export function creaMarcatore(L: L, gruppo: GruppoLuogo, testi: TestiMappa): Leaflet.Marker {
  const primo = gruppo.opere[0]!;
  const etichetta =
    gruppo.opere.length > 1 ? String(gruppo.opere.length) : String(primo.anno ?? '?');
  const nome = `${gruppo.luogoNome}, ${quante(testi, gruppo.opere.length)}`;
  const icona = L.divIcon({
    className: gruppo.indicativa ? 'marcatore indicativo' : 'marcatore',
    html: `<span aria-hidden="true">${etichetta}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
  const marcatore = L.marker([gruppo.lat, gruppo.lon], {
    icon: icona,
    title: nome,
    keyboard: true,
  });
  // The name starts with the visible text, so what is read matches what is seen.
  marcatore.on('add', () =>
    marcatore.getElement()?.setAttribute('aria-label', `${etichetta} ${nome}`),
  );
  marcatore.bindPopup(contenutoPopup(gruppo, testi));
  marcatore.on('popupopen', (e) => {
    const chiudi = (e.popup as unknown as { _closeButton?: HTMLElement })._closeButton;
    chiudi?.setAttribute('aria-label', testi.chiudi);
  });
  // Closing a popup with the keyboard leaves the focus on the marker, not on the page.
  marcatore.on('popupclose', (e) => {
    if (e.popup.getElement()?.contains(document.activeElement)) marcatore.getElement()?.focus();
  });
  return marcatore;
}

function contenutoPopup(gruppo: GruppoLuogo, testi: TestiMappa): HTMLElement {
  const radice = document.createElement('div');
  const titolo = document.createElement('h3');
  titolo.textContent = gruppo.luogoNome;
  const elenco = document.createElement('ul');
  for (const opera of gruppo.opere) {
    const voce = document.createElement('li');
    const link = document.createElement('a');
    link.href = opera.href;
    link.textContent = opera.titolo;
    voce.append(link, opera.anno ? ` (${opera.anno})` : '');
    elenco.append(voce);
  }
  radice.append(titolo, elenco);
  if (gruppo.indicativa) {
    const nota = document.createElement('p');
    nota.className = 'indicativa';
    nota.textContent = testi.indicativa;
    radice.append(nota);
  }
  return radice;
}

// ---------------------------------------------------------------------------------------------
// The page of the works.

function leggiOpere(): { opera: OperaMappa; elemento: HTMLElement }[] {
  return [...document.querySelectorAll<HTMLElement>('li[data-voce]')].map((elemento) => {
    const d = elemento.dataset;
    const anno = d['anno'] ? Number(d['anno']) : undefined;
    const opera: OperaMappa = {
      id: d['voce']!,
      titolo: d['titolo']!,
      href: d['href']!,
      anno,
      certa: d['certa'] === '1' && anno !== undefined,
      comune: d['comune']!,
      materiali: (d['materiali'] ?? '').split(' ').filter(Boolean),
      luogoId: d['luogo']!,
      luogoNome: d['luogoNome']!,
      indicativa: d['indicativa'] === '1',
      lat: Number(d['lat']),
      lon: Number(d['lon']),
    };
    return { opera, elemento };
  });
}

export async function avviaMappaOpere(radice: HTMLElement): Promise<void> {
  const testi = JSON.parse(radice.dataset['testi']!) as TestiMappa;
  const voci = leggiOpere();
  const opere = voci.map((v) => v.opera);
  const limiti = { min: Number(radice.dataset['min']), max: Number(radice.dataset['max']) };
  const ridotto = movimentoRidotto();
  const q = <T extends HTMLElement>(selettore: string) => radice.querySelector<T>(selettore)!;

  const cursore = q<HTMLInputElement>('input[type="range"]');
  const selezioneComune = q<HTMLSelectElement>('#mappa-comune');
  const selezioneMateriale = q<HTMLSelectElement>('#mappa-materiale');
  const conteggio = q('[data-conteggio]');
  const annuncio = q('[data-annuncio]');
  const riquadro = q('[data-riquadro]');
  const riproduci = q<HTMLButtonElement>('[data-riproduci]');
  const pausa = q<HTMLButtonElement>('[data-pausa]');

  const comuni = [...selezioneComune.options].map((o) => o.value).filter(Boolean);
  const materiali = [...selezioneMateriale.options].map((o) => o.value).filter(Boolean);
  const iniziale = leggiStato(location.search, limiti, comuni, materiali);
  cursore.value = String(iniziale.fino);
  selezioneComune.value = iniziale.comune ?? '';
  selezioneMateriale.value = iniziale.materiale ?? '';

  const leggiControlli = (): StatoMappa => ({
    fino: cursore.valueAsNumber,
    comune: selezioneComune.value || undefined,
    materiale: selezioneMateriale.value || undefined,
  });

  q('[data-senza-js]').hidden = true;
  q('[data-controlli]').hidden = false;
  riquadro.hidden = false;
  q('[data-vicino]').hidden = false;
  if (!ridotto) q('[data-riproduzione]').hidden = false;

  const L = await caricaLeaflet();
  const mappa = creaMappa(L, q('[data-mappa]'), {
    tile: radice.dataset['tile']!,
    testi,
    ridotto,
  });
  const strato = L.layerGroup().addTo(mappa);
  const tutti = raggruppaPerLuogo(opere);
  mappa.fitBounds(L.latLngBounds(tutti.map((g) => [g.lat, g.lon] as [number, number])), {
    padding: [24, 24],
    animate: false,
  });

  let posizione: { lat: number; lon: number } | undefined;
  let visibili: OperaMappa[] = opere;

  function testoConteggio(stato: StatoMappa): string {
    const { visibili: n, totale } = conta(opere, stato);
    return testi.conteggio
      .replace('{anno}', String(stato.fino))
      .replace('{n}', String(n))
      .replace('{tot}', String(totale));
  }

  function mostraVicine(): void {
    const risultato = q('[data-vicino-risultato]');
    if (!posizione) return;
    const prime = ordinaPerDistanza(visibili, posizione).slice(0, 5);
    const elenco = q('[data-vicino-elenco]');
    elenco.replaceChildren(
      ...prime.map((o) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = o.href;
        a.textContent = o.titolo;
        li.append(a, ` (${formattaKm(o.km)})`);
        return li;
      }),
    );
    risultato.hidden = prime.length === 0;
  }

  /** Apply the controls to the list, the markers, the count and the address. */
  function aggiorna(): void {
    const stato = leggiControlli();
    visibili = filtra(opere, stato);
    const ids = new Set(visibili.map((o) => o.id));
    for (const { opera, elemento } of voci) elemento.hidden = !ids.has(opera.id);
    document.querySelectorAll<HTMLElement>('[data-comune-sezione]').forEach((sezione) => {
      const n = sezione.querySelectorAll('li[data-voce]:not([hidden])').length;
      sezione.hidden = n === 0;
      const numero = sezione.querySelector('[data-numero]');
      if (numero) numero.textContent = quante(testi, n);
    });
    const nessuna = document.querySelector<HTMLElement>('[data-nessuna]');
    if (nessuna) nessuna.hidden = visibili.length > 0;

    strato.clearLayers();
    for (const gruppo of raggruppaPerLuogo(visibili)) {
      creaMarcatore(L, gruppo, testi).addTo(strato);
    }
    conteggio.textContent = testoConteggio(stato);
    mostraVicine();
    history.replaceState(
      null,
      '',
      `${location.pathname}${scriviStato(stato, limiti)}${location.hash}`,
    );
  }
  const annunciare = () => {
    annuncio.textContent = testoConteggio(leggiControlli());
  };

  // The slider updates on `input`; the screen reader hears the count on `change` only.
  cursore.addEventListener('input', aggiorna);
  cursore.addEventListener('change', annunciare);
  for (const selezione of [selezioneComune, selezioneMateriale]) {
    selezione.addEventListener('change', () => {
      aggiorna();
      annunciare();
      const gruppi = raggruppaPerLuogo(visibili);
      if (gruppi.length > 0) {
        mappa.fitBounds(L.latLngBounds(gruppi.map((g) => [g.lat, g.lon] as [number, number])), {
          padding: [40, 40],
          maxZoom: 13,
          animate: !ridotto,
        });
      }
    });
  }

  // "Riproduci": one year at a time, with "Pausa" next to it; never starts alone.
  let timer: number | undefined;
  function ferma(): void {
    if (timer === undefined) return;
    window.clearInterval(timer);
    timer = undefined;
    const sulPulsante = document.activeElement === pausa;
    riproduci.disabled = false;
    pausa.disabled = true;
    if (sulPulsante) riproduci.focus();
    annunciare();
  }
  riproduci.addEventListener('click', () => {
    if (cursore.valueAsNumber >= limiti.max) cursore.value = String(limiti.min);
    aggiorna();
    riproduci.disabled = true;
    pausa.disabled = false;
    pausa.focus();
    timer = window.setInterval(() => {
      if (cursore.valueAsNumber >= limiti.max) return ferma();
      cursore.value = String(cursore.valueAsNumber + 1);
      aggiorna();
      if (cursore.valueAsNumber >= limiti.max) ferma();
    }, 700);
  });
  pausa.addEventListener('click', ferma);

  // "Near me": the position is asked only on click, used here and never stored or sent.
  const messaggio = q('[data-vicino-messaggio]');
  q('[data-vicino-pulsante]').addEventListener('click', () => {
    messaggio.textContent = '';
    if (!('geolocation' in navigator)) {
      messaggio.textContent = testi.vicinoNonDisponibile;
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        posizione = { lat: coords.latitude, lon: coords.longitude };
        mostraVicine();
      },
      (errore) => {
        messaggio.textContent =
          errore.code === errore.PERMISSION_DENIED
            ? testi.vicinoNegato
            : errore.code === errore.TIMEOUT
              ? testi.vicinoScaduto
              : testi.vicinoNonDisponibile;
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  });

  aggiorna();
  radice.dataset['pronta'] = '1';
}
