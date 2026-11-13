// Browser code of the archive filters (task 20). The rules are in src/lib/archivio.ts. Every card
// is in the HTML; here the ones that do not match get `hidden`, the count is announced and the
// state goes in the address (`?tipo=foto&decennio=1980&q=...`) without adding history entries.
import {
  decenniPresenti,
  leggiStato,
  passa,
  scriviStato,
  type VoceArchivio,
} from '../lib/archivio.ts';

interface Testi {
  una: string;
  piu: string;
  nessuna: string;
}

export function avviaFiltriArchivio(radice: HTMLElement): void {
  const testi = JSON.parse(radice.dataset.testi ?? '{}') as Testi;
  const tipo = radice.querySelector<HTMLSelectElement>('select[name="tipo"]')!;
  const decennio = radice.querySelector<HTMLSelectElement>('select[name="decennio"]')!;
  const q = radice.querySelector<HTMLInputElement>('input[name="q"]')!;
  const conteggio = radice.querySelector<HTMLElement>('[data-conteggio]')!;
  const schede = [...document.querySelectorAll<HTMLElement>('li[data-tipo]')];
  const gruppi = [...document.querySelectorAll<HTMLElement>('[data-gruppo]')];
  const voci: VoceArchivio[] = schede.map((li) => ({
    tipo: li.dataset.tipo ?? '',
    decennio: li.dataset.decennio ?? '',
    testo: li.dataset.testo ?? '',
  }));
  const tipi = [...tipo.options].map((o) => o.value).filter(Boolean);
  const decenni = decenniPresenti(voci);

  const aggiorna = (): void => {
    const stato = {
      tipo: tipo.value || undefined,
      decennio: decennio.value || undefined,
      q: q.value,
    };
    let visibili = 0;
    schede.forEach((li, i) => {
      const mostra = passa(voci[i]!, stato);
      li.hidden = !mostra;
      if (mostra) visibili += 1;
    });
    gruppi.forEach((g) => {
      g.hidden = ![...g.querySelectorAll('li[data-tipo]')].some(
        (li) => !(li as HTMLElement).hidden,
      );
    });
    conteggio.textContent =
      visibili === 0
        ? testi.nessuna
        : visibili === 1
          ? testi.una
          : testi.piu.replace('{n}', String(visibili));
    history.replaceState(null, '', `${location.pathname}${scriviStato(stato)}${location.hash}`);
  };

  const iniziale = leggiStato(location.search, tipi, decenni);
  tipo.value = iniziale.tipo ?? '';
  decennio.value = iniziale.decennio ?? '';
  q.value = iniziale.q;
  for (const campo of [tipo, decennio]) campo.addEventListener('change', aggiorna);
  q.addEventListener('input', aggiorna);
  radice.querySelector('[data-azzera]')!.addEventListener('click', () => {
    tipo.value = '';
    decennio.value = '';
    q.value = '';
    aggiorna();
    q.focus();
  });
  radice.hidden = false;
  aggiorna();
}
