// Original name -> master name table of the photos (spec 7). `prepare-images.mjs` reads it; the
// masters are written to src/assets/foto/. Paths are relative to `materiali/3 - Sito Web/`.
// Names: `<subject>-<role>-<n>.jpg`, ASCII, lowercase, hyphens.

const OPERE = '5 - Archivio Sergiacomi/12 - Immagini Opere';
const MUSEO = '2 - Il Museo/Imagini - Museo - Sito Web';

/**
 * @typedef {object} Correzione
 * @property {number} [luminosita] brightness multiplier, 1 = unchanged
 *
 * @typedef {object} Foto
 * @property {string} originale path of the original, relative to `materiali/3 - Sito Web/`
 * @property {string} nuovo file name of the master
 * @property {Correzione} [correzione] light correction applied before saving
 */

/** @type {Foto[]} */
export const TABELLA = [
  // Le Merlettaie: 10 photos (spec 5.1: 9 in the phases, the portrait of the artist outside them)
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - Aldo Sergiacomi.jpg`,
    nuovo: 'le-merlettaie-ritratto-1.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - bambina - bozzetto.jpg`,
    nuovo: 'le-merlettaie-bozzetto-1.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - signora anziana - bozzetto.jpg`,
    nuovo: 'le-merlettaie-bozzetto-2.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - signora anziana - particolare bozzetto.jpg`,
    nuovo: 'le-merlettaie-bozzetto-3.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - signora anziana - fonderia.jpg`,
    nuovo: 'le-merlettaie-fonderia-1.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - bambina - particolare in loco.jpg`,
    nuovo: 'le-merlettaie-in-loco-1.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - donna - in loco.jpg`,
    nuovo: 'le-merlettaie-in-loco-2.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - donna - particolare in loco.jpg`,
    nuovo: 'le-merlettaie-in-loco-3.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - signora anziana - particolare in loco.jpg`,
    nuovo: 'le-merlettaie-in-loco-4.jpg',
  },
  {
    originale: `${OPERE}/1 - Le Merlettaie/Le Merlettaie - monumento.jpg`,
    nuovo: 'le-merlettaie-monumento-1.jpg',
  },
  // Loose file in the root of the folder: the whole group in a courtyard. A cover photo for the
  // home page, not one of the 10 photos of the phases.
  { originale: 'merlettaie1.jpeg', nuovo: 'le-merlettaie-copertina-1.jpg' },
  // Il sogno del pescatore: 5 photos
  {
    originale: `${OPERE}/5 - Il sogno del pescatore/Il sogno del pescatore - bozzetto in miniatura.jpg`,
    nuovo: 'sogno-del-pescatore-bozzetto-1.jpg',
  },
  {
    originale: `${OPERE}/5 - Il sogno del pescatore/Il sogno del pescatore - fonderia.jpg`,
    nuovo: 'sogno-del-pescatore-fonderia-1.jpg',
  },
  {
    originale: `${OPERE}/5 - Il sogno del pescatore/Il sogno del pescatore - fonderia - particolare donna e bambino.jpg`,
    nuovo: 'sogno-del-pescatore-fonderia-2.jpg',
  },
  {
    originale: `${OPERE}/5 - Il sogno del pescatore/Il sogno del pescatore - fonderia - particolare uomo.jpg`,
    nuovo: 'sogno-del-pescatore-fonderia-3.jpg',
  },
  {
    originale: `${OPERE}/5 - Il sogno del pescatore/Il sogno del pescatore - monumento.jpg`,
    nuovo: 'sogno-del-pescatore-monumento-1.jpg',
  },
  // La retara (the second photo is by a third party: Sgattoni archive)
  {
    originale: `${OPERE}/6 - La retara/La retara - bozzetto.jpg`,
    nuovo: 'la-retara-bozzetto-1.jpg',
  },
  {
    originale: `${OPERE}/6 - La retara/La retara - ispirazione archivio Sgattoni SbT.jpg`,
    nuovo: 'la-retara-ispirazione-1.jpg',
  },
  // Single-photo works
  {
    originale: `${OPERE}/4 - Beato Bernardo/Beato Bernardo - monumento.jpg`,
    nuovo: 'beato-bernardo-monumento-1.jpg',
  },
  {
    originale: `${OPERE}/7 - Monumento ai caduti Fermo/Monumento ai caduti Fermo - monumento.jpg`,
    nuovo: 'monumento-ai-caduti-fermo-monumento-1.jpg',
  },
  // Not in the list of the 25 works: Offida town hall coats of arms and the Palmucci tomb (PNG originals of 10-12 MB)
  {
    originale: `${OPERE}/2 - Stemmi Comune/Palazzo comunale Offida - stemma 1.jpg`,
    nuovo: 'stemmi-palazzo-comunale-1.jpg',
  },
  {
    originale: `${OPERE}/2 - Stemmi Comune/Palazzo comunale Offida - stemma 2.jpg`,
    nuovo: 'stemmi-palazzo-comunale-2.jpg',
  },
  {
    originale: `${OPERE}/12 - Cimitero Offida/Tomba Palmucci - Offida .png`,
    nuovo: 'tomba-palmucci-intera.jpg',
  },
  {
    originale: `${OPERE}/12 - Cimitero Offida/Tomba Palmucci - Particolare 1 - Offida.png`,
    nuovo: 'tomba-palmucci-particolare-1.jpg',
  },
  // Via crucis: five photos not attributed to any work (Offida 1952 or Teramo 1974, to be confirmed)
  { originale: `${OPERE}/3 - Via crucis/Via Crucis - I.jpg`, nuovo: 'via-crucis-1.jpg' },
  { originale: `${OPERE}/3 - Via crucis/Via Crucis - II.jpg`, nuovo: 'via-crucis-2.jpg' },
  { originale: `${OPERE}/3 - Via crucis/Via Crucis - III.jpg`, nuovo: 'via-crucis-3.jpg' },
  { originale: `${OPERE}/3 - Via crucis/Via Crucis - IV.jpg`, nuovo: 'via-crucis-4.jpg' },
  { originale: `${OPERE}/3 - Via crucis/Via Crucis - V.jpg`, nuovo: 'via-crucis-5.jpg' },
  // The museum: the table, its detail, the three tools (PNG originals), room 1 (dark, phone photo)
  { originale: `${MUSEO}/11- Tavolo Sergiacomi.jpeg`, nuovo: 'museo-tavolo-1.jpg' },
  { originale: `${MUSEO}/12 -Particolare tavolo.jpeg`, nuovo: 'museo-tavolo-particolare-1.jpg' },
  { originale: `${MUSEO}/Strumenti Sergiacomi 1 .png`, nuovo: 'strumenti-1.jpg' },
  { originale: `${MUSEO}/Strumenti Sergiacomi 2.png`, nuovo: 'strumenti-2.jpg' },
  { originale: `${MUSEO}/Strumenti Sergiacomi 3.png`, nuovo: 'strumenti-3.jpg' },
  {
    originale: `${MUSEO}/13 - SALA1.jpg`,
    nuovo: 'sala-1-vista-1.jpg',
    correzione: { luminosita: 1.3 },
  },
];

/** Originals that are not imported, with the reason. */
export const SCARTATE = [
  {
    originale: '0 - Bozze/Schizzo Homepage .jpg',
    motivo: 'drawing of the old proposal, not a photo',
  },
  { originale: '7 - Logo/Prova Logo.jpg', motivo: 'logo, not a photo: goes in the design brief' },
];
