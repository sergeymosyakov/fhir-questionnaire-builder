// Builds an <img>/<audio>/<video> for an imported Attachment — only for http(s) (relative included) and data: media URLs.
const DATA_MEDIA = /^data:(image|audio|video)\//i;

function isSafeMediaUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  if (DATA_MEDIA.test(url)) return true;
  try { return ['http:', 'https:'].includes(new URL(url, document.baseURI).protocol); } catch { return false; }
}

export function createMedia(att, className) {
  if (!isSafeMediaUrl(att?.url)) return null;
  const ct = att.contentType || '';
  const tag = ct.startsWith('audio/') ? 'audio' : ct.startsWith('video/') ? 'video' : 'img';
  const el = document.createElement(tag);
  el.src = att.url;
  el.referrerPolicy = 'no-referrer';
  if (tag === 'img') el.alt = att.title || '';
  else el.controls = true;
  el.className = className;
  return el;
}
