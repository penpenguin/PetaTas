import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Navbar compact height', () => {
  it('uses a compact navbar min-height (min-h-12)', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')

    // Red phase: expect navbar to explicitly include min-h-12 to reduce height
    expect(content).toMatch(/class=\"navbar\b[^\"]*\bmin-h-12\b/)
  })
})

