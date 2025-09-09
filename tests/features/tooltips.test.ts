import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function readAllFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...readAllFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

describe('Tooltip migration to daisyUI', () => {
  it('TypeScript sources should not use native title= for tooltips', () => {
    const srcFiles = readAllFiles(join(process.cwd(), 'src'))
      .filter(f => f.endsWith('.ts'));
    const titleAttr = /\btitle\s*=\s*['"]/; // attribute usage inside string templates
    const setAttrTitle = /setAttribute\(\s*['\"]title['\"]/;

    for (const f of srcFiles) {
      const text = readFileSync(f, 'utf8');
      expect(titleAttr.test(text)).toBe(false);
      expect(setAttrTitle.test(text)).toBe(false);
    }
  });

  it('panel-client should use data-tip and tooltip classes', () => {
    const panel = readFileSync(join(process.cwd(), 'src', 'panel-client.ts'), 'utf8');
    expect(panel.includes('data-tip=')).toBe(true);
    expect(panel.includes('tooltip')).toBe(true);
    expect(panel.includes("setAttribute('data-tip'")).toBe(true);
  });

  it('index.astro should apply daisyUI tooltip to Clear All', () => {
    const indexAstro = readFileSync(join(process.cwd(), 'src', 'pages', 'index.astro'), 'utf8');
    expect(indexAstro.includes('data-tip="Clear all tasks"')).toBe(true);
    expect(indexAstro.includes('tooltip')).toBe(true);
    // should not use title="Clear all tasks"
    expect(indexAstro.includes('title="Clear all tasks"')).toBe(false);
  });
});
