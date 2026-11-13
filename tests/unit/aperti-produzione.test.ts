// The components of the open items in production: they write nothing (spec 3.5). The environment is
// read when the component renders, so the test sets it for each case.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DaConfermare from '../../src/components/DaConfermare.astro';
import DatoSito from '../../src/components/DatoSito.astro';
import Dubbi from '../../src/components/Dubbi.astro';

async function html(componente: Parameters<AstroContainer['renderToString']>[0], props = {}) {
  return (await (await AstroContainer.create()).renderToString(componente, { props })).trim();
}

afterEach(() => vi.unstubAllEnvs());

describe('in production', () => {
  const produzione = () => vi.stubEnv('SITE_ENV', 'production');

  it('DaConfermare writes nothing, for a doubt and for generated text', async () => {
    produzione();
    expect(await html(DaConfermare, { motivo: 'anno' })).toBe('');
    expect(await html(DaConfermare, { tipo: 'segnaposto' })).toBe('');
  });

  it('Dubbi writes nothing for an entry that is not confirmed, with its doubts', async () => {
    produzione();
    const dubbi = [{ campo: 'anno', nota: 'forse 1923' }];
    expect(await html(Dubbi, { stato: 'da-confermare', dubbi })).toBe('');
    expect(await html(Dubbi, { stato: 'segnaposto', dubbi })).toBe('');
  });

  it('DatoSito writes nothing for a doubtful field (the phone of the real sito.yaml)', async () => {
    produzione();
    expect(await html(DatoSito, { percorso: 'contatti.telefono' })).toBe('');
  });

  it('DatoSito still writes a confirmed value', async () => {
    produzione();
    expect(await html(DatoSito, { percorso: 'nome' })).toBe('Museo Aldo Sergiacomi');
  });
});

describe('in a preview', () => {
  it('Dubbi and DaConfermare show the labels as before', async () => {
    const dubbi = [{ campo: 'anno', nota: 'forse 1923' }];
    const testo = await html(Dubbi, { stato: 'segnaposto', dubbi });
    expect(testo).toContain('Testo generato, da approvare');
    expect(testo).toContain('Da confermare: forse 1923');
  });

  it('DatoSito shows the label of a doubtful field', async () => {
    expect(await html(DatoSito, { percorso: 'contatti.telefono' })).toContain('Da confermare');
  });

  it('ALLOW_OPEN_ITEMS=1 in production is a preview: the labels stay', async () => {
    vi.stubEnv('SITE_ENV', 'production');
    vi.stubEnv('ALLOW_OPEN_ITEMS', '1');
    expect(await html(DaConfermare, { motivo: 'anno' })).toContain('Da confermare: anno');
  });
});
