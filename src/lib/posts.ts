import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
export function dateLabel(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(date).replaceAll('/', '.');
}
export function readingTime(body = '') {
  return Math.max(1, Math.ceil(body.replace(/```[\s\S]*?```/g, '').length / 350));
}
export const categories = ['生活随笔', '设计与创造', '技术笔记', '阅读记录'];
