import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Navbar uses daisyUI dropdown/menu', () => {
  it('contains dropdown container and menu markup', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')

    expect(content).toMatch(/class=\"navbar\b/)
    expect(content).toMatch(/class=\"dropdown\b[^\"]*dropdown-end/)
    expect(content).toMatch(/class=\"menu\b[^\"]*dropdown-content/)
    // Ensure menu overlays cards
    expect(content).toMatch(/dropdown-content[^\"]*z-50/)
  })
})
