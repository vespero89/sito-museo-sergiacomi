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

export function creaReport(aperti: Aperto[]): string {
  if (aperti.length === 0) return 'Nothing to confirm: every entry is confirmed.\n';

  const righe = [`${aperti.length} open items\n`];
  for (const collezione of [...COLLEZIONI, 'sito'] as const) {
    const suoi = aperti.filter((a) => a.collezione === collezione);
    if (suoi.length === 0) continue;
    righe.push(`${collezione} (${suoi.length})`);
    for (const [causa, titolo] of CAUSE) {
      const gruppo = suoi.filter((a) => a.causa === causa);
      if (gruppo.length === 0) continue;
      righe.push(`  ${titolo} (${gruppo.length})`);
      for (const a of gruppo) righe.push(`    ${a.file}: ${a.dettaglio}`);
    }
    righe.push('');
  }
  return righe.join('\n');
}
