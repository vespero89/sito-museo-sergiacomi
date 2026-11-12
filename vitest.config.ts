/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// getViteConfig lets the tests import .astro components (rendered with the container API).
export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
