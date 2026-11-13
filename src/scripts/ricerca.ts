// Browser code of the search page (task 20). Pagefind builds its index after the build, in
// /pagefind/ on the same domain; its JavaScript is loaded from there when the page opens, so the
// page works with the Content Security Policy (script-src 'self' 'wasm-unsafe-eval'). The results
// are a list of links; the excerpt is built from text nodes and <mark>, never from innerHTML.

interface Testi {
  nonDisponibile: string;
  caricamento: string;
  una: string;
  piu: string;
  nessuno: string;
}

interface DatiRisultato {
  url: string;
  excerpt: string;
  meta: { title?: string };
}

interface Pagefind {
  init(): Promise<void>;
  search(q: string): Promise<{ results: { data(): Promise<DatiRisultato> }[] }>;
}

const MASSIMO = 20;

/** The excerpt of Pagefind (text with <mark>) as DOM nodes, with nothing else allowed. */
function estratto(html: string): HTMLParagraphElement {
  const p = document.createElement('p');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.body.childNodes.forEach((nodo) => {
    if (nodo.nodeName === 'MARK') {
      const mark = document.createElement('mark');
      mark.textContent = nodo.textContent;
      p.append(mark);
    } else {
      p.append(document.createTextNode(nodo.textContent ?? ''));
    }
  });
  return p;
}

export function avviaRicerca(radice: HTMLElement): void {
  const testi = JSON.parse(radice.dataset.testi ?? '{}') as Testi;
  const modulo = radice.querySelector<HTMLFormElement>('[data-modulo]')!;
  const campo = modulo.querySelector<HTMLInputElement>('input')!;
  const stato = radice.querySelector<HTMLElement>('[data-stato]')!;
  const elenco = radice.querySelector<HTMLElement>('[data-risultati]')!;
  const sezioni = radice.querySelector<HTMLElement>('[data-sezioni]')!;
  let pagefind: Pagefind | undefined;
  let giro = 0;

  const carica = async (): Promise<Pagefind | undefined> => {
    if (pagefind) return pagefind;
    try {
      const indirizzo = '/pagefind/pagefind.js';
      pagefind = (await import(/* @vite-ignore */ indirizzo)) as Pagefind;
      await pagefind.init();
      return pagefind;
    } catch {
      return undefined;
    }
  };

  const cerca = async (testo: string): Promise<void> => {
    const mio = ++giro;
    elenco.replaceChildren();
    const q = testo.trim();
    history.replaceState(null, '', `${location.pathname}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (!q) {
      stato.textContent = '';
      sezioni.hidden = false;
      return;
    }
    stato.textContent = testi.caricamento;
    const pf = await carica();
    if (mio !== giro) return;
    if (!pf) {
      stato.textContent = testi.nonDisponibile;
      sezioni.hidden = false;
      return;
    }
    const trovati = await pf.search(q);
    const dati = await Promise.all(trovati.results.slice(0, MASSIMO).map((r) => r.data()));
    if (mio !== giro) return;
    const totale = trovati.results.length;
    const frase = totale === 0 ? testi.nessuno : totale === 1 ? testi.una : testi.piu;
    stato.textContent = frase.replace('{n}', String(totale)).replace('{q}', q);
    sezioni.hidden = totale > 0;
    for (const d of dati) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = d.url;
      a.textContent = d.meta.title ?? d.url;
      li.append(a, estratto(d.excerpt));
      elenco.append(li);
    }
  };

  radice.querySelector('[data-senza-js]')!.remove();
  modulo.hidden = false;
  modulo.addEventListener('submit', (e) => {
    e.preventDefault();
    void cerca(campo.value);
  });
  const iniziale = new URLSearchParams(location.search).get('q') ?? '';
  campo.value = iniziale;
  if (iniziale.trim()) void cerca(iniziale);
}
