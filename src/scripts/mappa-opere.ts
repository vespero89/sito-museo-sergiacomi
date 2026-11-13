// Browser code of the map of the works (spec 5.3, task 17). The first part is the reusable base
// (load Leaflet, make a map, our own zoom buttons, the markers): the maps on
// the work pages and on the itineraries (task 18) import `caricaLeaflet`, `creaMappa`,
// `controlloZoom` and `creaMarcatore`. The second part, `avviaMappaOpere`, wires the page of the works:
// slider, "Riproduci", filters, the address, "near me". The rules are in src/lib/mappa.ts.
import type * as Leaflet from 'leaflet';
import { gestiMappa } from './mappa-gesti.ts';
import {
  DURATA_FERMATA,
  conta,
  decennioDi,
  fermate,
  filtra,
  formattaKm,
  leggiStato,
  ordinaPerDistanza,
  ordinaTabella,
  prossimaFermata,
  raggruppaPerDecennio,
  raggruppaPerLuogo,
  scriviStato,
  testoMateriali,
  type Colonna,
  type Direzione,
  type Fermata,
  type GruppoLuogo,
  type OperaMappa,
  type StatoMappa,
  type Vista,
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
  /** The work has no certain year (the table and the decade view). */
  annoNonIndicato: string;
  /** The work has no material (the table). */
  nonIndicato: string;
  /** The note of a long jump of the animation, with `{n}` years. */
  saltoAnni: string;
}

/** Leaflet, loaded when a map is needed. */
export async function caricaLeaflet(): Promise<L> {
  const modulo = await import('leaflet');
  const leaflet = ((modulo as unknown as { default?: L }).default ?? modulo) as L;
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

/** A map with tiles, the attribution, our gestures and our zoom buttons. */
export function creaMappa(L: L, contenitore: HTMLElement, { tile, testi, ridotto }: OpzioniMappa) {
  const mac = /mac/i.test(navigator.platform);
  const animazioni = !ridotto;
  const opzioni = {
    zoomControl: false,
    attributionControl: false,
    zoomAnimation: animazioni,
    fadeAnimation: animazioni,
    markerZoomAnimation: animazioni,
    inertia: animazioni,
  };
  const mappa = L.map(contenitore, opzioni);
  gestiMappa(mappa, contenitore, testi, mac);
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

/** The icon of a single work: a pin, drawn here so that no image file is asked for. */
const ICONA_OPERA =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>';

/**
 * A marker for a place: a `divIcon` with the number of works (a cluster) or an icon (one work; its
 * year is in the popup). It can be focused, opens a popup with the links, and is named by `aria-label`.
 */
export function creaMarcatore(L: L, gruppo: GruppoLuogo, testi: TestiMappa): Leaflet.Marker {
  const numero = gruppo.opere.length > 1 ? String(gruppo.opere.length) : '';
  const nome = `${gruppo.luogoNome}, ${quante(testi, gruppo.opere.length)}`;
  const icona = L.divIcon({
    className: gruppo.indicativa ? 'marcatore indicativo' : 'marcatore',
    html: numero ? `<span aria-hidden="true">${numero}</span>` : ICONA_OPERA,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
  const marcatore = L.marker([gruppo.lat, gruppo.lon], {
    icon: icona,
    title: nome,
    keyboard: true,
  });
  // The name starts with the visible text (the number), so what is read matches what is seen.
  marcatore.on('add', () =>
    marcatore.getElement()?.setAttribute('aria-label', numero ? `${numero} ${nome}` : nome),
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
      comuneNome: d['comuneNome']!,
      categoria: d['categoria']!,
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

  let vista: Vista = iniziale.vista;
  const leggiControlli = (): StatoMappa => ({
    fino: cursore.valueAsNumber,
    comune: selezioneComune.value || undefined,
    materiale: selezioneMateriale.value || undefined,
    vista,
  });

  q('[data-senza-js]').hidden = true;
  q('[data-controlli]').hidden = false;
  q('[data-filtri-luogo]').hidden = false;
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

  // The views of the list. The cards are the same elements: the view by decade moves them into its
  // groups, the others put them back under their town. The table is built from the visible works.
  const pannelli = [...document.querySelectorAll<HTMLElement>('[data-vista]')];
  const scelte = [...document.querySelectorAll<HTMLButtonElement>('[data-vista-scelta]')];
  const sotto = new Map(voci.map((v) => [v.opera.id, v.elemento.parentElement!]));
  const elementi = new Map(voci.map((v) => [v.opera.id, v.elemento]));
  const listaDecennio = new Map(
    [...document.querySelectorAll<HTMLElement>('[data-decennio-sezione]')].map((e) => [
      e.dataset['decennioSezione']!,
      e.querySelector('ul')!,
    ]),
  );
  const corpo = document.querySelector<HTMLElement>('[data-vista="tabella"] tbody')!;
  const intestazioni = [...document.querySelectorAll<HTMLElement>('[data-colonna]')];
  let ordine: { colonna: Colonna; direzione: Direzione } = { colonna: 'anno', direzione: 'asc' };

  function montaCarte(): void {
    if (vista === 'anno') {
      for (const gruppo of raggruppaPerDecennio(opere)) {
        const lista = listaDecennio.get(String(decennioDi(gruppo.opere[0]!) ?? 'senza'))!;
        lista.append(...gruppo.opere.map((o) => elementi.get(o.id)!));
      }
    } else {
      for (const { opera, elemento } of voci) sotto.get(opera.id)!.append(elemento);
    }
  }

  function disegnaTabella(): void {
    for (const th of intestazioni) {
      const attiva = th.dataset['colonna'] === ordine.colonna;
      if (attiva)
        th.setAttribute('aria-sort', ordine.direzione === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    }
    corpo.replaceChildren(
      ...ordinaTabella(visibili, ordine.colonna, ordine.direzione).map((o) => {
        const riga = document.createElement('tr');
        const titolo = document.createElement('td');
        const link = document.createElement('a');
        link.href = o.href;
        link.textContent = o.titolo;
        titolo.append(link);
        const celle = [
          o.certa && o.anno !== undefined ? String(o.anno) : testi.annoNonIndicato,
          o.comuneNome,
          o.categoria,
          testoMateriali(o) || testi.nonIndicato,
        ].map((testo) => {
          const cella = document.createElement('td');
          cella.textContent = testo;
          return cella;
        });
        riga.append(titolo, ...celle);
        return riga;
      }),
    );
  }

  function mostraVista(): void {
    for (const p of pannelli) p.hidden = p.dataset['vista'] !== vista;
    for (const b of scelte)
      b.setAttribute('aria-pressed', String(b.dataset['vistaScelta'] === vista));
    montaCarte();
  }

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
    document
      .querySelectorAll<HTMLElement>('[data-comune-sezione], [data-decennio-sezione]')
      .forEach((sezione) => {
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
    if (vista === 'tabella') disegnaTabella();
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
  cursore.addEventListener('input', () => {
    nota.hidden = true;
    aggiorna();
  });
  document.querySelector<HTMLElement>('[data-viste]')!.hidden = false;
  for (const scelta of scelte) {
    scelta.addEventListener('click', () => {
      vista = scelta.dataset['vistaScelta'] as Vista;
      mostraVista();
      aggiorna();
    });
  }
  for (const th of intestazioni) {
    th.querySelector('button')!.addEventListener('click', () => {
      const colonna = th.dataset['colonna'] as Colonna;
      ordine = {
        colonna,
        direzione: ordine.colonna === colonna && ordine.direzione === 'asc' ? 'desc' : 'asc',
      };
      disegnaTabella();
    });
  }
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

  // "Riproduci": it stops only on the years with new works (`fermate`), with "Pausa" next to it;
  // it never starts alone. A long jump shows a note ("17 anni dopo"). Dragging stays year by year.
  const piano = fermate(opere);
  const nota = q('[data-nota-salto]');
  let timer: number | undefined;
  let inCorso = false;
  function ferma(): void {
    if (!inCorso) return;
    window.clearTimeout(timer);
    inCorso = false;
    nota.hidden = true;
    const sulPulsante = document.activeElement === pausa;
    riproduci.disabled = false;
    pausa.disabled = true;
    if (sulPulsante) riproduci.focus();
    annunciare();
  }
  function mostraNota(fermata: Fermata): void {
    nota.hidden = fermata.salto === undefined;
    if (fermata.salto !== undefined) {
      nota.textContent = testi.saltoAnni.replace('{n}', String(fermata.salto));
    }
  }
  function avanza(): void {
    const fermata = prossimaFermata(piano, cursore.valueAsNumber);
    if (!fermata) return ferma();
    cursore.value = String(fermata.anno);
    aggiorna();
    mostraNota(fermata);
    if (!prossimaFermata(piano, fermata.anno)) return ferma();
    timer = window.setTimeout(avanza, fermata.durata);
  }
  riproduci.addEventListener('click', () => {
    if (cursore.valueAsNumber >= limiti.max) cursore.value = String(limiti.min);
    aggiorna();
    inCorso = true;
    riproduci.disabled = true;
    pausa.disabled = false;
    pausa.focus();
    const qui = piano.find((f) => f.anno === cursore.valueAsNumber);
    timer = window.setTimeout(avanza, qui?.durata ?? DURATA_FERMATA);
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

  mostraVista();
  aggiorna();
  radice.dataset['pronta'] = '1';
}
