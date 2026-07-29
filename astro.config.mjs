import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hdpnb.github.io',
  base: '/',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
  vite: {
    build: {
      // CloudBase SDK is loaded as a separate browser-only chunk when interactions are enabled.
      chunkSizeWarningLimit: 800,
    },
  },
  build: {
    format: 'directory',
  },
});
