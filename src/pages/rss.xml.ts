import type { APIRoute } from 'astro';
import { getPosts } from '../lib/posts';
import { site } from '../config';
const xml = (s: string) => s.replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;' }[c]!));
export const GET: APIRoute = async ({ site: origin }) => {
  const posts = await getPosts();
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(site.name)} · FIELDNOTES</title><link>${origin}</link><description>${xml(site.description)}</description><language>zh-CN</language><atom:link href="${new URL('/rss.xml', origin)}" rel="self" type="application/rss+xml"/>${posts.map(p=>{const url = new URL(`/posts/${p.id}/`,origin); return `<item><title>${xml(p.data.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${p.data.date.toUTCString()}</pubDate><description>${xml(p.data.description)}</description><category>${xml(p.data.category)}</category></item>`}).join('')}</channel></rss>`;
  return new Response(body,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
};
