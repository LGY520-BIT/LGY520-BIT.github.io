import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://lgy520-bit.github.io', output: 'static', trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: { shikiConfig: { theme: 'github-dark' } }
});
