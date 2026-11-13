import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import DaConfermare from '../../src/components/DaConfermare.astro';

async function etichetta(props: Record<string, unknown>): Promise<string> {
  const html = await (await AstroContainer.create()).renderToString(DaConfermare, { props });
  return parseHTML(html).document.querySelector('.da-confermare')!.textContent!.trim();
}

describe('DaConfermare', () => {
  it('shows the reason of the doubt', async () => {
    expect(await etichetta({ motivo: 'Sul vecchio sito 1923' })).toBe(
      'Da confermare: Sul vecchio sito 1923',
    );
  });

  it('shows a plain label when there is no reason', async () => {
    expect(await etichetta({})).toBe('Da confermare');
  });

  it('shows the generated-text label for a placeholder', async () => {
    expect(await etichetta({ tipo: 'segnaposto' })).toBe('Testo generato, da approvare');
  });
});
