// Checklist answers are stored as one comma-separated string; a comma inside a code is stored as U+001F, which real codes never contain.
const ESC = '\u001F';

export const joinCodes = codes => codes.map(c => String(c).replaceAll(',', ESC)).join(',');

export const splitCodes = str => String(str).split(',').map(c => c.replaceAll(ESC, ','));
