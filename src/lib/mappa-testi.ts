// The texts every map gets (the map of the works, the small maps on the work pages and itineraries):
// the shape is `TestiMappa` in src/scripts/mappa-opere.ts. Read on the page, passed as a data-attribute.
import { t } from '../i18n/index.ts';
import type { TileMappa } from '../data/servizi.ts';

export function testiMappa(tile: TileMappa) {
  return {
    conteggio: t('mappa.conteggio'),
    una: t('opere.una'),
    piu: t('opere.piu'),
    indicativa: t('mappa.indicativa'),
    nessuna: t('mappa.nessuna'),
    zoomPiu: t('mappa.zoomPiu'),
    zoomMeno: t('mappa.zoomMeno'),
    chiudi: t('mappa.chiudi'),
    vicinoNegato: t('mappa.vicinoNegato'),
    vicinoNonDisponibile: t('mappa.vicinoNonDisponibile'),
    vicinoScaduto: t('mappa.vicinoScaduto'),
    gestoTocco: t('mappa.gestoTocco'),
    gestoCtrl: t('mappa.gestoCtrl'),
    gestoCmd: t('mappa.gestoCmd'),
    attribuzione: `<a href="${tile.attribuzioneUrl}">${tile.attribuzione}</a>`,
    tappa: t('mappa.tappa'),
    annoNonIndicato: t('mappa.annoNonIndicato'),
    nonIndicato: t('mappa.nonIndicato'),
    saltoAnni: t('mappa.saltoAnni'),
  };
}
