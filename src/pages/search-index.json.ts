import type { APIRoute } from 'astro';
import { getPosts } from '../lib/posts';
export const GET: APIRoute = async () => new Response(JSON.stringify((await getPosts()).map(p => ({ id: p.id, url: `/posts/${p.id}/`, title: p.data.title, description: p.data.description, category: p.data.category, tags: p.data.tags, date: p.data.date.toISOString(), body: (p.body || '').replace(/[#*_>`]/g, '') }))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
