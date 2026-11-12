// `npm run content:report`: everything not confirmed yet, by collection and type (spec 3.5).
import { fileURLToPath } from 'node:url';
import { apertiDelRepo } from '../src/lib/aperti.ts';
import { creaReport } from '../src/lib/report.ts';

const radice = fileURLToPath(new URL('..', import.meta.url));
const { aperti, problemi } = apertiDelRepo(radice);

for (const { file, messaggio } of problemi) console.error(`could not read ${file}: ${messaggio}`);
console.log(creaReport(aperti));
