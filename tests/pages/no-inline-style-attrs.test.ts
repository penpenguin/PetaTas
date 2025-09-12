import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('No inline style attributes in extension pages', () => {
  it('src/pages/index.astro contains no style="..." attributes', () => {
    const pagePath = join(process.cwd(), 'src', 'pages', 'index.astro')
    const source = readFileSync(pagePath, 'utf8')
    // Disallow inline style attributes to satisfy strict CSP (no 'unsafe-inline')
    expect(source).not.toMatch(/\sstyle=\"[^\"]*\"/)
  })
})

