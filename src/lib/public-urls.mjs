export function safeSpaceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f]/u.test(value)) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.hostname ? url.href : '';
  } catch { return ''; }
}
export function safeSpaceImage(value) {
  if (typeof value !== 'string') return '';
  if (/^\/images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp|gif)$/iu.test(value)) return value;
  if (value.startsWith('https://') && safeSpaceUrl(value)) return safeSpaceUrl(value);
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value);
  if (!match || value.length > 550000 || match[2].length % 4 !== 0) return '';
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 400000 || bytes.toString('base64') !== match[2]) return '';
  const magic = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : match[1] === 'gif' ? /^GIF8[79]a/u.test(bytes.subarray(0, 6).toString('ascii'))
    : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  return magic ? value : '';
}
