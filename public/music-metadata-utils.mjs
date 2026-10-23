import { Lrc } from './vendor/lrc-kit/lrc-kit.js';
// Small integration helpers; the actual LRC parser is pinned lrc-kit 1.2.1 (MIT).
export function parseLyrics(raw) {
  if (typeof raw !== 'string' || raw.length > 100000) throw new Error('歌词最多 100 KB。');
  const parsed = Lrc.parse(raw.replace(/^\uFEFF/, ''));
  const offset = Number(parsed.info.offset);
  return { lines: parsed.lyrics.filter((row) => Number.isFinite(row.timestamp) && row.timestamp >= 0).slice(0, 1500).map((row) => ({ time: row.timestamp, text: String(row.content).slice(0, 2000) })).sort((a, b) => a.time - b.time), fileOffset: Number.isFinite(offset) ? Math.max(-30000, Math.min(30000, offset)) : 0 };
}
// Positive delay means the lyric appears later; the LRC file's offset is honored.
export function activeLyric(lines, seconds, delayMs = 0, fileOffsetMs = 0) {
  const moment = (Number.isFinite(seconds) ? seconds : 0) - (delayMs + fileOffsetMs) / 1000;
  let low = 0, high = lines.length - 1, found = -1;
  while (low <= high) { const middle = (low + high) >> 1; if (lines[middle].time <= moment) { found = middle; low = middle + 1; } else high = middle - 1; }
  return found;
}
export function localTrackId(file) {
  return `file:${String(file.name).slice(0, 180)}:${Number(file.size) || 0}:${Number(file.lastModified) || 0}`;
}
export function validCover(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 800000) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && /^is[1-9]\d*-ssl\.mzstatic\.com$/.test(url.hostname) && !url.username && !url.password && !url.port ? url.href : ''; } catch { return ''; }
}
export function cleanMetadata(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean = {};
  for (const [id, value] of Object.entries(raw).slice(-64)) {
    if (!value || typeof value !== 'object' || id.length > 250 || ['__proto__', 'constructor', 'prototype'].includes(id)) continue;
    const cover = validCover(value.cover);
    let sourceUrl = '';
    try { const url = new URL(value.coverSourceUrl); if (url.protocol === 'https:' && url.hostname === 'music.apple.com' && !url.username && !url.password && !url.port) sourceUrl = url.href; } catch {}
    clean[id] = { cover: cover.startsWith('https:') && !sourceUrl ? '' : cover, coverSourceUrl: sourceUrl, coverCredit: typeof value.coverCredit === 'string' ? value.coverCredit.slice(0, 240) : '', lyrics: typeof value.lyrics === 'string' ? value.lyrics.slice(0, 100000) : '', lyricsCredit: typeof value.lyricsCredit === 'string' ? value.lyricsCredit.slice(0, 240) : '', instrumental: value.instrumental === true, delay: Number.isFinite(value.delay) ? Math.max(-10000, Math.min(10000, value.delay)) : 0 };
  }
  return clean;
}
