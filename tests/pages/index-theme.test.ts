import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('index.astro theme application', () => {
  it('sets data-theme to fantasy by default', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')
    expect(content).toMatch(/<html[^>]*data-theme=\"fantasy\"/)
  })
})
