import type { APIRoute } from 'astro';
import { getPosts } from '../lib/posts';
export const GET: APIRoute = async ({ site }) => {
  const urls = ['/', '/archive/', '/anime/', '/music/', '/dreamscape/', '/space/', '/links/', '/about/', '/projects/', '/gallery/', '/credits/', ...(await getPosts()).map(p=>`/posts/${p.id}/`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${new URL(url, site)}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
