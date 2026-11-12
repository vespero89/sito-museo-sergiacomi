// `npm run content:check`: schemas, references between collections and sito.yaml (spec 3.1, 8-A).
// Exits with 1 and lists every problem when something is wrong.
import { fileURLToPath } from 'node:url';
import { controllaRepo } from '../src/lib/controllo-contenuti.ts';

const radice = fileURLToPath(new URL('..', import.meta.url));
const { problemi, voci } = controllaRepo(radice);

if (problemi.length > 0) {
  console.error(`content:check: ${problemi.length} problem(s)\n`);
  for (const { file, messaggio } of problemi) console.error(`  ${file}\n    ${messaggio}`);
  process.exit(1);
}
console.log(`content:check: ${voci} entries and sito.yaml are valid`);
