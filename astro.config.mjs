import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import swManifest from './integrations/sw-manifest.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [preact(), swManifest()],
});
