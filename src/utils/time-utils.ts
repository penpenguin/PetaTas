// Time parsing utilities for importing timer values from Markdown

// Parse timer string like HH:MM:SS or MM:SS into milliseconds.
// Also supports h/m/s tokens like "1h 2m 3s".
export function parseTimerToMs(input: string): number {
  if (!input) return 0;
  const s = input.trim();

  // Token format: 1h 2m 3s
  const tokenRe = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i;
  const tokenMatch = s.match(tokenRe);
  if (tokenMatch && (tokenMatch[1] || tokenMatch[2] || tokenMatch[3])) {
    const h = parseInt(tokenMatch[1] || '0', 10);
    const m = parseInt(tokenMatch[2] || '0', 10);
    const sec = parseInt(tokenMatch[3] || '0', 10);
    if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(sec)) {
      return ((h * 60 + m) * 60 + sec) * 1000;
    }
  }

  // Colon format: HH:MM:SS or MM:SS
  const parts = s.split(':').map(p => p.trim());
  if (parts.length === 3) {
    const [hS, mS, sS] = parts;
    const h = parseInt(hS, 10);
    const m = parseInt(mS, 10);
    const sec = parseInt(sS, 10);
    if ([h, m, sec].every(n => Number.isFinite(n) && n >= 0)) {
      return ((h * 60 + m) * 60 + sec) * 1000;
    }
  } else if (parts.length === 2) {
    const [mS, sS] = parts;
    const m = parseInt(mS, 10);
    const sec = parseInt(sS, 10);
    if ([m, sec].every(n => Number.isFinite(n) && n >= 0)) {
      return (m * 60 + sec) * 1000;
    }
  }

  // Fallback: not a recognized format
  return 0;
}

