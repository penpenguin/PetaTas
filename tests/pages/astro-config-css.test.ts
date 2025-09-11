import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Astro CSS emission policy', () => {
  it("does not inline styles (inlineStylesheets: 'never')", () => {
    const cfgPath = join(process.cwd(), 'astro.config.mjs')
    const source = readFileSync(cfgPath, 'utf8')
    // A simple static check to ensure configuration selects external CSS files
    expect(source).toMatch(/inlineStylesheets:\s*'never'/)
  })
})

