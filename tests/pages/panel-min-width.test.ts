import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Side panel minimum width', () => {
  it('ensures markup declares min-w-[360px] to match Chrome panel minimum', () => {
    const file = resolve(process.cwd(), 'src/pages/index.astro')
    const content = readFileSync(file, 'utf8')
    // Declare explicit minimum width for layout safety on narrow panels
    expect(content).toMatch(/class=\"[^\"]*min-w-\[360px\][^\"]*\"/)
  })
})

