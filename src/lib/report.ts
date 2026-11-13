// Text of `npm run content:report` (spec 3.5): what is not confirmed yet, grouped by collection
// and by type. The working tool with the content team: confirm an entry, run it again, the report
// gets shorter.
import type { Aperto, Causa } from './aperti.ts';
import { COLLEZIONI } from './schemi.ts';

const CAUSE: [Causa, string][] = [
  ['dubbio', 'dubbi'],
  ['marcatore', 'marcatori [[...]]'],
  ['da-confermare', 'da confermare'],
  ['segnaposto', 'segnaposto'],
  ['coordinate', 'coordinate'],
  ['alt', 'alt'],
];

function gruppo(titolo: string, aperti: Aperto[], righe: string[]): void {
  righe.push(`${titolo} (${aperti.length})`);
  for (const collezione of [...COLLEZIONI, 'sito'] as const) {
    const suoi = aperti.filter((a) => a.collezione === collezione);
    if (suoi.length === 0) continue;
    righe.push(`${collezione} (${suoi.length})`);
    for (const [causa, nome] of CAUSE) {
      const perCausa = suoi.filter((a) => a.causa === causa);
      if (perCausa.length === 0) continue;
      righe.push(`  ${nome} (${perCausa.length})`);
      for (const a of perCausa) righe.push(`    ${a.file}: ${a.dettaglio}`);
    }
    righe.push('');
  }
}

export function creaReport(aperti: Aperto[]): string {
  if (aperti.length === 0) return 'Nothing to confirm: every entry is confirmed.\n';

  const bloccanti = aperti.filter((a) => a.bloccante);
  const altri = aperti.filter((a) => !a.bloccante);
  const righe = [
    `${aperti.length} open items: ${bloccanti.length} blocking, ${altri.length} not blocking\n`,
  ];
  if (bloccanti.length === 0) {
    righe.push('Nothing blocks the production build.\n');
  } else {
    const generati = bloccanti.filter((a) => a.causa === 'segnaposto').length;
    gruppo('BLOCKING', bloccanti, righe);
    righe.push(`of which generated text still to approve (segnaposto): ${generati}\n`);
  }
  if (altri.length > 0) gruppo('NOT BLOCKING', altri, righe);
  return righe.join('\n');
}
