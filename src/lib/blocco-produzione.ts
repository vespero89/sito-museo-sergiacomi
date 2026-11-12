// Astro integration: stops `astro build` in production while something is not confirmed (spec 3.5).
// It sits in the Astro config, so the block holds for any way of starting a production build, not
// only for `npm run build:production`.
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { apertiDelRepo, formattaAperti } from './aperti.ts';
import { decidiModalita } from './modalita.ts';

export function bloccoProduzione(): AstroIntegration {
  return {
    name: 'blocco-produzione',
    hooks: {
      'astro:config:setup': ({ command, config, logger }) => {
        if (command !== 'build') return;
        const modalita = decidiModalita(process.env);
        if (!modalita.bloccaAperti) {
          if (process.env.SITE_ENV === 'production') {
            logger.warn(
              'ALLOW_OPEN_ITEMS=1: this build is a preview (noindex, no sitemap, no llms.txt)',
            );
          }
          return;
        }
        const { aperti, problemi } = apertiDelRepo(fileURLToPath(config.root));
        if (aperti.length === 0 && problemi.length === 0) return;
        const elenco = [
          ...problemi.map((p) => `  ${p.file}\n    could not read: ${p.messaggio}`),
          formattaAperti(aperti),
        ]
          .filter(Boolean)
          .join('\n');
        throw new Error(
          `Production build stopped: ${aperti.length} open item(s) are not confirmed.\n${elenco}\n` +
            'Confirm them (see "npm run content:report"), or set ALLOW_OPEN_ITEMS=1 to build a private preview.',
        );
      },
    },
  };
}
