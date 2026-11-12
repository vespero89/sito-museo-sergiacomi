// Reads src/data/sito.yaml for the components (Vite does not import YAML). Same parser and schema
// as `content:check`, so a page never sees data that the check would have refused.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sitoSchema, type Sito } from './sito.ts';
import { parseYaml } from './yaml.ts';

let cache: Sito | undefined;

/** The data of the museum and the Foundation. The build runs from the project root. */
export function leggiSito(): Sito {
  cache ??= sitoSchema.parse(
    parseYaml(readFileSync(join(process.cwd(), 'src', 'data', 'sito.yaml'), 'utf8')),
  );
  return cache;
}
