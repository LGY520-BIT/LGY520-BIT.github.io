// Pure writing helpers. Draft text never enters editor-preference storage.
export const EDIT_PREFS_KEY = 'unfinished-studio-editor-v1';
const MAX_BODY = 500000;
const DEFAULT_PREFS = Object.freeze({ fontSize: 16, lineHeight: 1.8, view: 'write', outline: true });

function bodyString(value) {
  if (typeof value !== 'string') throw new TypeError('正文必须是文本。');
  if (value.length > MAX_BODY) throw new RangeError('正文超过 500000 字符，未截断或修改原文。');
  return value;
}

function linesOf(body) {
  const lines = [];
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/gu;
  let match;
  while ((match = pattern.exec(body))) {
    lines.push({ text: match[1], eol: match[2], start: match.index, end: match.index + match[1].length });
    if (!match[2]) break;
  }
  return lines;
}

function headingText(value) {
  return value.replace(/[ \t]+#+[ \t]*$/u, '')
    .replace(/!\[([^\]]*)\]\([^\r\n]*?\)/gu, '$1')
    .replace(/\[([^\]]*)\]\([^\r\n]*?\)/gu, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/gu, '$1')
    .replace(/<!--.*?-->|<\/?[A-Za-z][^>]*>/gu, '')
    .replace(/&(?:amp|lt|gt|quot|#39);/gu, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity])
    .replace(/\\([\\`*{}_\[\]()#+.!~>\-])/gu, '$1')
    .replace(/[*_`~]+/gu, '')
    .replace(/[ \t]+/gu, ' ').trim().slice(0, 320);
}

export function getOutline(value) {
  const body = bodyString(value), outline = [];
  let fence = null;
  const lines = linesOf(body);
  for (let index = 0; index < lines.length && outline.length < 120; index++) {
    const line = lines[index];
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line.text);
    if (fence) {
      if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && /^[ \t]*$/u.test(marker[2])) fence = null;
      continue;
    }
    if (marker && !(marker[1][0] === '`' && marker[2].includes('`'))) {
      fence = { character: marker[1][0], length: marker[1].length };
      continue;
    }
    const heading = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/u.exec(line.text);
    if (!heading) continue;
    const text = headingText(heading[2] || '');
    if (!text) continue;
    outline.push({ id: `heading-${outline.length}`, line: index + 1, start: line.start, end: line.end, level: heading[1].length, text });
  }
  return outline;
}

export function readEditorPreferences(raw) {
  const result = { ...DEFAULT_PREFS };
  if (typeof raw !== 'string' || raw.length > 4096) return result;
  let value;
  try { value = JSON.parse(raw); } catch { return result; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  if (Number.isInteger(value.fontSize) && value.fontSize >= 14 && value.fontSize <= 24) result.fontSize = value.fontSize;
  if (typeof value.lineHeight === 'number' && Number.isFinite(value.lineHeight) && value.lineHeight >= 1.4 && value.lineHeight <= 2.4) result.lineHeight = Math.round(value.lineHeight * 10) / 10;
  if (['write', 'preview', 'split'].includes(value.view)) result.view = value.view;
  if (typeof value.outline === 'boolean') result.outline = value.outline;
  return result;
}

function selection(body, range) {
  const position = value => Number.isFinite(value) ? Math.max(0, Math.min(body.length, Math.trunc(value))) : 0;
  const a = position(range?.start), b = range?.end === undefined ? a : position(range.end);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

function replace(body, start, end, content, selectedStart = 0, selectedEnd = content.length) {
  const next = body.slice(0, start) + content + body.slice(end);
  if (next.length > MAX_BODY) throw new RangeError('插入后将超过 500000 字符，未修改原文。');
  return { body: next, start: start + selectedStart, end: start + selectedEnd };
}

function blockEdit(body, range, action) {
  const lines = linesOf(body);
  const findLine = position => {
    let result = 0;
    for (let index = 0; index < lines.length; index++) {
      if (lines[index].start > position) break;
      result = index;
    }
    return result;
  };
  const first = findLine(range.start), last = findLine(range.end > range.start ? range.end - 1 : range.end);
  const chosen = lines.slice(first, last + 1), blank = range.start === range.end && chosen.length === 1 && !chosen[0].text.trim();
  const placeholders = { heading: '小标题', quote: '写下一句值得记住的话', list: '列表内容', task: '待办事项' };
  let placeholderAt = 0;
  const transformed = chosen.map((line, index) => {
    let text = line.text;
    if (blank && placeholders[action]) text = placeholders[action];
    let next;
    if (action === 'indent') next = '  ' + text;
    else if (action === 'outdent') next = text.replace(/^(?: {1,2}|\t)/u, '');
    else if (action === 'heading') next = '## ' + text.replace(/^ {0,3}#{1,6}(?:[ \t]+|$)/u, '');
    else if (action === 'quote') next = /^ {0,3}>[ \t]?/u.test(text) ? text : '> ' + text;
    else if (action === 'list') next = '- ' + text.replace(/^\s*(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/u, '');
    else if (action === 'task') next = '- [ ] ' + text.replace(/^\s*(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/u, '');
    else throw new TypeError('未知的块级编辑操作。');
    if (blank) placeholderAt = next.indexOf(placeholders[action]);
    return next + (index < chosen.length - 1 ? line.eol : '');
  }).join('');
  const start = chosen[0].start, end = chosen.at(-1).end;
  if (blank && placeholders[action]) return replace(body, start, end, transformed, placeholderAt, placeholderAt + placeholders[action].length);
  if (range.start === range.end) {
    const prefixDelta = transformed.length - chosen[0].text.length;
    const caret = Math.max(0, Math.min(transformed.length, range.start - start + prefixDelta));
    return replace(body, start, end, transformed, caret, caret);
  }
  return replace(body, start, end, transformed);
}

export function editMarkdown(value, inputRange, action) {
  const body = bodyString(value), range = selection(body, inputRange);
  const selected = body.slice(range.start, range.end);
  const newline = /\r\n|\n|\r/u.exec(body)?.[0] || '\n';
  if (['heading', 'quote', 'list', 'task', 'indent', 'outdent'].includes(action)) return blockEdit(body, range, action);
  if (action === 'bold' || action === 'italic') {
    const marker = action === 'bold' ? '**' : '*', placeholder = action === 'bold' ? '加粗文字' : '斜体文字';
    if (selected.length > marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
      return replace(body, range.start, range.end, selected.slice(marker.length, -marker.length));
    }
    const text = selected || placeholder;
    return replace(body, range.start, range.end, marker + text + marker, marker.length, marker.length + text.length);
  }
  if (action === 'link') {
    const text = selected || '链接文字', url = 'https://example.com';
    const snippet = `[${text}](${url})`;
    return replace(body, range.start, range.end, snippet, selected ? text.length + 3 : 1, selected ? text.length + 3 + url.length : 1 + text.length);
  }
  if (action === 'code') {
    const runs = selected.match(/`+/gu) || [];
    const fence = '`'.repeat(runs.reduce((longest, run) => Math.max(longest, run.length + 1), 3));
    const before = range.start > 0 && !/[\r\n]/u.test(body[range.start - 1]) ? newline : '';
    const after = range.end < body.length && !/[\r\n]/u.test(body[range.end]) ? newline : '';
    const text = selected || '代码内容', prefix = before + fence + 'text' + newline;
    return replace(body, range.start, range.end, prefix + text + newline + fence + after, prefix.length, prefix.length + text.length);
  }
  if (action === 'divider') {
    const before = body.slice(0, range.start), after = body.slice(range.start);
    const paddingBefore = !before ? '' : before.endsWith(newline + newline) ? '' : before.endsWith(newline) ? newline : newline + newline;
    const paddingAfter = !after ? newline : after.startsWith(newline + newline) ? '' : after.startsWith(newline) ? newline : newline + newline;
    const snippet = paddingBefore + '---' + paddingAfter;
    // A divider must not discard selected prose: insert before it instead.
    return replace(body, range.start, range.start, snippet, snippet.length, snippet.length);
  }
  throw new TypeError('未知的 Markdown 编辑操作。');
}
