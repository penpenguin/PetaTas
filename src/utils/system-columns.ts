// Utilities to identify system/extension-managed column headers, including Japanese synonyms

// Canonical keys representing system fields managed by the extension (lowercase)
// Project policy: system columns are only Status, Timer, Notes
const SYSTEM_KEYS = new Set([
  'status',
  'notes',
  'timer',
]);

// Known localized/synonym headers that should be treated as system fields
// Synonyms remain part of the three conceptual system columns
const SYSTEM_SYNONYMS = new Set<string>([
  // Status variants
  '状態', 'ステータス', 'state',
  // Notes variants
  'ノート', 'メモ', 'description', 'comment', '説明', 'コメント',
  // Timer variants
  'タイマー', '経過時間', 'time',
]);

function normalize(header: string): string {
  return header.toLowerCase().trim();
}

export function isSystemHeader(header: string): boolean {
  const n = normalize(header);
  return SYSTEM_KEYS.has(n) || SYSTEM_SYNONYMS.has(header.trim());
}
