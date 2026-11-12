// Minimal valid entries, one per collection, shared by the content tests.
// Tests copy one and break a single field.

export const OPERA = {
  titolo: 'Il portale del Duomo',
  categoria: 'portale',
  anno: 1980,
  nellElenco: true,
  materiali: ['bronzo'],
  luogo: 'duomo-di-fermo',
  stato: 'confermato',
};

export const LUOGO = {
  nome: 'Duomo di Fermo',
  comune: 'Fermo',
  provincia: 'FM',
  regione: 'Marche',
  lat: 43.1596,
  lon: 13.7194,
  precisione: 'punto',
  verificato: false,
  stato: 'da-confermare',
};

export const ITINERARIO = {
  titolo: 'I portali del Sergiacomi',
  modo: 'auto',
  tappe: [
    { tipo: 'opera', id: 'il-portale-del-duomo' },
    { tipo: 'luogo', id: 'duomo-di-fermo', gruppo: 'Marche' },
  ],
  stato: 'segnaposto',
};

export const SALA = { numero: 1, nome: 'La bottega', stato: 'da-confermare' };

export const ARCHIVIO = {
  titolo: 'Pergamena di ricordo',
  tipo: 'documento',
  data: '1994-08',
  descrizione: 'Pergamena donata alla famiglia dalla comunità.',
  origine: 'fondazione',
  stato: 'segnaposto',
};

export const EVENTO = {
  titolo: 'Centenario della nascita',
  tipo: 'evento',
  data: '2012-07-27',
  stato: 'da-confermare',
};

export const DIDATTICA = {
  titolo: 'La storia di Romualdo',
  tipo: 'progetto-svolto',
  stato: 'da-confermare',
};

export const BIOGRAFIA = {
  anno: 1912,
  tipo: 'vita',
  titolo: 'Nascita a Offida',
  stato: 'da-confermare',
};

export const STRUMENTO = { nome: 'Raspa', immagine: 'raspa', stato: 'segnaposto' };

export const PUBBLICAZIONE = { titolo: 'Titolo da definire', stato: 'segnaposto' };

export const PERCORSO = {
  titolo: 'Con la scuola',
  intro: 'Visite e laboratori per le classi.',
  voci: [
    { titolo: 'Didattica', descrizione: 'Le proposte per le scuole.', percorso: '/didattica/' },
  ],
  stato: 'segnaposto',
};

export const PAGINA = {
  titolo: 'Chi siamo',
  descrizione: 'La Fondazione e il suo legame con lo scultore Aldo Sergiacomi.',
  slug: 'chi-siamo',
  stato: 'da-confermare',
};

export const IMMAGINE = {
  id: 'le-merlettaie-bozzetto-1',
  file: 'le-merlettaie-bozzetto-1.jpg',
  alt: 'Bozzetto in gesso della bambina delle Merlettaie, ripreso di tre quarti',
  origine: 'fondazione',
  altVerificato: false,
  stato: 'da-confermare',
};

/** A copy of `dati` without one field. */
export function senza<T extends object, K extends keyof T>(dati: T, chiave: K): Omit<T, K> {
  const copia = { ...dati };
  delete copia[chiave];
  return copia;
}
