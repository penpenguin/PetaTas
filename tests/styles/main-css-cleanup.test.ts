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
})
