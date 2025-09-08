import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Navbar title left spacing', () => {
  it('adds a small left margin to the PetaTas title (ml-2)', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')

    // Red phase: expect the title h1 to have ml-2 for a bit of left spacing
    expect(content).toMatch(/<h1[^>]*class=\"[^\"]*\bml-2\b[^\"]*\"[^>]*data-testid=\"panel-title\"/)
  })
})

