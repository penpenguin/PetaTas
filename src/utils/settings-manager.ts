// Settings manager for user preferences stored in chrome.storage.local

export const SETTINGS_KEYS = {
  TITLE_ALIASES: 'settings_title_aliases',
} as const;

export function normalizeHeaderKey(key: string): string {
  return key.toLowerCase().trim();
}

export function parseCsvAliases(input: string): string[] {
  if (!input) return [];
  // Support commas; tolerate newlines by treating them as commas
  return input
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export async function loadTitleAliases(): Promise<string[]> {
  try {
    if (!('chrome' in globalThis) || !chrome.storage?.local?.get) return [];
    const result = await chrome.storage.local.get(SETTINGS_KEYS.TITLE_ALIASES);
    const list = result?.[SETTINGS_KEYS.TITLE_ALIASES];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveTitleAliases(aliases: string[]): Promise<void> {
  if (!('chrome' in globalThis) || !chrome.storage?.local?.set) return;
  await chrome.storage.local.set({ [SETTINGS_KEYS.TITLE_ALIASES]: aliases });
}

export async function loadNormalizedTitleAliases(): Promise<Set<string>> {
  const list = await loadTitleAliases();
  return new Set(list.map(normalizeHeaderKey));
}

