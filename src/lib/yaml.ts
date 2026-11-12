// YAML reading with the same options Astro uses for content files, so that `content:check` sees
// exactly what the build sees (for example an unquoted 2012-07-27 becomes a Date, not text).
import { parseDocument } from 'yaml';

export function parseYaml(sorgente: string): unknown {
  const documento = parseDocument(sorgente, {
    customTags: ['timestamp'],
    merge: true,
    schema: 'core',
  });
  const errore = documento.errors[0];
  if (errore) throw errore;
  return documento.contents === null ? undefined : documento.toJS();
}
