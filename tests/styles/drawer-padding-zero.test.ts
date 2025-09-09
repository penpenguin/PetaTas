import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Drawer content has no outer padding', () => {
  it('applies p-0 on .drawer-content to remove left/right gutters', () => {
    const file = resolve(process.cwd(), 'src/styles/main.css')
    const css = readFileSync(file, 'utf8')
    const m = css.match(/\.drawer-content\s*\{[\s\S]*?\}/)
    const block = m ? m[0] : ''
    // Ensure Tailwind utility p-0 is applied within the rule
    expect(block).toMatch(/@apply[^{;]*\bp-0\b/)
  })
})

