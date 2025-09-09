import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('main.css cleanup for daisyUI compatibility', () => {
  const cssPath = resolve(process.cwd(), 'src', 'styles', 'main.css')
  const css = readFileSync(cssPath, 'utf8')

  const getListRowBlock = () => {
    const m = css.match(/\.list-row\s*\{[\s\S]*?\}/)
    return m ? m[0] : ''
  }

  it('does not hardcode card background/hover on .list-row', () => {
    const listRowBlock = getListRowBlock()
    expect(listRowBlock).not.toMatch(/bg-base-200|hover:bg-base-300/)
    expect(listRowBlock).not.toMatch(/border-radius:\s*var\(--rounded-box\)\s*;/)
  })

  it('does not define flex/gap/transition on .list-row (moved to markup)', () => {
    const listRowBlock = getListRowBlock()
    expect(listRowBlock).not.toMatch(/flex|items-center|gap-3|transition-colors/)
  })

  it('does not duplicate color-scheme dark hint (handled in theme.ts)', () => {
    expect(css).not.toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/)
    expect(css).not.toMatch(/color-scheme:\s*dark\s*;/)
  })

  it('applies global horizontal overflow suppression on body', () => {
    // Ensure we clip any accidental fixed/absolute elements outside panel root
    expect(css).toMatch(/body\s*\{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?\}/)
  })

  it('sets html/body margin and padding to zero', () => {
    // Accept either a combined selector or separate rules; require both properties
    const combined = /(html\s*,\s*body)\s*\{[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;[\s\S]*?\}/
    const htmlRule = /html\s*\{[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;[\s\S]*?\}/
    expect(combined.test(css) || htmlRule.test(css)).toBe(true)
  })
})
