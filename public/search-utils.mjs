/* Pure, bounded helpers for the public article index. No DOM, storage or network. */
const MAX_QUERY = 120;
const MAX_RECORDS = 2000;
const safePostPath = value => typeof value === 'string' && /^\/posts\/[a-z0-9][a-z0-9-]{0,100}\/$/.test(value);
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit).trim() : '';
const normalized = value => value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/gu, ' ').trim();
const cut = (value, limit) => {
  let result = value.slice(0, limit);
  if (/[\uD800-\uDBFF]$/.test(result)) result = result.slice(0, -1);
  return result;
};

export function normalizeQuery(value) {
  return typeof value === 'string' ? cut(normalized(value), MAX_QUERY).trim() : '';
}

// The 120-character query limit already bounds the token count; never silently
// drop later terms, because every visible term participates in AND matching.
const termsFor = value => normalizeQuery(value).split(' ').filter(Boolean).map(word => ({
  tag: word.startsWith('#'), word: word.startsWith('#') ? word.slice(1) : word,
})).filter(term => term.word);

function dateValue(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const result = new Date(time).toISOString();
  return result.slice(0, 10) === value.slice(0, 10) ? { date: result, time } : null;
}

export function prepareIndex(raw) {
  if (!Array.isArray(raw)) throw new TypeError('Public search index must be an array.');
  const seen = new Set(), output = [];
  for (const record of raw.slice(0, MAX_RECORDS)) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || record.draft === true ||
        !safePostPath(record.url) || seen.has(record.url)) continue;
    const title = text(record.title, 200);
    if (!title) continue;
    const description = text(record.description, 800), category = text(record.category, 60), body = text(record.body, 100000);
    const tags = Array.isArray(record.tags) ? [...new Set(record.tags.slice(0, 30).map(value => text(value, 60)).filter(Boolean))].slice(0, 20) : [];
    const date = dateValue(record.date);
    const entry = { url: record.url, title, description, category, tags, body, date: date?.date || '',
      _order: output.length, _time: date?.time ?? -Infinity,
      _search: { title: normalized(title), description: normalized(description), category: normalized(category), tags: tags.map(normalized), body: normalized(body) } };
    seen.add(record.url); output.push(entry);
  }
  return output;
}

function scoreEntry(entry, terms, query) {
  const fields = entry._search;
  let score = fields.title === query ? 10000 : fields.title.startsWith(query) && query ? 2000 : 0;
  for (const term of terms) {
    const tag = fields.tags.some(value => value.includes(term.word));
    if (term.tag) { if (!tag) return null; score += fields.tags.includes(term.word) ? 600 : 400; continue; }
    if (fields.title.includes(term.word)) score += 1000;
    else if (tag) score += 400;
    else if (fields.description.includes(term.word)) score += 200;
    else if (fields.category.includes(term.word)) score += 150;
    else if (fields.body.includes(term.word)) score += 20;
    else return null;
  }
  return score;
}

export function searchDocuments(prepared, query, { category = 'all', sort = 'relevance' } = {}) {
  if (!Array.isArray(prepared)) return [];
  if (typeof category !== 'string') return [];
  const normalizedQuery = normalizeQuery(query), terms = termsFor(normalizedQuery);
  if (normalizedQuery && !terms.length) return [];
  const filter = category === 'all' ? null : normalized(category);
  const found = [];
  for (const record of prepared.slice(0, MAX_RECORDS)) {
    if (!record?._search || !safePostPath(record.url) || filter !== null && record._search.category !== filter) continue;
    const score = scoreEntry(record, terms, normalizedQuery);
    if (score !== null) found.push({ ...record, score });
  }
  found.sort((a, b) => (sort === 'recent' ? b._time - a._time || b.score - a.score : b.score - a.score || b._time - a._time) || a._order - b._order);
  return found.map(record => ({ ...record, excerpt: excerptFor(record, normalizedQuery) }));
}

let segmenter;
try { if (typeof Intl.Segmenter === 'function') segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }); } catch { /* Code point fallback keeps literal matching usable. */ }
function* clusters(value) {
  if (segmenter) { yield* segmenter.segment(value); return; }
  let index = 0;
  for (const segment of value) { yield { segment, index }; index += segment.length; }
}

// Every normalized UTF-16 unit maps back to the complete original grapheme, so
// full-width text and ligature expansions highlight without corrupting content.
function normalizedMap(value, stopAt = Infinity) {
  let result = '', pendingSpace = null;
  const starts = [], ends = [];
  for (const { segment, index } of clusters(value)) {
    const end = index + segment.length, part = segment.normalize('NFKC').toLocaleLowerCase('zh-CN');
    for (const char of part) {
      if (/\s/u.test(char)) { if (result) pendingSpace = pendingSpace ? [pendingSpace[0], end] : [index, end]; continue; }
      if (pendingSpace) { result += ' '; starts.push(pendingSpace[0]); ends.push(pendingSpace[1]); pendingSpace = null; }
      result += char;
      for (let i = 0; i < char.length; i++) { starts.push(index); ends.push(end); }
    }
    if (result.length >= stopAt) break;
  }
  return { value: result, starts, ends };
}

export function highlightSegments(value, query) {
  const original = typeof value === 'string' ? cut(value, 4000) : '';
  if (!original) return [];
  const terms = [...new Set(termsFor(query).map(term => term.word))];
  if (!terms.length) return [{ text: original, match: false }];
  const map = normalizedMap(original), ranges = [];
  for (const term of terms) {
    let from = 0, count = 0;
    while (count++ < 500) {
      const index = map.value.indexOf(term, from); if (index < 0) break;
      const start = map.starts[index], end = map.ends[index + term.length - 1];
      if (start !== undefined && end !== undefined) ranges.push([start, end]);
      from = index + Math.max(1, term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  const output = []; let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) output.push({ text: original.slice(cursor, start), match: false });
    output.push({ text: original.slice(start, end), match: true }); cursor = end;
  }
  if (cursor < original.length) output.push({ text: original.slice(cursor), match: false });
  return output.length ? output : [{ text: original, match: false }];
}

export function excerptFor(record, query, max = 170) {
  const limit = Number.isFinite(max) ? Math.min(400, Math.max(40, Math.floor(max))) : 170;
  const body = typeof record?.body === 'string' ? record.body : '';
  const description = typeof record?.description === 'string' ? record.description : '';
  const terms = termsFor(query).filter(term => !term.tag).map(term => term.word);
  const bodyText = record?._search?.body ?? normalized(body);
  const positions = terms.map(term => ({ index: bodyText.indexOf(term), length: term.length })).filter(item => item.index >= 0).sort((a, b) => a.index - b.index);
  let source = description || body, center = 0;
  if (positions.length) {
    source = body;
    const match = positions[0], map = normalizedMap(body, match.index + match.length);
    center = map.starts[match.index] ?? 0;
  }
  if (!source) return '';
  if (source.length <= limit) return source;
  let start = Math.max(0, center - Math.floor(limit * .3));
  if (/[\uDC00-\uDFFF]/.test(source[start])) start--;
  const prefix = start > 0 ? '…' : '', available = limit - prefix.length - 1;
  const excerpt = cut(source.slice(start), available);
  return prefix + excerpt + (start + excerpt.length < source.length ? '…' : '');
}
