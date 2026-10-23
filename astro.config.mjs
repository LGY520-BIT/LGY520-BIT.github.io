import { defineConfig } from 'astro/config';
const repo = process.env.GITHUB_REPOSITORY || '';
const [owner, name] = repo.split('/');
const site = process.env.SITE_URL || (owner ? `https://${owner}.github.io` : 'https://example.invalid');
const base = process.env.BASE_PATH || (name && name.toLowerCase() !== `${owner}.github.io`.toLowerCase() ? `/${name}/` : '/');
export default defineConfig({site, base, output:'static', trailingSlash:'always', devToolbar:{enabled:false}, markdown:{shikiConfig:{theme:'github-dark'}}});
