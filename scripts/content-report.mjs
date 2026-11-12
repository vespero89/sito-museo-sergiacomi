// `npm run content:report`: everything not confirmed yet, by collection and type (spec 3.5).
import { fileURLToPath } from 'node:url';
import { apertiDelRepo } from '../src/lib/aperti.ts';
import { leggiContenuti } from '../src/lib/controllo-contenuti.ts';
import { SOGLIA_PAROLE_SCHEDA, schedeConPocoTesto } from '../src/lib/relazioni.ts';
import { creaReport } from '../src/lib/report.ts';

const radice = fileURLToPath(new URL('..', import.meta.url));
const { aperti, problemi } = apertiDelRepo(radice);

for (const { file, messaggio } of problemi) console.error(`could not read ${file}: ${messaggio}`);
console.log(creaReport(aperti));

// Work pages with little written text: they stay published, the Foundation can write more (spec 3.6).
const opere = leggiContenuti(radice, []).opere.map((o) => ({ id: o.id, corpo: o.corpo }));
const brevi = schedeConPocoTesto(opere);
console.log(
  `\nWork pages with fewer than ${SOGLIA_PAROLE_SCHEDA} written words (${brevi.length} of ${opere.length})`,
);
for (const id of brevi) console.log(`    ${id}`);
